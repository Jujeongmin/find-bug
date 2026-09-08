# Run Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 12-day run survives a refresh, a killed tab, and a change of device, by saving itself to localStorage and to the Verse8 account.

**Architecture:** A new `src/office/run.ts` owns the run's shape (`RunFields`), its validation, and its two stores — localStorage synchronously, the account through debounced remote calls. `Office.tsx` splits into a thin boot gate (`Office`) that resolves which snapshot to start from, and the existing body (`OfficeRun`) which takes that snapshot as a prop and feeds every `useState` initialiser from it. One `useEffect`, keyed on a JSON string of the run, writes it back whenever no build is running. `server.js` gains three remote functions and a field-by-field validator.

**Tech Stack:** React 18, TypeScript, Vite, `@agent8/gameserver`, tsx check scripts run by `npm run verify`.

## Global Constraints

- Branch is `develop`. `main` is not used.
- React stays pinned at 18 (`@agent8/gameserver@1.10.2` peers on `^18.2.0`).
- No unit-test framework exists. Every test in this plan is a `tsx` script under `scripts/`, printing `PASS`/`FAIL` lines and exiting non-zero on failure, wired into `npm run verify`.
- `server.js` defines `class Server` and never exports it — the platform picks it up by name. Do not add `export`. Nothing at its top level may run on load.
- Anything a client sends the server is untrusted: validate field by field, cap the size.
- A broken or unreadable save must never stop the game from opening. Fall through to a new run.
- The real purchase (`adsRemoved`) is never cleared by any path in this plan.
- Snapshot version is `1`. A snapshot whose `v` is not `1` is discarded.
- The account write is debounced by `1500` ms. The boot wait for the account is capped at `2000` ms.
- Comments in this codebase explain *why*, in prose, in English. Match that. Commit subjects are sentences, not `feat:` prefixes — read `git log` for the register.
- Every task ends with a commit **and a push** to `develop`. Work that stops at the commit has not gone out.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/office/run.ts` (create) | `RunFields`/`RunSnapshot` types, the four run-state types moved out of `Office.tsx`, validation, localStorage IO, account IO |
| `server.js` (modify) | `RUN_FIELDS` validation table, `sanitiseRun`, the `saveRun`/`getRun`/`clearRun` methods, `resetSave` also clearing `run` |
| `src/office/Office.tsx` (modify) | split into boot gate + `OfficeRun`; initialisers read `boot`; the autosave effect |
| `src/components/Settings.tsx` (modify) | wiping drops the run and reopens the page |
| `scripts/checkrun.ts` (create) | every test in this plan |
| `package.json` (modify) | `checkrun.ts` in `verify` |

---

## Task 1: The run's shape, its validation, and localStorage

**Files:**
- Create: `src/office/run.ts`
- Modify: `src/office/Office.tsx` (remove four type declarations, import them instead)
- Create: `scripts/checkrun.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Severity` from `./rating`, `MachineId` from `./scene`.
- Produces:
  - `type Place = "office" | "home" | "lane" | "street"`
  - `type Arrival = "wake" | "home" | "lane" | "street" | "office"`
  - `type ItemId = "magnifier" | "chair" | "alarm" | "shoes" | "thermos" | "retest"`
  - `interface Assignment { machine: MachineId; sceneId: string; severity: Severity; result: null | "caught" | "missed"; hotfix?: boolean; bugId: string | null }`
  - `interface RunFields` — the 35 fields listed in Step 2
  - `type RunSnapshot = { v: number; updatedAt: number } & Partial<RunFields>`
  - `const RUN_VERSION = 1`
  - `function parseRun(raw: unknown): RunSnapshot | null`
  - `function readRun(): RunSnapshot | null`
  - `function writeRun(fields: RunFields): RunSnapshot`
  - `function dropRun(): void`
  - `function newer(a: RunSnapshot | null, b: RunSnapshot | null): RunSnapshot | null`

- [ ] **Step 1: Move the four run-state types out of `Office.tsx`**

Delete these from `src/office/Office.tsx` (near lines 158-165, 377-383, and 411-430) and add to its imports:

```ts
import type { Assignment, ItemId, Place, Arrival } from "./run";
```

The declarations to delete, verbatim — the doc comments above `Assignment` and above `type Place` move to `run.ts` with them:

```ts
type Place = "office" | "home" | "lane" | "street";
type Arrival = "wake" | "home" | "lane" | "street" | "office";
```

```ts
type ItemId =
  | "magnifier"
  | "chair"
  | "alarm"
  | "shoes"
  | "thermos"
  | "retest";
```

and the whole `interface Assignment { ... }` block.

- [ ] **Step 2: Write `src/office/run.ts`**

```ts
import type { Severity } from "./rating";
import type { MachineId } from "./scene";

/**
 * A twelve-day run, written down.
 *
 * The book in codex.ts is the record of everything the player has ever found,
 * across every run; this is the run they are in the middle of. They are kept
 * apart on purpose. A book is merged — two devices are two partial books, and
 * catching something never un-catches it — and a run cannot be: there is one
 * eighth day, and it is either the phone's or this one's.
 *
 * It used to live nowhere at all. Every field here was a useState in Office.tsx
 * and nothing else, so a refresh, or a phone deciding a backgrounded tab was
 * worth more as memory, put the player back at day one with nothing. In a game
 * that takes money for anything, that is not an inconvenience.
 */

/** the four rooms a working day is made of, and the door each was entered by */
export type Place = "office" | "home" | "lane" | "street";
export type Arrival = "wake" | "home" | "lane" | "street" | "office";

export type ItemId =
  | "magnifier"
  | "chair"
  | "alarm"
  | "shoes"
  | "thermos"
  | "retest";

export interface Assignment {
  machine: MachineId;
  sceneId: string;
  severity: Severity;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
  /**
   * A weekend build. Catching one takes back the worst thing that already
   * shipped — but only once the developer has it, because a fix nobody was
   * told about is not a fix.
   */
  hotfix?: boolean;
  /**
   * Which defect is in this build. Decided the first time the machine is
   * opened and kept from then on, so stepping away and coming back finds the
   * same build rather than a freshly rolled one. It is also what makes an
   * interrupted build cost only half a build: the snapshot remembers which
   * one was in there.
   */
  bugId: string | null;
}

/**
 * Everything that makes up a run in progress.
 *
 * What is not here is as deliberate as what is. `running`, `note`, `codex`,
 * `offer`, `shop`, `watching` and `night` are screen state: coming back to a
 * modal that is already open, or to a build that is half-played, does not read
 * as resuming — it reads as a fault.
 */
