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
    return reciprocalCount(pairs) * 1000000 + repeats * 1000 + cost;
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

function reciprocalCount(pairs: { giver_id: string; recipient_id: string }[]) {
  const recipients = new Map(pairs.map((p) => [p.giver_id, p.recipient_id]));
  return (
    pairs.filter((p) => recipients.get(p.recipient_id) === p.giver_id).length /
    2
  );
}
test("avoids reciprocal assignments even when all non-reciprocal choices repeat history", () => {
  const ids = ["a", "b", "c", "d"];
  const fresh = new Map([
    ["a", "b"],
    ["b", "a"],
    ["c", "d"],
    ["d", "c"],
  ]);
  const history = ids.flatMap((giver_id) =>
    ids
      .filter((r) => r !== giver_id && fresh.get(giver_id) !== r)
      .map((recipient_id) => ({ giver_id, recipient_id, year: 2025 })),
  );
  for (let i = 0; i < 30; i++)
    assert.equal(reciprocalCount(generateAssignments(ids, [], [], history)), 0);
});
test("allows reciprocal assignments when hard restrictions require them", () => {
  const ids = ["a", "b", "c", "d"];
  const exclusions = ["a", "b"].flatMap((person_a) =>
    ["c", "d"].map((person_b) => ({ person_a, person_b })),
  );
  const result = generateAssignments(ids, exclusions);
  assert.equal(reciprocalCount(result), 2);
  assert.equal(new Set(result.map((p) => p.recipient_id)).size, 4);
  const previous = [{ giver_id: "a", recipient_id: "b" }];
  assert.throws(
    () => generateAssignments(ids, exclusions, previous),
    /No valid/,
  );
});
test("matches exhaustive optimum for reciprocal pairs, history repeats, and recency under hard rules", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  for (let scenario = 0; scenario < 20; scenario++) {
    const all = ids.flatMap((giver_id, g) =>
      ids
        .filter((r) => r !== giver_id)
        .map((recipient_id) => ({
          giver_id,
          recipient_id,
          year: 2023 + ((g + ids.indexOf(recipient_id)) % 3),
        })),
    );
    const history = all.filter((_, i) => (i + scenario) % 4 !== 0);
    const previous = all.filter((_, i) => (i + scenario) % 7 === 0);
    const exclusions = scenario % 2 ? [{ person_a: "a", person_b: "c" }] : [];
    function score(pairs: { giver_id: string; recipient_id: string }[]) {
      const matches = pairs.map((p) =>
        history.filter(
          (h) => h.giver_id === p.giver_id && h.recipient_id === p.recipient_id,
        ),
      );
      return (
        reciprocalCount(pairs) * 1000000 +
        matches.filter((m) => m.length).length * 1000 +
        matches.flat().reduce((s, h) => s + h.year - 2022, 0)
      );
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
      const g = ids[chosen.length];
      for (const r of ids)
        if (
          r !== g &&
          !chosen.includes(r) &&
          !previous.some((p) => p.giver_id === g && p.recipient_id === r) &&
          !exclusions.some(
            (e) =>
              [e.person_a, e.person_b].includes(g) &&
              [e.person_a, e.person_b].includes(r),
          )
        )
          enumerate([...chosen, r]);
    }
    enumerate([]);
    for (let trial = 0; trial < 3; trial++) {
      if (best === Infinity)
        assert.throws(
          () => generateAssignments(ids, exclusions, previous, history),
          /No valid/,
        );
      else
        assert.equal(
          score(generateAssignments(ids, exclusions, previous, history)),
          best,
          `scenario ${scenario}`,
        );
    }
  }
});
