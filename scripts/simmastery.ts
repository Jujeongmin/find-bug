/**
 * How many runs it takes to master every build — a report, not a check.
 *
 * Plays runs on paper: the real schedule, the real fault pools, and the real
 * dealing rule (uncaught faults first). The player is a number: how many
 * builds a day they can pay condition for, and how often a report is right.
 * Mastered builds cost nothing, so they are always inspected.
 *
 * Run: npx tsx scripts/simmastery.ts
 */
import { assignDay, buildIdsFor } from "../src/office/schedule";
import { codexRows } from "../src/office/codex";
import { MACHINES } from "../src/office/scene";

const DAYS = 12;
const WORK_DAYS = Array.from({ length: DAYS }, (_, i) => i + 1).filter((d) => (d - 1) % 7 < 5);
const ALL = buildIdsFor(Number.MAX_SAFE_INTEGER);

/** every build's faults, from the book's own rows */
const POOL = new Map<string, string[]>();
for (const r of codexRows({}, Number.MAX_SAFE_INTEGER)) {
  POOL.set(r.sceneId, [...(POOL.get(r.sceneId) ?? []), r.bugId]);
}

/** a small seeded generator, so a report can be run twice and agree */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Player {
  /** builds a day they have condition for: 3 without the coffee, 4 with */
  paid: number;
  /** chance a report is right */
  accuracy: number;
  /** deal uncaught faults first, as the game does */
  prefer: boolean;
}

/** runs until every build is mastered, and the run each build was mastered in */
function play(p: Player, seed: number, cap = 60) {
  const rand = rng(seed);
  const caught = new Map<string, Set<string>>(ALL.map((b) => [b, new Set()]));
  const masteredAt = new Map<string, number>();
  const mastered = (b: string) => caught.get(b)!.size === POOL.get(b)!.length;
  for (let run = 1; run <= cap; run++) {
    const builds = buildIdsFor(run);
    for (const day of WORK_DAYS) {
      let budget = p.paid;
      for (const a of assignDay(day, builds, MACHINES)) {
        const free = mastered(a.sceneId);
        if (!free) {
          if (budget <= 0) continue;
          budget--;
        }
        const pool = POOL.get(a.sceneId)!;
        const open = pool.filter((f) => !caught.get(a.sceneId)!.has(f));
        const from = p.prefer && open.length ? open : pool;
        const fault = from[Math.floor(rand() * from.length)];
        if (rand() < p.accuracy) {
          caught.get(a.sceneId)!.add(fault);
          if (mastered(a.sceneId) && !masteredAt.has(a.sceneId)) masteredAt.set(a.sceneId, run);
        }
      }
    }
    if (ALL.every(mastered)) return { runs: run, masteredAt };
  }
  return { runs: Infinity, masteredAt };
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const TRIALS = 300;
console.log(`builds ${ALL.length}, faults ${[...POOL.values()].reduce((n, f) => n + f.length, 0)}`);
console.log(ALL.map((b) => `${b}:${POOL.get(b)!.length}`).join("  "));
console.log("\nruns to master every build (median / 90th percentile)");
for (const prefer of [true, false]) {
  for (const paid of [3, 4]) {
    for (const accuracy of [0.6, 0.8, 1]) {
      const runs: number[] = [];
      const firstAt: number[] = [];
      const perBuild = new Map<string, number[]>();
      for (let t = 0; t < TRIALS; t++) {
        const r = play({ paid, accuracy, prefer }, 1000 + t);
        runs.push(r.runs);
        firstAt.push(Math.min(...r.masteredAt.values()));
        for (const [b, at] of r.masteredAt) perBuild.set(b, [...(perBuild.get(b) ?? []), at]);
      }
      const slowest = [...perBuild].map(([b, xs]) => [b, pct(xs, 0.5)] as const).sort((a, b) => b[1] - a[1])[0];
      console.log(
        `${prefer ? "prefer" : "random"}  ${paid}/day  right ${Math.round(accuracy * 100)}%  ` +
          `all: ${pct(runs, 0.5)} / ${pct(runs, 0.9)}  first: ${pct(firstAt, 0.5)}  ` +
          `slowest build: ${slowest[0]} (${slowest[1]})`
      );
    }
  }
}

console.log("\nthe run each rank is reached in (median), accurate 80%");
for (const paid of [3, 4]) {
  const at = new Map<number, number[]>();
  for (let t = 0; t < TRIALS; t++) {
    const order = [...play({ paid, accuracy: 0.8, prefer: true }, 5000 + t).masteredAt.values()].sort((a, b) => a - b);
    for (const k of [1, 3, 6, ALL.length]) at.set(k, [...(at.get(k) ?? []), order[k - 1] ?? Infinity]);
  }
  console.log(`${paid}/day  ` + [...at].map(([k, xs]) => `${k} mastered: run ${pct(xs, 0.5)}`).join("  "));
}
