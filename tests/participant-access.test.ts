import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("allowlist scopes history, blocks writes and signup, and revokes existing sessions", async () => {
  const db = new PGlite();
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
    await db.exec(
      readFileSync("supabase/migrations/202611030001_admin_access.sql", "utf8"),
    );
    await db.exec(
      "insert into public.admin_access(email) values ('admin@example.com')",
    );
    await db.exec(
      `set role authenticated; set test.role='authenticated'; set test.email='admin@example.com';`,
    );
    const { rows } = await db.query<{ id: string }>(
      `insert into public.people(name) values('Alice'),('Bob'),('Carol') returning id`,
    );
    const [a, b, c] = rows.map((r) => r.id);
    await db.query(
      `insert into public.participant_access(person_id,email) values($1,'alice@example.com'),($2,'bob@example.com')`,
      [a, b],
    );
    for (const year of [2025, 2026])
      await db.query("select public.save_exchange($1,$2::jsonb)", [
        year,
        JSON.stringify([
          { giver_id: a, recipient_id: b },
          { giver_id: b, recipient_id: c },
          { giver_id: c, recipient_id: a },
        ]),
      ]);
    // Pausing participation must not remove access to past history.
    await db.query("update public.people set active=false where id=$1", [a]);
    await db.exec(`set test.email='ALICE@example.com'`);
    assert.equal(
      (await db.query<{ role: string }>("select * from public.my_access()"))
        .rows[0].role,
      "participant",
    );
    assert.deepEqual(
      (await db.query("select * from public.my_assignments()")).rows,
      [
        { year: 2026, recipient_name: "Bob" },
        { year: 2025, recipient_name: "Bob" },
      ],
    );
    for (const table of [
      "people",
      "assignments",
      "exchanges",
      "exclusions",
      "participant_access",
    ])
      assert.equal(
        (await db.query(`select * from public.${table}`)).rows.length,
        0,
      );
    await db.query(
      "update public.participant_access set email=$1 where person_id=$2",
      ["attacker@example.com", a],
    );
    // RLS updates can silently affect zero rows; verify the original membership remains.
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      1,
    );
    await assert.rejects(
      db.exec(`insert into public.people(name) values('Intruder')`),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select public.save_exchange(2027,$1::jsonb)", ["[]"]),
      /Organizer access/,
    );
    await assert.rejects(
      db.query("select public.before_user_created($1::jsonb)", ["{}"]),
      /permission denied/,
    );
    await db.exec(`set test.email='unknown@example.com'`);
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.my_assignments()")).rows.length,
      0,
    );
    await db.exec(`set test.email='admin@example.com'`);
    await assert.rejects(
      db.query(
        `insert into public.participant_access(person_id,email) values($1,'alice@example.com')`,
        [c],
      ),
      /unique constraint/,
    );
    await db.query(
      "update public.participant_access set enabled=false where person_id=$1",
      [a],
    );
    await db.exec(`set test.email='alice@example.com'`);
    assert.equal(
      (await db.query("select * from public.my_access()")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.my_assignments()")).rows.length,
      0,
    );
    await db.exec(`reset role; set role supabase_auth_admin`);
    async function hook(email: string) {
      return (
        await db.query<{ result: { error?: { http_code: number } } }>(
          "select public.before_user_created($1::jsonb) as result",
          [JSON.stringify({ user: { email } })],
        )
      ).rows[0].result;
    }
    assert.deepEqual(await hook("BOB@example.com"), {});
    assert.deepEqual(await hook("admin@example.com"), {});
    assert.equal((await hook("unknown@example.com")).error?.http_code, 403);
    assert.equal((await hook("alice@example.com")).error?.http_code, 403);
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.exec("select * from public.my_assignments()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
