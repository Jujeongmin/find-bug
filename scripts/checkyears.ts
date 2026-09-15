/**
 * The years: what a finished run opens, and what it must not change.
 *
 * No test framework here, so this is a script. It grows one section per task
 * of the plan in docs/superpowers/plans/2026-09-15-years-skeleton.md.
 *
 * Run: npx tsx scripts/checkyears.ts
 */
import {
  assignDay,
  buildIdsFor,
  YEAR_ONE_BUILDS,
  type LaterBuild,
} from "../src/office/schedule";
import { ENGINE_SCENES, SCENE_YEAR } from "../src/stages/registry";
import {
  MAX_YEARS,
  addYear,
  clearYears,
  isRunId,
  loadYears,
  mergeYears,
  newRunId,
  yearOf,
} from "../src/office/years";

/** a localStorage that exists, because node has none */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

const MACHINES = ["machineA", "machineB", "machineC", "machineD"] as const;
const isWeekend = (day: number) => (day - 1) % 7 >= 5;
const plan = (builds: readonly string[]) =>
  Array.from({ length: 12 }, (_, i) =>
    assignDay(i + 1, builds, MACHINES).map((a) => `${a.sceneId}:${a.severity}`)
  );

console.log("\nyear one is the schedule the game shipped with, to the letter");
{
  /* captured from Office.tsx before the move, 2026-09-15 */
  const GOLDEN = [
    ["stage07:low", "stage04:critical", "stage01:normal", "stage02:normal"],
    ["stage05:critical", "stage06:normal", "stage07:normal", "stage04:low"],
    ["stage02:normal", "stage03:normal", "stage05:low", "stage06:critical"],
    ["stage04:normal", "stage01:low", "stage02:critical", "stage03:normal"],
    ["stage06:critical", "stage07:critical", "stage04:normal", "stage01:normal"],
    ["stage03:critical", "stage05:normal", "stage06:normal", "stage07:low"],
    ["stage01:normal", "stage02:normal", "stage03:low", "stage05:critical"],
    ["stage07:normal", "stage04:low", "stage01:critical", "stage02:normal"],
    ["stage05:low", "stage06:critical", "stage07:normal", "stage04:normal"],
    ["stage02:critical", "stage03:normal", "stage05:normal", "stage06:low"],
    ["stage04:critical", "stage01:critical", "stage02:critical", "stage03:critical"],
    ["stage06:critical", "stage07:critical", "stage04:critical", "stage01:critical"],
  ];
  const got = plan(buildIdsFor(1));
  const off = got.findIndex((d, i) => JSON.stringify(d) !== JSON.stringify(GOLDEN[i]));
  is(off === -1, `all twelve days match${off === -1 ? "" : ` — day ${off + 1} is ${JSON.stringify(got[off])}`}`);
}

console.log("\nevery build belongs to exactly one year");
{
  const all = [...ENGINE_SCENES.map((s) => s.id), "stage04"];
  const nowhere = all.filter((id) => !YEAR_ONE_BUILDS.includes(id) && !(id in SCENE_YEAR));
  const twice = all.filter((id) => YEAR_ONE_BUILDS.includes(id) && id in SCENE_YEAR);
  const ghosts = YEAR_ONE_BUILDS.filter((id) => !all.includes(id));
  is(nowhere.length === 0, `no build is left out of the rotation${nowhere.length ? ` — ${nowhere.join(", ")}` : ""}`);
  is(twice.length === 0, `no build is in year one and a later year${twice.length ? ` — ${twice.join(", ")}` : ""}`);
  is(ghosts.length === 0, `year one names only builds that exist${ghosts.length ? ` — ${ghosts.join(", ")}` : ""}`);
}

console.log("\na later year adds its builds and every one of them reaches a machine");
{
  const later: LaterBuild[] = [
    { id: "stage08", year: 2 },
    { id: "stage09", year: 3 },
  ];
  is(JSON.stringify(buildIdsFor(1, later)) === JSON.stringify(YEAR_ONE_BUILDS), "year one ignores later builds");
  for (const year of [2, 3, 7]) {
    const builds = buildIdsFor(year, later);
    const seen = new Set<string>();
    let doubled = false;
    for (let d = 1; d <= 12; d++) {
      const day = assignDay(d, builds, MACHINES).map((a) => a.sceneId);
      if (new Set(day).size < day.length) doubled = true;
      if (!isWeekend(d)) day.forEach((id) => seen.add(id));
    }
    const missing = builds.filter((id) => !seen.has(id));
    is(missing.length === 0, `year ${year}: all ${builds.length} builds are queued on a working day${missing.length ? ` — never ${missing.join(", ")}` : ""}`);
    is(!doubled, `year ${year}: no day puts one build on two machines`);
  }
}

console.log("\nthe device keeps a set of finished runs, and the year is its size");
{
  store.clear();
  is(yearOf(loadYears()) === 1, "nothing finished is year one");

  const a = newRunId();
  const b = newRunId();
  is(isRunId(a) && isRunId(b) && a !== b, `run ids are well formed and distinct (${a}, ${b})`);

  addYear(a);
  is(yearOf(loadYears()) === 2, "one finished run is year two");
  addYear(a);
  is(loadYears().length === 1, "reporting the same run twice counts it once");

  mergeYears([b, "legacy-1", a]);
  is(yearOf(loadYears()) === 4, "a second device's runs are added, not maxed");

  mergeYears(["", "r123", "stage01/x", 42, null, "legacy-100"]);
  is(loadYears().length === 3, "ids that are not run ids are ignored");

  store.set("fb_years_v1", "not json");
  is(loadYears().length === 0, "an unreadable record is an empty one, not an exception");

  store.clear();
  const many = Array.from({ length: 120 }, () => newRunId());
  mergeYears(many);
  is(loadYears().length === MAX_YEARS, `the record stops at ${MAX_YEARS} runs`);
  is(yearOf(loadYears()) === 99, "and the year stops at 99");

  clearYears();
  is(loadYears().length === 0 && yearOf(loadYears()) === 1, "clearing goes back to year one");
}

console.log(bad ? `\n${bad} FAIL` : "\nthe years hold");
process.exitCode = bad ? 1 : 0;
