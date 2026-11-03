import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAssignments } from "../src/lib/matching";
test("assigns everyone once, with no self or couple matches across repeated draws", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const exclusions = [
    { person_a: "a", person_b: "b" },
    { person_a: "c", person_b: "d" },
  ];
  for (let i = 0; i < 100; i++) {
    const result = generateAssignments(ids, exclusions);
    assert.equal(new Set(result.map((a) => a.giver_id)).size, ids.length);
    assert.equal(new Set(result.map((a) => a.recipient_id)).size, ids.length);
    for (const a of result) {
      assert.notEqual(a.giver_id, a.recipient_id);
      assert.ok(
        !exclusions.some(
          (e) =>
            [e.person_a, e.person_b].includes(a.giver_id) &&
            [e.person_a, e.person_b].includes(a.recipient_id),
        ),
      );
    }
  }
});
test("avoids previous assignments", () => {
  const ids = ["a", "b", "c", "d"];
  const previous = generateAssignments(ids, []);
  const next = generateAssignments(ids, [], previous);
  assert.ok(
    next.every(
      (a) =>
        !previous.some(
          (p) => p.giver_id === a.giver_id && p.recipient_id === a.recipient_id,
        ),
    ),
  );
});
test("reports impossible restrictions and invalid participants", () => {
  assert.throws(
    () =>
      generateAssignments(
        ["a", "b", "c"],
        [
          { person_a: "a", person_b: "b" },
          { person_a: "a", person_b: "c" },
        ],
      ),
    /No valid/,
  );
  assert.throws(() => generateAssignments(["a", "b"], []), /at least three/);
  assert.throws(() => generateAssignments(["a", "b", "a"], []), /unique/);
});

test("avoids repeats across multiple years when a fresh matching exists", () => {
  const ids = ["a", "b", "c", "d"];
  const history = [1, 2].flatMap((offset, i) =>
    ids.map((giver_id, j) => ({
      giver_id,
      recipient_id: ids[(j + offset) % 4],
      year: 2024 + i,
    })),
  );
  const result = generateAssignments(ids, [], [], history);
  assert.ok(
    result.every(
      (a) =>
        !history.some(
          (h) => h.giver_id === a.giver_id && h.recipient_id === a.recipient_id,
        ),
    ),
  );
});
test("unavoidable repeats achieve a globally minimal repeat count and recency cost", () => {
  const ids = ["a", "b", "c", "d"];
  const history = [1, 2, 3].flatMap((offset, i) =>
    ids.map((giver_id, j) => ({
      giver_id,
      recipient_id: ids[(j + offset) % 4],
      year: 2023 + i,
    })),
  );
  // Every allowed pair has history: prefer the oldest complete matching.
  const result = generateAssignments(ids, [], [], history);
  for (const a of result)
    assert.equal(a.recipient_id, ids[(ids.indexOf(a.giver_id) + 1) % 4]);
  // Compare against exhaustive search on an asymmetric history, where greedy
  // choices can force another person into an unnecessary repeat.
  const asymmetric = history.filter((_, i) => i % 3 !== 0);
  function score(pairs: { giver_id: string; recipient_id: string }[]) {
    let repeats = 0,
      cost = 0;
    for (const a of pairs) {
      const past = asymmetric.filter(
        (h) => h.giver_id === a.giver_id && h.recipient_id === a.recipient_id,
      );
      repeats += Number(past.length > 0);
      cost += past.reduce((n, h) => n + h.year - 2022, 0);
    }
    return repeats * 1000 + cost;
  }
  let best = Infinity;
  function enumerate(chosen: string[]) {
    if (chosen.length === ids.length) {
      best = Math.min(
        best,
        score(
          ids.map((giver_id, i) => ({ giver_id, recipient_id: chosen[i] })),
        ),
      );
      return;
    }
    for (const r of ids)
      if (r !== ids[chosen.length] && !chosen.includes(r))
        enumerate([...chosen, r]);
  }
  enumerate([]);
  for (let i = 0; i < 30; i++)
    assert.equal(score(generateAssignments(ids, [], [], asymmetric)), best);
});
test("history preferences never relax hard previous-year or couple exclusions", () => {
  const ids = ["a", "b", "c"];
  const all = ids.flatMap((g) =>
    ids
      .filter((r) => r !== g)
      .map((r) => ({ giver_id: g, recipient_id: r, year: 2024 })),
  );
  const previous = [{ giver_id: "a", recipient_id: "b" }];
  const result = generateAssignments(ids, [], previous, all);
  assert.ok(!result.some((a) => a.giver_id === "a" && a.recipient_id === "b"));
  assert.throws(
    () =>
      generateAssignments(
        ids,
        [
          { person_a: "a", person_b: "b" },
          { person_a: "a", person_b: "c" },
        ],
        [],
        all,
      ),
    /No valid/,
  );
});
