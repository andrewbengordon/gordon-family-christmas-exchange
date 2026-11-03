import { randomInt } from "node:crypto";
export type Assignment = { giver_id: string; recipient_id: string };
export type HistoricalAssignment = Assignment & { year: number };
export type Exclusion = { person_a: string; person_b: string };
export function generateAssignments(
  ids: string[],
  exclusions: Exclusion[],
  previous: Assignment[] = [],
  history: HistoricalAssignment[] = [],
): Assignment[] {
  if (ids.length < 3) throw new Error("Choose at least three participants.");
  if (new Set(ids).size !== ids.length)
    throw new Error("Participants must be unique.");
  const blocked = new Set(
    exclusions.flatMap((e) => [
      `${e.person_a}:${e.person_b}`,
      `${e.person_b}:${e.person_a}`,
    ]),
  );
  previous.forEach((a) => blocked.add(`${a.giver_id}:${a.recipient_id}`));
  const years = [...new Set(history.map((a) => a.year))].sort((a, b) => a - b);
  const weights = new Map(years.map((year, i) => [year, i + 1]));
  const penalties = new Map<string, number>();
  for (const a of history) {
    const key = `${a.giver_id}:${a.recipient_id}`;
    penalties.set(key, (penalties.get(key) || 0) + weights.get(a.year)!);
  }
  // Lexicographic objective: minimize repeated pairs first, then favor less
  // frequent/older repeats. One extra repeat costs more than all tie-breakers.
  const repeatCost =
    ids.length * history.reduce((sum, a) => sum + weights.get(a.year)!, 0) + 1;
  const forbidden = 1e15;
  function shuffled(values: string[]) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  const givers = shuffled(ids),
    recipients = shuffled(ids),
    n = ids.length;
  const costs = givers.map((g) =>
    recipients.map((r) => {
      if (g === r || blocked.has(`${g}:${r}`)) return forbidden;
      const penalty = penalties.get(`${g}:${r}`) || 0;
      return penalty ? repeatCost + penalty : 0;
    }),
  );
  // Hungarian minimum-cost matching finds a globally optimal complete exchange.
  const u = Array(n + 1).fill(0),
    v = Array(n + 1).fill(0),
    p = Array(n + 1).fill(0),
    way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const min = Array(n + 1).fill(Infinity),
      used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity,
        j1 = 0;
      for (let j = 1; j <= n; j++)
        if (!used[j]) {
          const cost = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (cost < min[j]) {
            min[j] = cost;
            way[j] = j0;
          }
          if (min[j] < delta) {
            delta = min[j];
            j1 = j;
          }
        }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else min[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  return recipients.map((recipient_id, j) => {
    if (costs[p[j + 1] - 1][j] === forbidden)
      throw new Error(
        "No valid exchange is possible. Add participants, adjust exclusions, or turn off avoiding last year’s matches.",
      );
    return { giver_id: givers[p[j + 1] - 1], recipient_id };
  });
}
