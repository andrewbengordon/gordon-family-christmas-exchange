# Database setup

Use a separate Supabase project for development. In a fresh project's SQL Editor, run every file in `migrations/` in filename order. New installations start with no people, exchanges, or admins. The historical-seed migration ID is retained as a no-op for migration ledgers; personal history is not shipped.

## First admin (fresh installations only)

As the database owner in Supabase SQL Editor, replace the example email with your own verified Google account and run:

```sql
insert into public.admin_access(email)
values (lower(trim('YOUR_GOOGLE_EMAIL_HERE')))
on conflict do nothing;
```

Do not commit the personalized statement. There is no public bootstrap endpoint: ordinary authenticated users cannot create the first admin. After signing in, manage further admins under People & Couples → Admins. At least one admin must remain. Admin access is independent of participant access and yearly participation.

## Existing installations

Apply only `migrations/202611030002_publication_hardening.sql` for this upgrade. It preserves all existing admin memberships, participants, assignments, and hook function identity. Do not run the bootstrap statement if admins are already configured. No live history is deleted or replaced by this upgrade.

The current baseline uses database-managed admin authorization too. Replaying it no longer restores the former hardcoded organizer or removes delegated admins. The SQL files are transactional and rerunnable against the supported schema; they do not repair arbitrary incompatible schema drift.

## Supabase CLI

Inspect `supabase migration list` before adopting the CLI on a project originally configured through SQL Editor. Preserve existing ledger entries. The historical seed filename remains reserved, and the new forward migration handles upgrades. Do not reset production. Future changes should use explicit forward migrations.

Schema migrations never run during application startup or Vercel deployment. Keep real data and backups outside the public repository. Any local sample data should be fictional and confined to a development project.