export interface RunFields {
  day: number;
  assignments: Assignment[];
  pending: Assignment[];
  delivered: number;
  late: Severity[];
  shipped_: Severity[];
  caught: number;
  missed: number;
  minutes: number;
  condition: number;
  spirit: number;
  borrowed: number;
  pay: number;
  owned: ItemId[];
  place: Place;
  from: Arrival;
  officeAt: { x: number; y: number } | null;
  dayOver: boolean;
  hadCoffee: boolean;
  greeted: Record<string, number>;
  talks: number;
  lastResult: null | "caught" | "missed";
  overtime: number;
  tookOvertime: boolean;
  tookFreeCoffee: boolean;
  workedWeekend: boolean;
  hobbyDone: boolean;
  ateOut: boolean;
  devCoffee: boolean;
  devCame: boolean;
  retestUsed: boolean;
  restedTonight: boolean;
  earlyTomorrow: boolean;
  pochaNights: number;
  dinnerAsked: boolean;
  /**
   * How full the book was when this run began.
   *
   * The easiest of the thirty-five to leave out, and the ship screen is wrong
   * without it: "found this run" is this number subtracted from the book as it
   * stands. Restore into a fresh zero and twelve days of work reads as nothing
   * found at all.
   */
  codexAtStart: number;
}

/**
 * A stored run: the fields, plus how to read them and when they were written.
 *
 * The fields are optional because a save written by an older build will not
 * have the ones added since. A missing field falls back to the value the
 * component would have used anyway, which is what makes most additions cost
 * nothing. Only a change of meaning needs the version bumped.
 */
export type RunSnapshot = { v: number; updatedAt: number } & Partial<RunFields>;

export const RUN_VERSION = 1;
const KEY = "fb_run";

const PLACES: readonly Place[] = ["office", "home", "lane", "street"];
const ARRIVALS: readonly Arrival[] = [
  "wake",
  "home",
  "lane",
  "street",
  "office",
];
const ITEMS: readonly ItemId[] = [
  "magnifier",
  "chair",
  "alarm",
  "shoes",
  "thermos",
  "retest",
];
const SEVERITIES: readonly Severity[] = ["low", "normal", "critical"];
const MACHINE_IDS: readonly MachineId[] = [
  "machineA",
  "machineB",
  "machineC",
  "machineD",
];
const RESULTS = [null, "caught", "missed"] as const;

/** a working day holds four machines; a queue longer than this is not ours */
const MAX_LIST = 64;
/** the passers on one walk, times twelve days, with room to spare */
const MAX_GREETED = 64;

const int = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi
    ? v
    : undefined;

const bool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;

const oneOf = <T extends string>(
  v: unknown,
  all: readonly T[]
): T | undefined => (all.includes(v as T) ? (v as T) : undefined);

const listOf = <T>(v: unknown, each: (x: unknown) => T | undefined) => {
  if (!Array.isArray(v) || v.length > MAX_LIST) return undefined;
  const out: T[] = [];
  for (const x of v) {
    const one = each(x);
    if (one === undefined) return undefined;
    out.push(one);
  }
  return out;
};

const assignment = (v: unknown): Assignment | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  const machine = oneOf(a.machine, MACHINE_IDS);
  const severity = oneOf(a.severity, SEVERITIES);
  if (!machine || !severity) return undefined;
  if (typeof a.sceneId !== "string" || a.sceneId.length > 32) return undefined;
  if (!RESULTS.includes(a.result as (typeof RESULTS)[number])) return undefined;
  if (a.bugId !== null && (typeof a.bugId !== "string" || a.bugId.length > 64))
    return undefined;
  const out: Assignment = {
    machine,
    sceneId: a.sceneId,
    severity,
    result: a.result as Assignment["result"],
    bugId: a.bugId as string | null,
  };
  if (a.hotfix === true) out.hotfix = true;
  return out;
};

const greetedMap = (v: unknown): Record<string, number> | undefined => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  let n = 0;
  for (const [id, times] of Object.entries(v as Record<string, unknown>)) {
    if (n++ >= MAX_GREETED) return undefined;
    if (id.length > 40) return undefined;
    const c = int(times, 0, 999);
    if (c === undefined) return undefined;
    out[id] = c;
  }
  return out;
};

const spot = (v: unknown): { x: number; y: number } | null | undefined => {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  if (typeof p.x !== "number" || !Number.isFinite(p.x)) return undefined;
  if (typeof p.y !== "number" || !Number.isFinite(p.y)) return undefined;
  return { x: p.x, y: p.y };
};

/** drop one wrong field rather than the whole run it was written in */
const put = <K extends keyof RunFields>(
  out: RunSnapshot,
  key: K,
  value: RunFields[K] | undefined
) => {
  if (value !== undefined) out[key] = value;
};

/**
 * Whatever was stored, reduced to a run this build understands.
 *
 * A wrong field is dropped and the component's own default takes its place. A
 * wrong version, or something that is not an object at all, is no run. Nothing
 * in here throws, because the one outcome that must never happen is a saved
 * game that stops the game from opening.
 */
export function parseRun(raw: unknown): RunSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== RUN_VERSION) return null;
  const updatedAt = int(r.updatedAt, 0, Number.MAX_SAFE_INTEGER);
  if (updatedAt === undefined) return null;
  const out: RunSnapshot = { v: RUN_VERSION, updatedAt };
  put(out, "day", int(r.day, 1, 12));
  put(out, "assignments", listOf(r.assignments, assignment));
  put(out, "pending", listOf(r.pending, assignment));
  put(out, "delivered", int(r.delivered, 0, 999));
  put(out, "late", listOf(r.late, (x) => oneOf(x, SEVERITIES)));
  put(out, "shipped_", listOf(r.shipped_, (x) => oneOf(x, SEVERITIES)));
  put(out, "caught", int(r.caught, 0, 999));
  put(out, "missed", int(r.missed, 0, 999));
  put(out, "minutes", int(r.minutes, 0, 24 * 60));
  put(out, "condition", int(r.condition, 0, 9));
  put(out, "spirit", int(r.spirit, 0, 9));
  put(out, "borrowed", int(r.borrowed, 0, 9));
  put(out, "pay", int(r.pay, 0, 999999));
  put(out, "owned", listOf(r.owned, (x) => oneOf(x, ITEMS)));
  put(out, "place", oneOf(r.place, PLACES));
  put(out, "from", oneOf(r.from, ARRIVALS));
  put(out, "officeAt", spot(r.officeAt));
  put(out, "dayOver", bool(r.dayOver));
  put(out, "hadCoffee", bool(r.hadCoffee));
  put(out, "greeted", greetedMap(r.greeted));
  put(out, "talks", int(r.talks, 0, 999));
  put(
    out,
    "lastResult",
    RESULTS.includes(r.lastResult as (typeof RESULTS)[number])
      ? (r.lastResult as RunFields["lastResult"])
      : undefined
  );
  put(out, "overtime", int(r.overtime, 0, 24 * 60));
  put(out, "tookOvertime", bool(r.tookOvertime));
  put(out, "tookFreeCoffee", bool(r.tookFreeCoffee));
  put(out, "workedWeekend", bool(r.workedWeekend));
  put(out, "hobbyDone", bool(r.hobbyDone));
  put(out, "ateOut", bool(r.ateOut));
  put(out, "devCoffee", bool(r.devCoffee));
  put(out, "devCame", bool(r.devCame));
  put(out, "retestUsed", bool(r.retestUsed));
  put(out, "restedTonight", bool(r.restedTonight));
  put(out, "earlyTomorrow", bool(r.earlyTomorrow));
  put(out, "pochaNights", int(r.pochaNights, 0, 99));
  put(out, "dinnerAsked", bool(r.dinnerAsked));
  put(out, "codexAtStart", int(r.codexAtStart, 0, 999));
  return out;
}

