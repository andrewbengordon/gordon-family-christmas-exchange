-- Forward hardening migration for existing databases. Preserves all admin memberships.
begin;
create table if not exists public.admin_access (
  email text primary key check (email = lower(trim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
alter table public.admin_access enable row level security;
revoke all on public.admin_access from public, anon, authenticated;
grant select on public.admin_access to authenticated;

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.role() = 'authenticated' and exists (
    select 1 from public.admin_access where email = lower(auth.jwt()->>'email')
  );
$$;
revoke all on function public.is_organizer() from public, anon;
grant execute on function public.is_organizer() to authenticated;
drop policy if exists admin_read on public.admin_access;
create policy admin_read on public.admin_access for select to authenticated using (public.is_organizer());

-- All mutations use this serialized function: no direct writes, including by admins.
create or replace function public.set_admin(target_email text, make_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare normalized text := lower(trim(target_email));
begin
  lock table public.admin_access in exclusive mode;
  if not coalesce(public.is_organizer(), false) then raise exception 'Admin access required'; end if;
  if normalized is null or length(normalized) > 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid Google account email';
  end if;
  if make_admin is null then raise exception 'Choose an admin access setting'; end if;
  if make_admin then
    insert into public.admin_access(email) values(normalized) on conflict do nothing;
  else
    if exists(select 1 from public.admin_access where email = normalized)
      and (select count(*) from public.admin_access) <= 1 then
      raise exception 'At least one admin must remain';
    end if;
    delete from public.admin_access where email = normalized;
  end if;
end;
$$;
revoke all on function public.set_admin(text, boolean) from public, anon;
grant execute on function public.set_admin(text, boolean) to authenticated;

create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare login_email text := lower(trim(event->'user'->>'email'));
begin
  if exists(select 1 from public.admin_access where email = login_email) or exists (
    select 1 from public.participant_access where enabled and email = login_email
  ) then return '{}'::jsonb; end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Access is limited to invited family members.'));
end;
$$;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
commit;
