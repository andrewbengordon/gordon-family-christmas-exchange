import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("migration enforces organizer access and saves only valid, immutable exchanges", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth;
      create function auth.role() returns text language sql as $$ select current_setting('test.role', true) $$;
      create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;`);
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
      `set role authenticated; set test.role = 'authenticated'; set test.email = 'stranger@example.com';`,
    );
    await assert.rejects(
      db.exec(`insert into public.people(name) values('Blocked')`),
      /row-level security/,
    );
    await assert.rejects(
      db.query(`select public.save_exchange(2026, $1::jsonb)`, ["[]"]),
      /Organizer access/,
    );
    await db.exec(`set test.email = 'admin@example.com'`);
    const { rows } = await db.query<{ id: string }>(
      `insert into public.people(name) values('A'),('B'),('C'),('D') returning id`,
    );
    const ids = rows.map((r) => r.id);
    const pair = [ids[0], ids[1]].sort();
    await db.query(
      `insert into public.exclusions(person_a, person_b) values($1,$2)`,
      pair,
    );
    const invalid = ids.map((id, i) => ({
      giver_id: id,
      recipient_id: ids[(i + 1) % 4],
    }));
    await assert.rejects(
      db.query(`select public.save_exchange(2026,$1::jsonb)`, [
        JSON.stringify(invalid),
      ]),
      /excluded pair/,
    );
    const valid = ids.map((id, i) => ({
      giver_id: id,
      recipient_id: ids[(i + 2) % 4],
    }));
    await db.query(`select public.save_exchange(2026,$1::jsonb)`, [
      JSON.stringify(valid),
    ]);
    const saved = await db.query(`select * from public.assignments`);
    assert.equal(saved.rows.length, 4);
    await assert.rejects(
      db.query(`select public.save_exchange(2026,$1::jsonb)`, [
        JSON.stringify(valid),
      ]),
      /unique constraint/,
    );
    await assert.rejects(
      db.exec(`delete from public.assignments`),
      /permission denied/,
    );
    await db.query("select public.save_exchange(2027,$1::jsonb)", [
      JSON.stringify(valid),
    ]);
    const target = (
      await db.query<{ id: string }>(
        "select id from public.exchanges where year=2026",
      )
    ).rows[0].id;
    await db.exec(`set test.email='stranger@example.com'`);
    await assert.rejects(
      db.query("select public.delete_exchange($1)", [target]),
      /Organizer access/,
    );
    await db.exec(`set test.email='admin@example.com'`);
    await db.query("select public.delete_exchange($1)", [target]);
    assert.deepEqual(
      (await db.query("select year from public.exchanges")).rows,
      [{ year: 2027 }],
    );
    assert.equal(
      (await db.query("select * from public.assignments")).rows.length,
      4,
    );
    assert.equal(
      (await db.query("select * from public.people")).rows.length,
      4,
    );
    assert.equal(
      (await db.query("select * from public.exclusions")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.delete_exchange($1)", [target]),
      /already been deleted/,
    );
    await db.exec(`set test.email = 'stranger@example.com'`);
    assert.equal(
      (await db.query(`select * from public.people`)).rows.length,
      0,
    );
    assert.equal(
      (await db.query(`select * from public.assignments`)).rows.length,
      0,
    );
    await db.exec(`reset role; set role anon`);
    await assert.rejects(
      db.exec(`select * from public.people`),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
