import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const migration = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8");
const baseline = migration("202610300002_schema_baseline.sql");
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth;
    create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
    grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;`);
  return db;
}
test("fresh installs authorize nobody; only database owner can bootstrap the first admin", async () => {
  const db = await database();
  try {
    for (const f of files) await db.exec(migration(f));
    assert.equal(
      (await db.query("select * from public.admin_access")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.people")).rows.length,
      0,
    );
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='admin@example.com'`,
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_organizer() as allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await assert.rejects(
      db.exec("select public.set_admin('admin@example.com',true)"),
      /Admin access required/,
    );
    await assert.rejects(
      db.exec("insert into public.admin_access values('admin@example.com')"),
      /permission denied/,
    );
    await db.exec(
      "reset role; insert into public.admin_access values('admin@example.com'); set role authenticated",
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_organizer() as allowed",
        )
      ).rows[0].allowed,
      true,
    );
  } finally {
    await db.close();
  }
});
test("baseline and migration replay preserve delegation, revocation, data, and hook identity", async () => {
  const db = await database();
  try {
    for (const f of files) await db.exec(migration(f));
    await db.exec(`insert into public.admin_access values('admin@example.com');
      insert into public.people(name) values('Example One'),('Example Two'),('Example Three');
      insert into public.exchanges(year) values(2025);
      insert into public.assignments(exchange_id,giver_id,recipient_id)
        select e.id,g.id,r.id from public.exchanges e, public.people g, public.people r where g.name='Example One' and r.name='Example Two';
      set role authenticated; set test.role='authenticated'; set test.email='admin@example.com';
      select public.set_admin('replacement@example.com',true); select public.set_admin('admin@example.com',false); reset role;`);
    const snapshot = async () =>
      Promise.all(
        [
          "admin_access",
          "people",
          "participant_access",
          "exchanges",
          "assignments",
          "exclusions",
        ].map(
          async (table) =>
            (await db.query(`select * from public.${table} order by 1`)).rows,
        ),
      );
    const before = await snapshot();
    const hook = await db.query(
      "select 'public.before_user_created(jsonb)'::regprocedure::oid as oid",
    );
    // The baseline alone used to restore the revoked original organizer.
    await db.exec(baseline);
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='admin@example.com'`,
    );
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    await db.exec(`set test.email='replacement@example.com'`);
    assert.equal(
      (await db.query<{ role: string }>("select * from public.my_access()"))
        .rows[0].role,
      "organizer",
    );
    await db.exec("reset role");
    for (let i = 0; i < 2; i++)
      for (const f of files) await db.exec(migration(f));
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(
      (
        await db.query(
          "select 'public.before_user_created(jsonb)'::regprocedure::oid as oid",
        )
      ).rows,
      hook.rows,
    );
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='admin@example.com'`,
    );
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    await db.exec(`set test.email='replacement@example.com'`);
    assert.equal(
      (await db.query<{ role: string }>("select * from public.my_access()"))
        .rows[0].role,
      "organizer",
    );
    await db.exec(`reset role; set role supabase_auth_admin`);
    assert.deepEqual(
      (
        await db.query(
          'select public.before_user_created(\'{"user":{"email":"replacement@example.com"}}\') as result',
        )
      ).rows,
      [{ result: {} }],
    );
    const denied = await db.query<{ result: { error?: unknown } }>(
      'select public.before_user_created(\'{"user":{"email":"admin@example.com"}}\') as result',
    );
    assert.ok(denied.rows[0].result.error);
  } finally {
    await db.close();
  }
});

test("forward migration replaces legacy email checks without changing existing memberships", async () => {
  const db = await database();
  try {
    for (const f of files) await db.exec(migration(f));
    await db.exec(`insert into public.admin_access values('replacement@example.com');
      create or replace function public.is_organizer() returns boolean language sql stable security invoker set search_path='' as $$
        select auth.role()='authenticated' and lower(auth.jwt()->>'email')='legacy@example.com' $$;`);
    await db.exec(migration("202611030002_publication_hardening.sql"));
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='legacy@example.com'`,
    );
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    await db.exec(`set test.email='replacement@example.com'`);
    assert.equal(
      (await db.query<{ role: string }>("select * from public.my_access()"))
        .rows[0].role,
      "organizer",
    );
  } finally {
    await db.close();
  }
});