/** the run on this device, or nothing */
export function readRun(): RunSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parseRun(JSON.parse(raw));
  } catch {
    /* unreadable, unparseable, or a browser that will not store at all */
    return null;
  }
}

/** write it down here and now; the account copy is somebody else's job */
export function writeRun(fields: RunFields): RunSnapshot {
  const snap: RunSnapshot = { v: RUN_VERSION, updatedAt: Date.now(), ...fields };
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* a full or refusing store still leaves the run playable in memory */
  }
  return snap;
}

export function dropRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to be done about a store that will not forget */
  }
}

/**
 * Of two copies of a run, the one written last.
 *
 * The rule has to be a single rule, because nobody is going to be asked. A tie
 * goes to the first argument, which is always the local one: same instant,
 * same run, no reason to prefer the copy that came over a wire.
 */
export function newer(
  a: RunSnapshot | null,
  b: RunSnapshot | null
): RunSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}
```

- [ ] **Step 3: Write the failing test**

Create `scripts/checkrun.ts`:

```ts
/**
 * The run that is meant to survive a dead tab.
 *
 * There is no test framework here, so this is a script: it exercises the parts
 * of run.ts that need no browser, and reads Office.tsx and server.js as text
 * for the parts that do.
 *
 * The check that matters most is the dullest — that every field written is
 * also read back. The account has carried a `best` and a `runs` for some time
 * that nothing has ever asked for, which is exactly the mistake thirty-five
 * fields invite.
 */
import { parseRun, RUN_VERSION, type RunFields } from "../src/office/run";

