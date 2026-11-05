# Gordon Christmas Exchange

A responsive family gift exchange app built with Next.js, MUI, and Supabase.

## Features

- **Organizer dashboard:** remember family members, select each year’s participants, and manage Google login access and delegate admin access. Pausing participation does not remove someone’s access to their history.
- **Couples and exclusions:** prevent selected pairs from drawing each other in either direction.
- **History-aware matching:** everyone gives and receives once, with no self-matches. Draws minimize reciprocal pairs (two people drawing each other), then repeats across earlier Christmases and can strictly avoid last year’s recipient. Impossible draws stop without saving.
- **Private participant view:** allowlisted family members sign in with Google and click a gift illustration to reveal their current recipient. Each person can also see their own past assignments.
- **Saved Christmases:** organizers can review all assignments and delete a year after confirmation. Deleting a year removes its assignments but keeps people, login access, and exclusions.
- **Light and dark themes:** responsive layouts with a theme switch that remembers your preference.

## Local setup

Use **Node.js 24 LTS**, npm, and a Supabase project with Google sign-in enabled.

```sh
git clone https://github.com/andrewbengordon/Gordon-Sibling-Christmas-Exchange.git
cd Gordon-Sibling-Christmas-Exchange
npm ci
cp .env.example .env.local
```

If you already have a checkout or `.env.local`, reuse them. Set these variables in `.env.local`:

| Variable                               | Value                         |
| -------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Your Supabase project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000`       |

The example file contains placeholders; supply your own project settings. Use a separate Supabase project for development if you want to avoid changing production data. Never use a database password or service-role key in a `NEXT_PUBLIC_` variable.

For a fresh backend, follow [database setup](supabase/README.md). Allow `http://localhost:3000/auth/confirm` in Supabase’s authentication redirect settings, and use an approved Google account to sign in. Full Google provider configuration is in the [maintainer guide](docs/MAINTAINER.md).

```sh
npm run dev
```

Open **http://localhost:3000**.

Run the local checks with:

```sh
npm test
npm run typecheck
npm run build
```
