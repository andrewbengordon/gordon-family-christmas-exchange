# Maintainer guide

Start with the project README and [database setup](../supabase/README.md).

## Architecture

Next.js App Router, TypeScript, and MUI provide the UI; Supabase provides Google authentication and relational storage. Vercel hosts the application. Deployments do not apply database migrations.

`admin_access` stores admin Google emails. `is_organizer()` retains its legacy name for existing policies but consults current membership on every request. Only the database owner can bootstrap the first admin. Authenticated admins delegate/revoke membership through `set_admin()`, which serializes updates and prevents removing the final admin. Revoked admins retain participant access only if separately allowlisted. Admins can see every assignment and manage other admins.

`participant_access` links Google emails to people independently of yearly participation. Pausing someone does not revoke their login or history. Direct family table access is admin-only through RLS. `my_access()` and `my_assignments()` expose only the permitted participant data; future years are hidden until their year in America/Denver. The signup hook rejects unlisted new users; current sessions are separately checked against database membership.

Matching first minimizes reciprocal pairs (A gives to B and B gives to A), then historical repeated pairs, then weighted repeat costs, with more recent history carrying greater weight. Self-matches and exclusions remain forbidden; optional previous-year avoidance is a hard restriction. Reciprocal pairs are allowed only when needed to achieve the fewest possible under the hard rules. Hungarian matching supplies lower bounds for an exact branch-and-bound search over reciprocal pairs; worst-case search can be exponential on heavily constrained large rosters. Random ordering breaks ties and does not give a uniform draw over all possible exchanges. Impossible draws fail without saving. Writes are validated transactionally in the database. Deleting a saved year removes its assignments and influence on future matching, preserving people and access.

The gift reveal is a presentation effect, not an authorization boundary. Data already viewed cannot be recalled. Themes persist light/dark preferences; cobalt is the main control color, retro pink is used for subtitles, and poppy red for destructive accents.

Cloud tasks already have an isolated checkout. Use it; do not create worktrees unless requested. Inspect implementation and tests before changing behavior. Documentation alone does not establish hosted configuration.

## Authentication setup

1. Apply the database migrations and explicitly bootstrap an admin as described in database setup.
2. Configure a Google OAuth Web application with basic identity scopes (openid, email, profile). Set its redirect URI to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
3. Enable Google in Supabase and store the OAuth client secret there only. Leave nonce checks enabled. Do not put OAuth secrets in the application or repository.
4. Set Supabase's Site URL to your production app origin. Allow the exact production `/auth/confirm` URL and `http://localhost:3000/auth/confirm` for local development.
5. Set `NEXT_PUBLIC_SITE_URL` to the app origin for each environment. Google redirects through Supabase; the application exchanges the PKCE code at `/auth/confirm`.
6. Enable the Before User Created Postgres hook `public.before_user_created`. Keep signups enabled for invited users. Google consent apps in Testing also need invited accounts on Google's test-user list.
7. Disable unused auth providers. If retaining any email-based provider, require verified email ownership; database access is keyed by the authenticated email.

In People & Couples, save each participant's Google email. Disabling participant login does not revoke a separate admin role. Removing admin access does not remove a separately enabled participant login.

## Deployment and validation

Set the three public variables described in `.env.example` to your own project settings. Never put service-role keys, passwords, or OAuth secrets in `NEXT_PUBLIC_` variables. Public values are embedded at build time, so redeploy after changing them. Preview deployments need an appropriate site origin and explicit Supabase callback allowlisting. Use a development Supabase project for local changes.

Run `npm test`, `npm run typecheck`, and `npm run build`. Tests use embedded Postgres to verify permissions, participant privacy, delegation/revocation, first-admin restrictions, and schema replay. They do not verify hosted configuration or live OAuth. Verify those against the intended Supabase project separately. The cloud server needs outbound HTTPS to that project's Supabase host.

For publication, see [PUBLICATION.md](PUBLICATION.md). Production family data is intentionally absent from the source tree.