let bad = 0;
const ok = (msg: string) => console.log(`PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`FAIL  ${msg}`);
  bad++;
};
const is = (cond: boolean, msg: string) => (cond ? ok(msg) : fail(msg));

/** a complete run, the sort Office hands to writeRun */
const FULL: RunFields = {
  day: 8,
  assignments: [
    {
      machine: "machineB",
      sceneId: "stage06",
      severity: "critical",
      result: null,
      bugId: "floating:targetA",
    },
  ],
  pending: [],
  delivered: 4,
  late: ["low"],
  shipped_: ["normal", "critical"],
  caught: 11,
  missed: 3,
  minutes: 14 * 60 + 30,
  condition: 2,
  spirit: 4,
  borrowed: 1,
  pay: 640,
  owned: ["magnifier", "chair"],
  place: "street",
  from: "lane",
  officeAt: { x: 120, y: 300 },
  dayOver: false,
  hadCoffee: true,
  greeted: { passer1: 2 },
  talks: 5,
  lastResult: "caught",
  overtime: 30,
  tookOvertime: true,
  tookFreeCoffee: false,
  workedWeekend: false,
  hobbyDone: true,
  ateOut: false,
  devCoffee: true,
  devCame: true,
  retestUsed: false,
  restedTonight: true,
  earlyTomorrow: false,
  pochaNights: 2,
  dinnerAsked: true,
  codexAtStart: 37,
};

console.log("\na run survives being written down and read back");
{
  const wire = { v: RUN_VERSION, updatedAt: 1_700_000_000_000, ...FULL };
  const back = parseRun(JSON.parse(JSON.stringify(wire)));
  if (!back) {
    fail("a complete run parses");
  } else {
    ok("a complete run parses");
    const lost = (Object.keys(FULL) as (keyof RunFields)[]).filter(
      (k) => JSON.stringify(back[k]) !== JSON.stringify(FULL[k])
    );
    is(
      lost.length === 0,
      `every field comes back unchanged${lost.length ? ` — lost ${lost.join(", ")}` : ""}`
    );
  }
}

console.log("\na broken save is no run, and never an exception");
for (const [what, raw] of [
  ["null", null],
  ["a string", "day 8"],
  ["an empty object", {}],
  ["the wrong version", { v: RUN_VERSION + 1, updatedAt: 1, day: 8 }],
  ["no timestamp", { v: RUN_VERSION, day: 8 }],
] as const) {
  let threw = false;
  let out: unknown;
  try {
    out = parseRun(raw);
  } catch {
    threw = true;
  }
  is(!threw && out === null, `${what} is refused without throwing`);
}

console.log("\na wrong field is dropped, and the rest of the run is kept");
{
  const back = parseRun({
    v: RUN_VERSION,
    updatedAt: 1,
    day: 99,
    pay: "lots",
    owned: ["magnifier", "spaceship"],
    condition: 2,
    place: "street",
  });
  is(back !== null, "the run still parses");
  is(back?.day === undefined, "a day outside 1-12 is dropped");
  is(back?.pay === undefined, "pay that is not a number is dropped");
  is(back?.owned === undefined, "a list holding an unknown item is dropped");
  is(back?.condition === 2, "the fields either side of it survive");
  is(back?.place === "street", "and so does the room");
}

if (bad) {
  console.log(`\n${bad} failed`);
  process.exit(1);
}
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected before Step 2 exists: a module-not-found error for `../src/office/run`. If `run.ts` is already in place, break it deliberately — change `int(r.day, 1, 12)` to `int(r.day, 1, 999)` — and confirm `a day outside 1-12 is dropped` reports FAIL and the exit code is 1. Then put it back.

- [ ] **Step 5: Wire it into verify**

In `package.json`, append to the `verify` script, after `checkcategories.ts`:

```
 && tsx scripts/checkrun.ts
```

- [ ] **Step 6: Run the whole suite**

```bash
npm run verify
```

Expected: every existing PASS still passes, plus the new ones, and `tsc -b` is clean now that `Office.tsx` imports its four types from `./run`.

- [ ] **Step 7: Commit and push**

```bash
git add -A && git commit -m "The shape of a run, and somewhere on this device to put it" && git push origin develop
```

---

## Task 2: The account's copy

**Files:**
- Modify: `server.js`
- Modify: `scripts/checkrun.ts`

**Interfaces:**
- Consumes: `RunFields` and `RUN_VERSION` from Task 1, by name only — `server.js` cannot import from `src/`, so the field list is repeated there and Step 4's test is what keeps the two in step.
- Produces, callable as `server.remoteFunction(name, [args])`:
  - `saveRun(snapshot) -> { ok: true } | { ok: false }`
  - `getRun() -> RunSnapshot | null`
  - `clearRun() -> true`
  - `resetSave()` now also clears `run`.

- [ ] **Step 1: Add the validator and the three methods to `server.js`**

Add near the other constants at the top of the file:

```js
/**
 * What a stored run is allowed to look like.
 *
 * This repeats the field list in src/office/run.ts, and it has to: the
 * platform loads this file on its own and it can import nothing from the
 * client bundle. The two lists drifting apart is the failure mode — a field
 * added on the client and not here is silently dropped on every save, and the
 * player loses it on the next device. scripts/checkrun.ts compares them.
 *
 * "n" is a whole number in a range, "b" a boolean, "s" one of a set, and the
 * four shaped fields have their own checkers. Anything else is left out of
 * what gets stored; a run missing a field falls back to the client's default,
 * which is the same thing an older save does.
 */
const RUN_VERSION = 1;
const MAX_RUN_BYTES = 8192;
const RUN_LIST = 64;

const RUN_FIELDS = {
  day: ["n", 1, 12],
  assignments: ["assignments"],
  pending: ["assignments"],
  delivered: ["n", 0, 999],
  late: ["severities"],
  shipped_: ["severities"],
  caught: ["n", 0, 999],
  missed: ["n", 0, 999],
  minutes: ["n", 0, 1440],
  condition: ["n", 0, 9],
  spirit: ["n", 0, 9],
  borrowed: ["n", 0, 9],
  pay: ["n", 0, 999999],
  owned: ["items"],
  place: ["s", ["office", "home", "lane", "street"]],
  from: ["s", ["wake", "home", "lane", "street", "office"]],
  officeAt: ["spot"],
  dayOver: ["b"],
  hadCoffee: ["b"],
  greeted: ["greeted"],
  talks: ["n", 0, 999],
  lastResult: ["s", [null, "caught", "missed"]],
  overtime: ["n", 0, 1440],
  tookOvertime: ["b"],
  tookFreeCoffee: ["b"],
  workedWeekend: ["b"],
  hobbyDone: ["b"],
  ateOut: ["b"],
  devCoffee: ["b"],
  devCame: ["b"],
  retestUsed: ["b"],
  restedTonight: ["b"],
  earlyTomorrow: ["b"],
  pochaNights: ["n", 0, 99],
  dinnerAsked: ["b"],
  codexAtStart: ["n", 0, 999],
};

const SEVERITIES = ["low", "normal", "critical"];
const ITEMS = ["magnifier", "chair", "alarm", "shoes", "thermos", "retest"];
const MACHINE_IDS = ["machineA", "machineB", "machineC", "machineD"];
const RESULTS = [null, "caught", "missed"];
```

Then the checkers and `sanitiseRun`, next to the existing `sanitise` at the bottom of the file:

```js
function isInt(v, lo, hi) {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

function runAssignment(v) {
  if (!v || typeof v !== "object") return undefined;
  if (!MACHINE_IDS.includes(v.machine)) return undefined;
  if (!SEVERITIES.includes(v.severity)) return undefined;
  if (typeof v.sceneId !== "string" || v.sceneId.length > 32) return undefined;
  if (!RESULTS.includes(v.result)) return undefined;
  if (v.bugId !== null && (typeof v.bugId !== "string" || v.bugId.length > 64))
    return undefined;
  const out = {
    machine: v.machine,
    sceneId: v.sceneId,
    severity: v.severity,
    result: v.result,
    bugId: v.bugId,
  };
  if (v.hotfix === true) out.hotfix = true;
  return out;
}

function runList(v, each) {
  if (!Array.isArray(v) || v.length > RUN_LIST) return undefined;
  const out = [];
  for (const x of v) {
    const one = each(x);
    if (one === undefined) return undefined;
    out.push(one);
  }
  return out;
}

function runField(rule, v) {
  switch (rule[0]) {
    case "n":
      return isInt(v, rule[1], rule[2]) ? v : undefined;
    case "b":
      return typeof v === "boolean" ? v : undefined;
    case "s":
      return rule[1].includes(v) ? v : undefined;
    case "assignments":
      return runList(v, runAssignment);
    case "severities":
      return runList(v, (x) => (SEVERITIES.includes(x) ? x : undefined));
    case "items":
      return runList(v, (x) => (ITEMS.includes(x) ? x : undefined));
    case "spot":
      if (v === null) return null;
      if (!v || typeof v !== "object") return undefined;
      if (typeof v.x !== "number" || !Number.isFinite(v.x)) return undefined;
      if (typeof v.y !== "number" || !Number.isFinite(v.y)) return undefined;
      return { x: v.x, y: v.y };
    case "greeted": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
      const out = {};
      let n = 0;
      for (const [id, times] of Object.entries(v)) {
        if (n++ >= RUN_LIST) return undefined;
        if (id.length > 40) return undefined;
        if (!isInt(times, 0, 999)) return undefined;
        out[id] = times;
      }
      return out;
    }
    default:
      return undefined;
  }
}

/**
 * A run as sent by a client, reduced to one this server will store.
 *
 * The same posture as sanitise: the argument claims a shape and is not
 * believed about it. A field that does not check out is left out rather than
 * corrected — a corrected field is a lie about what the player did, and the
 * client's own default is the honest replacement.
 */
function sanitiseRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.v !== RUN_VERSION) return null;
  if (JSON.stringify(raw).length > MAX_RUN_BYTES) return null;
  const out = { v: RUN_VERSION, updatedAt: Date.now() };
  for (const [key, rule] of Object.entries(RUN_FIELDS)) {
    const value = runField(rule, raw[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}
```

And the three methods, inside `class Server`, after `resetSave`:

```js
  /**
   * The run in progress, kept for the next device.
   *
   * Not folded into syncBook, for the same reason getEntitlements is not: the
   * book is a merge that is allowed to fail quietly, and this is a
   * last-one-wins record. Sharing a call would mean a failed book sync could
   * cost a day of work, and a rejected run could cost the book.
   */
  async saveRun(snapshot) {
    const run = sanitiseRun(snapshot);
    if (!run) return { ok: false };
    await $global.updateMyState({ run, updatedAt: Date.now() });
    return { ok: true };
  }

  async getRun() {
    const state = (await $global.getMyState()) || {};
    return state.run && state.run.v === RUN_VERSION ? state.run : null;
  }

  async clearRun() {
    await $global.updateMyState({ run: null, updatedAt: Date.now() });
    return true;
  }
```

- [ ] **Step 2: Make `resetSave` drop the run too**

Replace the body of `resetSave` in `server.js`:

```js
  /**
   * Lets a player wipe their own save.
   *
   * The run goes with the book. Wiping is the player throwing away what they
   * recorded, and a twelve-day run they no longer want is part of that — but
   * `adsRemoved` is untouched, here as everywhere: what they paid for is not
   * theirs to lose by pressing this.
   */
  async resetSave() {
    await $global.updateMyState({
      book: {},
      best: 0,
      runs: 0,
      run: null,
      updatedAt: Date.now(),
    });
    return true;
  }
```

- [ ] **Step 3: Write the failing test**

Append to `scripts/checkrun.ts`. It loads `server.js` by evaluating its source — the file has no top-level side effects and touches `$global` only inside methods, so this is safe and it tests the real code rather than a copy of it.

The `import` line goes at the **top** of the file with the others, not where the block is appended. ES modules allow a top-level import anywhere, but `oxlint` reads them as a header and so does anyone else.

```ts
import { readFileSync } from "node:fs";

/** the server's own helpers, pulled out of the file the platform loads */
const serverBits = () => {
  const src = readFileSync("server.js", "utf8");
  const load = new Function(
    `${src}\nreturn { sanitiseRun, RUN_FIELDS, RUN_VERSION };`
  ) as () => {
    sanitiseRun: (raw: unknown) => Record<string, unknown> | null;
    RUN_FIELDS: Record<string, unknown[]>;
    RUN_VERSION: number;
  };
  return load();
};

console.log("\nthe server knows the same run the client does");
{
  const { sanitiseRun, RUN_FIELDS, RUN_VERSION: SV } = serverBits();
  is(SV === RUN_VERSION, "both sides are on the same snapshot version");

  const mine = Object.keys(FULL).sort();
  const theirs = Object.keys(RUN_FIELDS).sort();
  const missing = mine.filter((k) => !theirs.includes(k));
  const extra = theirs.filter((k) => !mine.includes(k));
  is(
    missing.length === 0,
    `the server validates every field the client saves${missing.length ? ` — missing ${missing.join(", ")}` : ""}`
  );
  is(
    extra.length === 0,
    `and validates nothing the client does not send${extra.length ? ` — extra ${extra.join(", ")}` : ""}`
  );

  const stored = sanitiseRun({ v: RUN_VERSION, updatedAt: 1, ...FULL });
  if (!stored) {
    fail("a complete run is accepted");
  } else {
    ok("a complete run is accepted");
    const lost = (Object.keys(FULL) as (keyof RunFields)[]).filter(
      (k) => JSON.stringify(stored[k]) !== JSON.stringify(FULL[k])
    );
    is(
      lost.length === 0,
      `and stored unchanged${lost.length ? ` — lost ${lost.join(", ")}` : ""}`
    );
  }

  is(sanitiseRun(null) === null, "nothing is not a run");
  is(sanitiseRun({ v: 99, updatedAt: 1 }) === null, "nor is a future version");
  is(
    sanitiseRun({
      v: RUN_VERSION,
      updatedAt: 1,
      day: 400,
      pay: -5,
      owned: ["rocket"],
      condition: 3,
    })?.day === undefined,
    "a day of 400 is refused"
  );
  is(
    sanitiseRun({ v: RUN_VERSION, updatedAt: 1, condition: 3, pay: -5 })?.pay ===
      undefined,
    "and negative pay is refused"
  );
  is(
    sanitiseRun({ v: RUN_VERSION, updatedAt: 1, condition: 3, pay: -5 })
      ?.condition === 3,
    "while the fields around them are kept"
  );
  is(
    sanitiseRun({
      v: RUN_VERSION,
      updatedAt: 1,
      greeted: Object.fromEntries(
        Array.from({ length: 5000 }, (_, i) => [`p${i}`, 1])
      ),
    }) === null,
    "and a run too big to be real is refused outright"
  );
}

console.log("\nwiping the account takes the run and leaves the purchase");
{
  const src = readFileSync("server.js", "utf8");
  const body = src.slice(src.indexOf("async resetSave()"));
  const end = body.indexOf("\n  }");
  const reset = body.slice(0, end);
  is(/run:\s*null/.test(reset), "resetSave clears the run");
  is(
    !/adsRemoved/.test(reset),
    "and does not touch adsRemoved"
  );
}
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected before Step 1: `sanitiseRun is not defined` from the `new Function` call. After Step 1 and 2, all PASS.

To prove the drift check works, delete the `codexAtStart` line from `RUN_FIELDS` and re-run: expect `the server validates every field the client saves` to FAIL naming `codexAtStart`. Put it back.

- [ ] **Step 5: Run the whole suite**

```bash
npm run verify
```

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "Give the account somewhere to keep a run, and let go of it on a wipe" && git push origin develop
```

---

## Task 3: Getting the run to and from the account

**Files:**
- Modify: `src/office/run.ts`
- Modify: `scripts/checkrun.ts`

**Interfaces:**
- Consumes: `writeRun`, `dropRun`, `parseRun` from Task 1; the three remote functions from Task 2.
- Produces:
  - `export type Remote = Pick<GameServer, "remoteFunction">` — exported so the check script can cast its fake to it
  - `function saveRun(fields: RunFields, server: Remote | null | undefined): void` — writes locally at once, pushes to the account after 1500 ms of quiet
  - `function fetchRun(server: Remote): Promise<RunSnapshot | null>`
  - `function clearRun(server: Remote | null | undefined): void`
  - `const RUN_PUSH_MS = 1500`

- [ ] **Step 1: Write the failing test**

Append to `scripts/checkrun.ts`. As in Task 2, the `import` line belongs at the top of the file with the others.

`tsc -b` only covers `src` and `vite.config.ts`, so nothing typechecks `scripts/` — but the casts below are what a reader needs to see that the fakes stand in for a real `Remote` on purpose.

```ts
import {
  saveRun,
  clearRun,
  fetchRun,
  RUN_PUSH_MS,
  type Remote,
} from "../src/office/run";

/** a localStorage that exists, because node has none */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const fakeServer = () => {
  const calls: { name: string; args: unknown[] }[] = [];
  return {
    calls,
    remoteFunction: async (name: string, args: unknown[]) => {
      calls.push({ name, args });
      if (name === "getRun") return null;
      return { ok: true };
    },
  };
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log("\nthe account is written to once, not once per change");
{
  const srv = fakeServer();
  for (let day = 1; day <= 5; day++)
    saveRun({ ...FULL, day }, srv as unknown as Remote);
  is(
    store.get("fb_run") !== undefined,
    "the device has it immediately, before any wire"
  );
  is(srv.calls.length === 0, "and the account has not been called yet");
  await wait(RUN_PUSH_MS + 300);
  is(srv.calls.length === 1, "five changes become one account write");
  const sent = srv.calls[0].args[0] as { day: number };
  is(sent.day === 5, "and what it sends is the last of them");
}

console.log("\na run with no server still reaches the device");
{
  store.clear();
  saveRun({ ...FULL, day: 3 }, null);
  const back = parseRun(JSON.parse(store.get("fb_run") as string));
  is(back?.day === 3, "offline, localStorage is the whole of it");
}

console.log("\nclearing takes both copies");
{
  const srv = fakeServer();
  saveRun(FULL, srv as unknown as Remote);
  clearRun(srv as unknown as Remote);
  is(store.get("fb_run") === undefined, "the device forgets at once");
  await wait(RUN_PUSH_MS + 300);
  const names = srv.calls.map((c) => c.name);
  is(names.includes("clearRun"), "the account is told to forget");
  is(!names.includes("saveRun"), "and the queued write is dropped, not sent");
}

console.log("\na server that says no does not take the run with it");
{
  store.clear();
  // it throws where it stands, rather than returning a rejected promise —
  // the harsher of the two, and the one a naive `.catch()` does not survive
  const angry = {
    remoteFunction: () => {
      throw new Error("no");
    },
  } as unknown as Remote;
  saveRun({ ...FULL, day: 6 }, angry);
  await wait(RUN_PUSH_MS + 300);
  const back = parseRun(JSON.parse(store.get("fb_run") as string));
  is(back?.day === 6, "the device's copy is untouched by a failed push");
  const got = await fetchRun(angry);
  is(got === null, "and a failed read is nothing, not an exception");
}
```

Note: `checkrun.ts` now uses top-level `await`. Add nothing — tsx runs it as an ES module, where top-level await is allowed.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected: the import of `saveRun` fails.

- [ ] **Step 3: Add the account half to `src/office/run.ts`**

Add at the top:

```ts
import type { GameServer } from "@agent8/gameserver";
```

and at the bottom:

```ts
export type Remote = Pick<GameServer, "remoteFunction">;

/**
 * Call the server and care about nothing that comes back.
 *
 * Both writes here are fire-and-forget, and both must survive a server that
 * fails in either of the two ways: a rejected promise, or a throw where it
 * stands. `.catch()` alone only covers the first, and the second would take
 * down the timer callback it was called from — which on a phone with a bad
 * connection is an uncaught error every second and a half.
 */
const tell = (server: Remote, name: string, args: unknown[]) => {
  void (async () => {
    try {
      await server.remoteFunction(name, args);
    } catch {
      /* the device already has the truth; the next change sends it again */
    }
  })();
};

/**
 * How long the run is left alone before it goes up the wire.
 *
 * A day's worth of state changes arrive in bursts — a build is signed off, the
 * developer takes it, the pay lands, the clock moves — and one account write
 * per change is several a second for a record nothing reads until the next
 * time the game opens. queueSync makes the same trade for the book, at four
 * seconds; this is shorter because what it protects against is the tab dying,
 * and four seconds of a working day is a build.
 */
export const RUN_PUSH_MS = 1500;

let pushing: ReturnType<typeof setTimeout> | null = null;

const unqueue = () => {
  if (pushing !== null) {
    clearTimeout(pushing);
    pushing = null;
  }
};

/**
 * Write the run down: on this device now, on the account shortly.
 *
 * The local write is synchronous and unconditional, because it is the copy
 * that answers on the next load and it costs nothing. The account write is the
 * one that survives a new phone, and it can fail as often as it likes — the
 * next change sends the whole run again, so a dropped push loses nothing but
 * the seconds until the next one.
 */
export function saveRun(
  fields: RunFields,
  server: Remote | null | undefined
): void {
  const snap = writeRun(fields);
  if (!server) return;
  unqueue();
  pushing = setTimeout(() => {
    pushing = null;
    tell(server, "saveRun", [snap]);
  }, RUN_PUSH_MS);
}

/** the account's copy, or nothing at all if it cannot be had */
export async function fetchRun(server: Remote): Promise<RunSnapshot | null> {
  try {
    return parseRun(await server.remoteFunction("getRun", []));
  } catch {
    /* no server, or it said no. Whatever is on the device stands. */
    return null;
  }
}

/**
 * Throw the run away, on both copies.
 *
 * The queued push is cancelled first. Without that, a run cleared at the end
 * of the twelfth day is still sitting in the timer, and a second and a half
 * later it lands back on the account and the next load resumes a run the
 * player has already finished.
 */
export function clearRun(server: Remote | null | undefined): void {
  unqueue();
  dropRun();
  if (!server) return;
  tell(server, "clearRun", []);
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx tsx scripts/checkrun.ts
```

Expected: every line PASS.

- [ ] **Step 5: Run the whole suite**

```bash
npm run verify
```

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "Send the run to the account, once the player stops changing it" && git push origin develop
```

---

## Task 4: Starting from the run that was saved

**Files:**
- Modify: `src/office/Office.tsx`
- Modify: `scripts/checkrun.ts`

**Interfaces:**
- Consumes: `readRun`, `fetchRun`, `newer`, `RunSnapshot` from Tasks 1 and 3; `Loading` from `../components/Loading`.
- Produces: `Office` is now a boot gate; the body is `function OfficeRun({ boot, onExit }: { boot: RunSnapshot | null; onExit: () => void })`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/checkrun.ts`:

```ts
console.log("\nevery field that is saved is also read back");
{
  const src = readFileSync("src/office/Office.tsx", "utf8");
  const unread = (Object.keys(FULL) as (keyof RunFields)[]).filter(
    (k) => !new RegExp(`boot\\?\\.${k}\\b`).test(src)
  );
  is(
    unread.length === 0,
    `Office restores all ${Object.keys(FULL).length} of them${unread.length ? ` — never reads ${unread.join(", ")}` : ""}`
  );
}

console.log("\nscreen state stays out of the run");
{
  const screen = [
    "running",
    "note",
    "codex",
    "offer",
    "shop",
    "watching",
    "night",
  ];
  const leaked = screen.filter((k) => k in FULL);
  is(
    leaked.length === 0,
    `a modal never comes back with the run${leaked.length ? ` — found ${leaked.join(", ")}` : ""}`
  );
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected: `Office restores all 35 of them — never reads day, assignments, ...` FAILs, listing every field.

- [ ] **Step 3: Split `Office` into a gate and the body**

Rename the existing component. Change this line:

```ts
export function Office({ onExit }: { onExit: () => void }) {
```

to:

```ts
function OfficeRun({
  boot,
  onExit,
}: {
  boot: RunSnapshot | null;
  onExit: () => void;
}) {
```

Add to the imports at the top of `Office.tsx`:

```ts
import { Loading } from "../components/Loading";
import {
  readRun,
  fetchRun,
  newer,
  type RunSnapshot,
} from "./run";
```

Then add the gate immediately above `OfficeRun`:

```tsx
/** how long a boot waits for the account before going with what is here */
const BOOT_WAIT_MS = 2000;

/**
 * Which run to start from, decided once, before anything can play.
 *
 * It has to happen outside the component that holds the state. A useState
 * initialiser runs at mount and never again, so a snapshot that arrives later
 * cannot fill in the thirty-five of them — the choice must already be made by
 * the time OfficeRun exists, which is why this is a separate component and not
 * an effect inside it.
 *
 * The device's copy is read synchronously and is the answer if nothing better
 * turns up. The account is asked in parallel and wins only by being newer; two
 * seconds is the whole of its chance, after which a slow or missing server
 * costs the player nothing but the wait they already spent loading. The
 * decision is made once and never revisited: a date that changes underneath
 * somebody mid-run reads as a fault whatever the reason for it.
 *
 * A dev query string skips all of it. `?day=7` means "show me day seven", and
 * resuming over the top of that would make the tool useless.
 */
export function Office({ onExit }: { onExit: () => void }) {
  const { server, connected } = useGameServer();
  const [boot, setBoot] = useState<RunSnapshot | null | undefined>(
    devParam("day") || devParam("place") || devParam("at") ? null : undefined
  );
  const settled = useRef(false);

  useEffect(() => {
    if (boot !== undefined || settled.current) return;
    const local = readRun();
    const done = (s: RunSnapshot | null) => {
      if (settled.current) return;
      settled.current = true;
      setBoot(s);
    };
    const timer = window.setTimeout(() => done(local), BOOT_WAIT_MS);
    if (connected) {
      void fetchRun(server).then((remote) => {
        clearTimeout(timer);
        done(newer(local, remote));
      });
    }
    return () => clearTimeout(timer);
  }, [boot, connected, server]);

  if (boot === undefined) return <Loading progress={1} />;
  return <OfficeRun boot={boot} onExit={onExit} />;
}
```

`fetchRun` already swallows its own failures and resolves to `null`, so there is no rejection path to handle here.

- [ ] **Step 4: Feed every initialiser from `boot`**

Replace each of these `useState` calls in `OfficeRun`. The existing comments above them stay where they are.

```ts
  const [day, setDay] = useState(boot?.day ?? START_DAY);
  const [assignments, setAssignments] = useState<Assignment[]>(
    () =>
      boot?.assignments ??
      (isWeekend(boot?.day ?? START_DAY) ? [] : assignDay(boot?.day ?? START_DAY))
  );
  const [devCoffee, setDevCoffee] = useState(boot?.devCoffee ?? false);
  const [devCame, setDevCame] = useState(boot?.devCame ?? false);
  const [retestUsed, setRetestUsed] = useState(boot?.retestUsed ?? false);
  const [spirit, setSpirit] = useState(boot?.spirit ?? SPIRIT_START);
  const [ateOut, setAteOut] = useState(boot?.ateOut ?? false);
  const [codexAtStart] = useState(
    () => boot?.codexAtStart ?? codexTally(codexRows()).caught
  );
  const [caught, setCaught] = useState(boot?.caught ?? 0);
  const [missed, setMissed] = useState(boot?.missed ?? 0);
  const [minutes, setMinutes] = useState(boot?.minutes ?? START_AT ?? DAY_START);
  const [talks, setTalks] = useState(boot?.talks ?? 0);
  const [lastResult, setLastResult] = useState<null | "caught" | "missed">(
    boot?.lastResult ?? null
  );
  const [pending, setPending] = useState<Assignment[]>(boot?.pending ?? []);
  const [delivered, setDelivered] = useState(boot?.delivered ?? 0);
  const [late, setLate] = useState<Severity[]>(boot?.late ?? []);
  const [shipped_, setShipped_] = useState<Severity[]>(boot?.shipped_ ?? []);
  const [place, setPlace] = useState<Place>(boot?.place ?? START_PLACE);
  const [from, setFrom] = useState<Arrival>(boot?.from ?? "wake");
  const [dayOver, setDayOver] = useState(boot?.dayOver ?? false);
  const [hadCoffee, setHadCoffee] = useState(boot?.hadCoffee ?? false);
  const [greeted, setGreeted] = useState<Record<string, number>>(
    boot?.greeted ?? {}
  );
  const [overtime, setOvertime] = useState(boot?.overtime ?? 0);
  const [tookOvertime, setTookOvertime] = useState(boot?.tookOvertime ?? false);
  const [tookFreeCoffee, setTookFreeCoffee] = useState(
    boot?.tookFreeCoffee ?? false
  );
  const [workedWeekend, setWorkedWeekend] = useState(
    boot?.workedWeekend ?? false
  );
  const [hobbyDone, setHobbyDone] = useState(boot?.hobbyDone ?? false);
  const [dinnerAsked, setDinnerAsked] = useState(boot?.dinnerAsked ?? false);
  const [condition, setCondition] = useState(boot?.condition ?? SLEEP_RECOVERY);
  const [borrowed, setBorrowed] = useState(boot?.borrowed ?? 0);
  const [earlyTomorrow, setEarlyTomorrow] = useState(
    boot?.earlyTomorrow ?? false
  );
  const [restedTonight, setRestedTonight] = useState(
    boot?.restedTonight ?? false
  );
  const [pochaNights, setPochaNights] = useState(boot?.pochaNights ?? 0);
  const [pay, setPay] = useState(boot?.pay ?? 0);
  const [owned, setOwned] = useState<ItemId[]>(boot?.owned ?? []);
  const [officeAt, setOfficeAt] = useState<{ x: number; y: number } | null>(
    boot?.officeAt ?? null
  );
```

Leave these exactly as they are — they are screen state, and Task 1's `RunFields` deliberately has no place for them:

```ts
  const [running, setRunning] = useState<Assignment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [codex, setCodex] = useState(false);
  const [night, setNight] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [offer, setOffer] = useState<null | "overtime" | "coffee" | "dinner">(null);
  const [watching, setWatching] = useState(false);
  const [shop, setShop] = useState<null | "office" | "home">(null);
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx tsx scripts/checkrun.ts
```

Expected: `Office restores all 35 of them` PASSes.

- [ ] **Step 6: Typecheck, lint, and build**

```bash
npm run verify && npx oxlint src && npm run build
```

All three must be clean. `firstEverRun` still reads `loadCodex()` and is unaffected.

- [ ] **Step 7: Commit and push**

```bash
git add -A && git commit -m "Start the day the player was on, not the first one" && git push origin develop
```

---

## Task 5: Writing the run down as it changes

**Files:**
- Modify: `src/office/Office.tsx`
- Modify: `scripts/checkrun.ts`

**Interfaces:**
- Consumes: `saveRun`, `clearRun` from Task 3.
- Produces: nothing new. `OfficeRun` now keeps the stores in step with itself.

- [ ] **Step 1: Write the failing test**

Append to `scripts/checkrun.ts`:

```ts
console.log("\nthe run writes itself down, and knows when not to");
{
  const src = readFileSync("src/office/Office.tsx", "utf8");
  const start = src.indexOf("const wire = JSON.stringify(");
  is(start !== -1, "the run is built as one string");
  const block = src.slice(start, start + 3000);
  const missing = (Object.keys(FULL) as string[]).filter(
    (k) => !new RegExp(`(^|[^A-Za-z_])${k}(,|\\s*\\})`, "m").test(block)
  );
  is(
    missing.length === 0,
    `and every field goes into it${missing.length ? ` — missing ${missing.join(", ")}` : ""}`
  );
  is(
    /if \(running\) return;/.test(block),
    "nothing is written while a build is running"
  );
  is(
    /if \(shipped\)[\s\S]{0,80}clearRun\(/.test(block),
    "and a finished run is cleared rather than kept"
  );
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected: `the run is built as one string` FAILs.

- [ ] **Step 3: Add the autosave effect**

Put this in `OfficeRun`, after the last `useState` and before the clock effect that uses `goHomeRef`. `server` and `connected` are already in scope from the existing `useGameServer()` call.

```tsx
  /*
   * The run, written down whenever it changes and no build is open.
   *
   * A list of places to call save from is a list somebody has to remember to
   * add to, and the day it is not added to is the day a field stops being
   * saved with no sign that anything is wrong. So there is no list: the run is
   * built as one string, and the string changing is what a change is. React
   * compares it by value, so a re-render that alters nothing writes nothing.
   *
   * Two moments are excepted. A build in progress is not a state worth
   * restoring into — the player would come back to a half-played build with a
   * clock that had moved — so nothing is written while one is open, and what
   * that costs is the build, not the day: its bugId is already in the
   * assignment, so reopening the machine finds the same defect waiting.
   * A run that has shipped is not a run to come back to at all, so the twelfth
   * evening throws the snapshot away instead and the next opening is a new
   * one.
   */
  const wire = JSON.stringify({
    day,
    assignments,
    pending,
    delivered,
    late,
    shipped_,
    caught,
    missed,
    minutes,
    condition,
    spirit,
    borrowed,
    pay,
    owned,
    place,
    from,
    officeAt,
    dayOver,
    hadCoffee,
    greeted,
    talks,
    lastResult,
    overtime,
    tookOvertime,
    tookFreeCoffee,
    workedWeekend,
    hobbyDone,
    ateOut,
    devCoffee,
    devCame,
    retestUsed,
    restedTonight,
    earlyTomorrow,
    pochaNights,
    dinnerAsked,
    codexAtStart,
  } satisfies RunFields);

  useEffect(() => {
    const srv = connected ? server : null;
    if (shipped) {
      clearRun(srv);
      return;
    }
    if (running) return;
    saveRun(JSON.parse(wire) as RunFields, srv);
  }, [wire, running, shipped, connected, server]);
```

Extend the `run` import at the top of the file to bring in what this needs:

```ts
import {
  readRun,
  fetchRun,
  newer,
  saveRun,
  clearRun,
  type RunSnapshot,
  type RunFields,
} from "./run";
```

`satisfies RunFields` is what keeps this honest: add a field to `RunFields` and forget it here, and `tsc` refuses to build.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx tsx scripts/checkrun.ts
```

- [ ] **Step 5: Prove the type gate works**

Add a throwaway field to `RunFields` in `src/office/run.ts`:

```ts
  probe: number;
```

Run `npx tsc --noEmit`. Expected: an error on the `satisfies RunFields` object saying `probe` is missing. Delete the line and confirm `tsc` is clean again.

- [ ] **Step 6: Run the whole suite and build**

```bash
npm run verify && npx oxlint src && npm run build
```

- [ ] **Step 7: Commit and push**

```bash
git add -A && git commit -m "Keep the written-down run in step with the one being played" && git push origin develop
```

---

## Task 6: Throwing a run away on purpose

**Files:**
- Modify: `src/components/Settings.tsx`
- Modify: `scripts/checkrun.ts`

**Interfaces:**
- Consumes: `clearRun` from Task 3; `resetSave` from `../net/save`, whose server side now clears `run` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `scripts/checkrun.ts`:

```ts
console.log("\nwiping the record throws the run away with it");
{
  const src = readFileSync("src/components/Settings.tsx", "utf8");
  const at = src.indexOf("clearCodex()");
  is(at !== -1, "the wipe button is where it was");
  const block = src.slice(at, at + 1400);
  is(/clearRun\(/.test(block), "the run goes when the book does");
  is(
    /location\.reload\(\)/.test(block),
    "and the page is reopened, so the run in memory cannot write itself back"
  );
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx tsx scripts/checkrun.ts
```

Expected: `the run goes when the book does` FAILs.

- [ ] **Step 3: Make the wipe take the run**

In `src/components/Settings.tsx`, add to the imports:

```ts
import { clearRun } from "../office/run";
```

and replace the confirmed branch of the wipe button's `onClick`:

```tsx
              clearCodex();
              clearRun(connected ? server : null);
              void resetSave(connected ? server : null);
              sfx.play("fail");
              /*
               * Reopen the page rather than tidy up in place.
               *
               * The run is thirty-five pieces of state in a component that is
               * still mounted and still writing itself down every time one of
               * them moves. Clear the stores and leave the screen alone and the
               * eighth day is back on disk a second and a half later, from
               * memory, over the top of the wipe. Putting all thirty-five back
               * by hand is the other way, and forgetting one leaves a run that
               * is half erased.
               *
               * The stores are emptied synchronously above, so the reload finds
               * nothing and starts a new run. The account is carried by the
               * reset that is already owed, which survives a reload for exactly
               * this reason.
               */
              location.reload();
```

The `setConfirming(false)` and `setOpen(false)` calls that were here go: the page is about to be replaced, and setting state on the way out is noise.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx tsx scripts/checkrun.ts
```

- [ ] **Step 5: Run the whole suite and build**

```bash
npm run verify && npx oxlint src && npm run build
```

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "Let the player throw a run away, and make it stay thrown" && git push origin develop
```

---

## What the user checks after deploying

None of this can be proven from here — the account only exists inside Verse8, and the failure this is all for is a phone killing a tab. After the deploy, on the phone:

1. Play to day 3, buy something, then hard-refresh. Expect: day 3, same money, same equipment, same room.
2. Do the same but kill the tab from the app switcher instead. Expect the same.
3. Open a build, and refresh in the middle of it. Expect: back on the office floor, same day, and the machine still holds the same defect.
4. Settings → wipe. Expect: the page reopens on day 1 with an empty book, and the shop still says the adverts are bought.
5. Finish all twelve days, then reload from the ship screen. Expect: a new run, not the twelfth evening again.
