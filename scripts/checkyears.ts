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
import { codexRows } from "../src/office/codex";
import {
  MAX_YEARS,
  addYear,
  clearYears,
  isRunId,
  loadBest,
  loadYears,
  mergeBest,
  mergeYears,
  newRunId,
  recordBest,
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
    getBest: () => Promise<unknown>;
    resetSave: () => Promise<unknown>;
  };
  return {
    server: load($global),
    set: (next: Record<string, unknown>) => void (state = next),
    get: () => state,
  };
};

console.log("\nthe book only counts what this year can meet");
{
  // an explicit empty table, not the registry: this section tests the gating
  // rule, and the registry changes every time a build is given a year
  const all = codexRows({}, 1, {});
  const lockStage07 = { stage07: 2 };
  const y1 = codexRows({}, 1, lockStage07);
  const y2 = codexRows({}, 2, lockStage07);
  const in07 = all.filter((r) => r.sceneId === "stage07").length;
  is(in07 > 0, `stage07 has faults to lock (${in07})`);
  is(y1.length === all.length - in07, "a build from a later year is not in year one's book");
  is(y1.every((r) => r.sceneId !== "stage07"), "not even one of its rows");
  is(y2.length === all.length, "and it is there from its own year");
  is(codexRows({}, 1, {}).length === all.length, "with nothing locked, year one's book is the whole book");

  const realY1 = codexRows({}, 1);
  const realY2 = codexRows({}, 2);
  is(realY1.every((r) => r.sceneId !== "stage08") && realY2.some((r) => r.sceneId === "stage08"),
     "and in the real registry, the mine's faults join the book in year two");
}

console.log("\nthe registry puts each new build in its own year");
{
  is(Object.keys(SCENE_YEAR).every((id) => /^stage\d{2}$/.test(id)),
     "every later build id passes the server's book pattern");
  is(!buildIdsFor(1).includes("stage08") && buildIdsFor(2).includes("stage08"),
     "the mine arrives in year two, and not before");
  is(!buildIdsFor(2).includes("stage09") && buildIdsFor(3).includes("stage09"),
     "the kitchen arrives in year three, and not before");
  is(!buildIdsFor(3).includes("stage10") && buildIdsFor(4).includes("stage10"),
     "the car park arrives in year four, and not before");
}

console.log("\nthe device keeps the best rating it has seen");
{
  clearYears();
  is(loadBest() === null, "nothing shipped yet, no best");
  is(recordBest(2.4) === null, "the first run has nothing to beat");
  is(loadBest() === 2.4, "and becomes the best");
  is(recordBest(1.1) === 2.4 && loadBest() === 2.4, "a worse run hands back the best and leaves it");
  is(recordBest(3.7) === 2.4 && loadBest() === 3.7, "a better run hands back the old best and replaces it");
  mergeBest(3.2);
  is(loadBest() === 3.7, "an account best below it changes nothing");
  mergeBest(4.5);
  is(loadBest() === 4.5, "an account best above it is taken");
  for (const junk of [null, "5", -1, 6, NaN, Infinity]) mergeBest(junk);
  is(loadBest() === 4.5, "and anything that is not a rating is ignored");
  store.set("fb_best_v1", "banana");
  is(loadBest() === null, "a corrupt store reads as no best");
  recordBest(1);
  clearYears();
  is(loadBest() === null, "the wipe takes the best with the years");
}

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
    const { server, set } = account();
    set({});
    is((await server.getBest()) === 0, "an account that never shipped has a best of 0");
    await server.reportRun(3.3);
    await server.reportRun(2);
    is((await server.getBest()) === 3.3, "the account hands back the best it kept");
    await server.resetSave();
    is((await server.getBest()) === 0, "and a wipe clears it");
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
