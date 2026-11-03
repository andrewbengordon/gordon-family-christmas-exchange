import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("admins can delegate and revoke access without leaving zero admins", async () => {
  const db = new PGlite();
  const migration = readFileSync(
    "supabase/migrations/202611030001_admin_access.sql",
    "utf8",
  );
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth;
      create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
      grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;`);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610300002_schema_baseline.sql",
        "utf8",
      ),
    );
    await db.exec(migration);
    await db.exec(
      "insert into public.admin_access(email) values ('admin@example.com')",
    );
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='admin@example.com'`,
    );
    await assert.rejects(
      db.exec(`select public.set_admin('admin@example.com',false)`),
      /At least one admin/,
    );
    await db.exec(`select public.set_admin(' New@example.com ',true)`);
    await db.exec(`set test.email='NEW@example.com'`);
    assert.equal(
      (await db.query<{ role: string }>("select * from public.my_access()"))
        .rows[0].role,
      "organizer",
    );
    await db.exec(
      `insert into public.people(name) values('Admin created person')`,
    );
    await db.exec(`select public.set_admin('admin@example.com',false)`);
    await db.exec(`set test.email='admin@example.com'`);
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(`select public.set_admin('intruder@example.com',true)`),
      /Admin access required/,
    );
    await assert.rejects(
      db.exec(`insert into public.admin_access values('intruder@example.com')`),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from public.admin_access")).rows.length,
      0,
    );
    await db.exec(`reset role`);
    await db.exec(migration);
    assert.deepEqual(
      (await db.query("select email from public.admin_access")).rows,
      [{ email: "new@example.com" }],
    );
    await db.exec(`set role supabase_auth_admin`);
    assert.deepEqual(
      (
        await db.query<{ result: unknown }>(
          `select public.before_user_created('{"user":{"email":"NEW@example.com"}}') as result`,
        )
      ).rows[0].result,
      {},
    );
    const denied = (
      await db.query<{ result: { error?: unknown } }>(
        `select public.before_user_created('{"user":{"email":"admin@example.com"}}') as result`,
      )
    ).rows[0].result;
    assert.ok(denied.error);
    await db.exec(`reset role; set role anon; set test.role='anon'`);
    await assert.rejects(
      db.exec(`select public.set_admin('intruder@example.com',true)`),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
