-- Current, rerunnable schema baseline for fresh and existing supported databases.
-- Consolidated from the original SQL Editor setup; followed by forward migrations.
-- No people or exchanges are inserted/deleted here. Existing IDs, auth hook function
-- identity, login access, and application data are preserved.
-- IF NOT EXISTS is not a repair tool for arbitrary column/constraint drift:
-- future structural changes still require explicit ALTER migrations.
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


create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists people_unique_name on public.people (lower(trim(name)));
create table if not exists public.exclusions (
  id uuid primary key default gen_random_uuid(),
  person_a uuid not null references public.people(id),
  person_b uuid not null references public.people(id),
  check (person_a < person_b), unique (person_a, person_b)
);
create table if not exists public.exchanges (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique check (year between 2000 and 2200),
  created_at timestamptz not null default now()
);
create table if not exists public.assignments (
  exchange_id uuid not null references public.exchanges(id),
  giver_id uuid not null references public.people(id),
  recipient_id uuid not null references public.people(id),
  primary key (exchange_id, giver_id), unique (exchange_id, recipient_id), check (giver_id <> recipient_id)
);

alter table public.people enable row level security;
alter table public.exclusions enable row level security;
alter table public.exchanges enable row level security;
alter table public.assignments enable row level security;
revoke all on public.people, public.exclusions, public.exchanges, public.assignments from anon, authenticated;
grant select, insert, update on public.people to authenticated;
grant select, insert, delete on public.exclusions to authenticated;
grant select on public.exchanges, public.assignments to authenticated;
drop policy if exists organizer_people on public.people;
create policy organizer_people on public.people for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
drop policy if exists organizer_exclusions on public.exclusions;
create policy organizer_exclusions on public.exclusions for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
drop policy if exists organizer_exchanges on public.exchanges;
create policy organizer_exchanges on public.exchanges for select to authenticated using (public.is_organizer());
drop policy if exists organizer_assignments on public.assignments;
create policy organizer_assignments on public.assignments for select to authenticated using (public.is_organizer());

-- Atomic persistence: authenticated callers cannot write assignments directly.
create or replace function public.save_exchange(exchange_year integer, pairs jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; total integer;
begin
  if not coalesce(public.is_organizer(), false) then raise exception 'Organizer access required'; end if;
  if jsonb_typeof(pairs) <> 'array' then raise exception 'Assignments must be an array'; end if;
  total := jsonb_array_length(pairs);
  if total < 3 or total > 200 then raise exception 'Choose between 3 and 200 participants'; end if;
  -- Prevent exclusion/participant edits racing validation and insertion.
  lock table public.people, public.exclusions in share mode;
  if exists (
    select 1 from jsonb_to_recordset(pairs) as p(giver_id uuid, recipient_id uuid)
    left join public.people g on g.id = p.giver_id
    left join public.people r on r.id = p.recipient_id
    where g.id is null or r.id is null or not g.active or not r.active or p.giver_id = p.recipient_id
      or exists (select 1 from public.exclusions e where (e.person_a = p.giver_id and e.person_b = p.recipient_id) or (e.person_b = p.giver_id and e.person_a = p.recipient_id))
  ) then raise exception 'Assignments include an inactive person, self-match, or excluded pair'; end if;
  if (select count(distinct giver_id) from jsonb_to_recordset(pairs) as p(giver_id uuid)) <> total
    or (select count(distinct recipient_id) from jsonb_to_recordset(pairs) as p(recipient_id uuid)) <> total
    or exists (
      select giver_id from jsonb_to_recordset(pairs) as p(giver_id uuid)
      except select recipient_id from jsonb_to_recordset(pairs) as p(recipient_id uuid)
    ) then raise exception 'Every participant must give and receive exactly once'; end if;
  insert into public.exchanges(year) values(exchange_year) returning id into new_id;
  insert into public.assignments(exchange_id, giver_id, recipient_id)
    select new_id, giver_id, recipient_id from jsonb_to_recordset(pairs) as p(giver_id uuid, recipient_id uuid);
  return new_id;
end;
$$;
revoke all on function public.save_exchange(integer, jsonb) from public;
grant execute on function public.save_exchange(integer, jsonb) to authenticated;

-- Separate login permission from yearly participation. No participant can read this table.
create table if not exists public.participant_access (
  person_id uuid primary key references public.people(id),
  email text not null unique check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  enabled boolean not null default true
);
alter table public.participant_access enable row level security;
revoke all on public.participant_access from anon, authenticated;
grant select, insert, update, delete on public.participant_access to authenticated;
drop policy if exists organizer_access on public.participant_access;
create policy organizer_access on public.participant_access for all to authenticated
  using (public.is_organizer()) with check (public.is_organizer());

-- Both RPCs recheck the current allowlist, including for already-issued sessions.
create or replace function public.my_access() returns table(role text, person_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select 'organizer'::text, null::uuid, 'Organizer'::text where public.is_organizer()
  union all
  select 'participant'::text, p.id, p.name from public.participant_access a
    join public.people p on p.id = a.person_id
    where auth.role() = 'authenticated' and not coalesce(public.is_organizer(), false)
      and a.enabled and a.email = lower(auth.jwt()->>'email');
$$;
create or replace function public.my_assignments() returns table(year integer, recipient_name text)
language sql stable security definer set search_path = '' as $$
  select e.year, recipient.name from public.participant_access a
    join public.assignments assignment on assignment.giver_id = a.person_id
    join public.exchanges e on e.id = assignment.exchange_id
    join public.people recipient on recipient.id = assignment.recipient_id
    where auth.role() = 'authenticated' and a.enabled and a.email = lower(auth.jwt()->>'email')
      and e.year <= extract(year from now() at time zone 'America/Denver')
    order by e.year desc;
$$;
revoke all on function public.my_access(), public.my_assignments() from public;
grant execute on function public.my_access(), public.my_assignments() to authenticated;

-- Enable this function in Supabase Authentication → Hooks → Before User Created.
-- This rejects unlisted new auth accounts, in addition to app/data access denial.
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
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

create or replace function public.delete_exchange(target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_organizer(), false) then raise exception 'Organizer access required'; end if;
  perform 1 from public.exchanges where id=target_id for update;
  if not found then raise exception 'This Christmas has already been deleted. Refresh the page.'; end if;
  delete from public.assignments where exchange_id=target_id;
  delete from public.exchanges where id=target_id;
end;
$$;
revoke all on function public.delete_exchange(uuid) from public, anon;
grant execute on function public.delete_exchange(uuid) to authenticated;
commit;
