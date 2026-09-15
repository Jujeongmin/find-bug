/**
 * The years: what a finished run opens, and what it must not change.
 *
 * No test framework here, so this is a script. It grows one section per task
 * of the plan in docs/superpowers/plans/2026-09-15-years-skeleton.md.
 *
 * Run: npx tsx scripts/checkyears.ts
 */
import { readFileSync } from "node:fs";
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

/** server.js, loaded the way the platform loads it, against a fake account */
const account = () => {
  let state: Record<string, unknown> = {};
  const $global = {
    getMyState: async () => JSON.parse(JSON.stringify(state)),
    updateMyState: async (patch: Record<string, unknown>) => {
      state = { ...state, ...patch };
    },
  };
  const src = readFileSync("server.js", "utf8");
  const load = new Function("$global", `${src}\nreturn new Server();`) as (
    g: typeof $global
  ) => {
    syncYears: (ids: unknown) => Promise<string[]>;
    reportRun: (rating: number) => Promise<unknown>;
    resetSave: () => Promise<unknown>;
  };
  return {
    server: load($global),
    set: (next: Record<string, unknown>) => void (state = next),
    get: () => state,
  };
};

await (async () => {
  console.log("\nthe account keeps the same set, and counts the runs from before ids");

  {
    const { server, set, get } = account();
    set({ runs: 3 });
    const first = await server.syncYears([]);
    is(first.length === 3 && first[0] === "legacy-1", `three runs from before become three legacy ids (${first.join(",")})`);
    set({ ...get(), runs: 4 });
    const again = await server.syncYears([]);
    is(again.length === 3, "and the migration happens once — a later runs count adds nothing");
  }

  {
    const { server, set } = account();
    set({ runs: 4 });
    const got = await server.syncYears(["r0a1b2c3d4e5f"]);
    is(got.length === 4, `a run reported before the first sync is not counted twice (${got.join(",")})`);
    is(yearOf(got) === 5, "which makes it year five");
  }

  {
    const { server } = account();
    await server.syncYears(["r000000000001"]);
    const both = await server.syncYears(["r000000000002"]);
    is(both.length === 2, "two devices' runs are a union");
    const dup = await server.syncYears(["r000000000001"]);
    is(dup.length === 2, "and the same run twice is still one");
    const junk = await server.syncYears(["stage01/x", 7, "r12", null]);
    is(junk.length === 2, "ids that are not run ids are refused");
  }

  {
    const { server } = account();
    const many = Array.from({ length: 120 }, (_, i) => `r${String(i).padStart(12, "0")}`);
    const got = await server.syncYears(many);
    is(got.length === 99, "the account stops at 99 runs too");
  }

  {
    const { server, set, get } = account();
    set({ runs: 5, finished: ["r000000000001"] });
    await server.resetSave();
    is(Array.isArray(get().finished) && (get().finished as unknown[]).length === 0, "a wipe empties the finished set");
    const after = await server.syncYears([]);
    is(after.length === 0, "and does not migrate the old count back in");
  }
})();

console.log(bad ? `\n${bad} FAIL` : "\nthe years hold");
process.exitCode = bad ? 1 : 0;
