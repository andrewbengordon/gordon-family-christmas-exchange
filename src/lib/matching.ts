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
  // A reciprocal pair is a property of two assignments, so a simple edge
  // penalty cannot express it. Use Hungarian solutions as lower bounds while
  // branching on reciprocal pairs: forbid either direction, or retain both.
  function solve(matrix: number[][]) {
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
            const cost = matrix[i0 - 1][j - 1] - u[i0] - v[j];
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
    const chosen: number[] = Array(n);
    for (let j = 1; j <= n; j++) chosen[p[j] - 1] = j - 1;
    if (chosen.some((j, i) => matrix[i][j] === forbidden)) return null;
    return {
      chosen,
      cost: chosen.reduce((sum, j, i) => sum + matrix[i][j], 0),
    };
  }
  const giverIndex = new Map(givers.map((id, i) => [id, i]));
  let best: { chosen: number[]; reciprocal: number; cost: number } | null =
    null;
  function search(matrix: number[][], fixed: Set<number>, fixedCount: number) {
    const solution = solve(matrix);
    if (!solution) return;
    if (
      best &&
      (fixedCount > best.reciprocal ||
        (fixedCount === best.reciprocal && solution.cost >= best.cost))
    )
      return;
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const other = giverIndex.get(recipients[solution.chosen[i]])!;
      if (i < other && recipients[solution.chosen[other]] === givers[i])
        pairs.push([i, other]);
    }
    if (
      !best ||
      pairs.length < best.reciprocal ||
      (pairs.length === best.reciprocal && solution.cost < best.cost)
    ) {
      best = { ...solution, reciprocal: pairs.length };
    }
    const pair = pairs.find(([i]) => !fixed.has(i));
    if (!pair) return;
    const [a, b] = pair;
    // These three branches cover every valid exchange, including cases where
    // reciprocal assignments are unavoidable under the hard restrictions.
    for (const row of [a, b]) {
      const next = matrix.map((values) => [...values]);
      next[row][solution.chosen[row]] = forbidden;
      search(next, fixed, fixedCount);
    }
    const next = matrix.map((values) => [...values]);
    for (const row of [a, b]) {
      const col = solution.chosen[row];
      for (let k = 0; k < n; k++) {
        if (k !== col) next[row][k] = forbidden;
        if (k !== row) next[k][col] = forbidden;
      }
    }
    search(next, new Set([...fixed, a, b]), fixedCount + 1);
  }
  search(costs, new Set(), 0);
  // TypeScript does not track assignments inside the recursive search.
  const result = best as {
    chosen: number[];
    reciprocal: number;
    cost: number;
  } | null;
  if (!result)
    throw new Error(
      "No valid exchange is possible. Add participants, adjust exclusions, or turn off avoiding last year’s matches.",
    );
  return givers.map((giver_id, i) => ({
    giver_id,
    recipient_id: recipients[result.chosen[i]],
  }));
}
