import { useSyncExternalStore } from "react";
import type { GameServer } from "@agent8/gameserver";
import type { Severity } from "./rating";
import type { MachineId } from "./scene";
import { isRunId } from "./years";

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

/**
 * The four rooms a working day is made of, and the door each was entered by.
 * "wake" is the one arrival with no room behind it.
 */
export type Place = "office" | "home" | "lane" | "street";
export type Arrival = "wake" | "home" | "lane" | "street" | "office";

/**
 * Things you can buy. Each one changes a number the player has already felt go
 * against them: the magnifier makes small faults visible, the chair keeps
 * overtime from borrowing against the night, and the alarm hands back half an
 * hour of every morning.
 */
export type ItemId =
  | "magnifier"
  | "chair"
  | "alarm"
  | "shoes"
  | "thermos"
  | "retest";

/**
 * What a new year can hand over on its first morning. Everything on sale
 * except the retest form: the others change how fast you work or how well you
 * see, and the form undoes a report the briefing says will stand.
 */
export type GiftId = Exclude<ItemId, "retest">;
export const GIFTS: readonly GiftId[] = [
  "magnifier",
  "chair",
  "alarm",
  "shoes",
  "thermos",
];

export interface Assignment {
  machine: MachineId;
  sceneId: string;
  severity: Severity;
  /** null until the player has verified it */
  result: null | "caught" | "missed";
  /**
   * A weekend build. Catching one takes back the worst thing that already
   * shipped — but only once the developer has it, because a fix nobody was
   * told about is not a fix. Half a star for twenty minutes of lie-in was
   * the wrong price.
   */
  hotfix?: boolean;
  /**
   * Which defect is in this build. Decided the first time the machine is
   * opened and kept from then on, so stepping away and coming back finds the
   * same build rather than a freshly rolled one. It is also what makes an
   * interrupted build cost only half a build: the snapshot remembers which one
   * was in there.
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
  /** this run's id, added to the finished set when it ships */
  runId: string;
  /**
   * The year this run began in. Fixed at the start: another device finishing a
   * run halfway through this one does not change what this one holds.
   */
  yearAtStart: number;
  /** what the first morning handed over, or null until it is picked */
  gift: GiftId | null;
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

/**
 * The wall clock, which does not run in whole minutes.
 *
 * It advances by MINUTES_PER_SECOND / 4 — 0.575 — four times a second, so the
 * minute in any real snapshot is a fraction. Read back through the whole-number
 * check the rest of these use, it failed and was dropped in silence, and every
 * day that was resumed started again at nine o'clock with the afternoon gone.
 *
 * Rounded rather than refused, because a snapshot written before this was
 * noticed is still a snapshot, and the clock only ever shows whole minutes
 * anyway. Office rounds it on the way out too, so what goes to the account is
 * a whole number the server's own check will accept.
 */
const clockMinutes = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 24 * 60
    ? Math.round(v)
    : undefined;

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

/**
 * Drop one wrong field rather than the whole run it was written in.
 *
 * The assertion is because a snapshot's fields are all optional and TypeScript
 * will not index an intersection with a type parameter. Every call is checked
 * on the way in — the key comes from `keyof RunFields` and the value from that
 * key's own type — so the only thing being asserted is that writing an
 * optional field with a value of its own type is allowed.
 */
const put = <K extends keyof RunFields>(
  out: RunSnapshot,
  key: K,
  value: RunFields[K] | undefined
) => {
  if (value !== undefined) (out as RunFields)[key] = value;
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
  put(out, "minutes", clockMinutes(r.minutes));
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
  put(out, "runId", isRunId(r.runId) ? r.runId : undefined);
  put(out, "yearAtStart", int(r.yearAtStart, 1, 99));
  put(out, "gift", r.gift === null ? null : oneOf(r.gift, GIFTS));
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

/**
 * Where the run has actually got to, for the player to read.
 *
 * A save system that never says anything is one nobody can trust and nobody
 * can report a fault in. Both halves of this can fail quietly by design — the
 * device store throws inside an iframe a browser has decided to wall off, and
 * the account is allowed to be unreachable — and the player, who may have paid
 * money for this game, has no way of telling a run that is safe from one that
 * is about to vanish.
 *
 * So the two are tracked as they happen and shown in the settings panel. It is
 * not instrumentation bolted on for a bug hunt; it is the one fact about a
 * twelve-day run that the game owes whoever is playing it.
 */
export interface SaveStatus {
  /** whether this device would take the last write */
  device: "ok" | "blocked";
  /**
   * what the account made of the last push. "none" is nothing tried yet — no
   * server, or too soon; "refused" is the server rejecting the snapshot, which
   * means the two sides disagree about its shape and is a fault worth naming.
   */
  account: "none" | "ok" | "refused" | "failed";
  /** the day in the last snapshot written down */
  day: number;
}

let status: SaveStatus = { device: "ok", account: "none", day: 0 };
const watchers = new Set<() => void>();

function setStatus(next: Partial<SaveStatus>): void {
  const merged = { ...status, ...next };
  if (
    merged.device === status.device &&
    merged.account === status.account &&
    merged.day === status.day
  ) {
    return;
  }
  status = merged;
  for (const fn of watchers) fn();
}

/** the save status, as a value React re-reads */
export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn);
      return () => watchers.delete(fn);
    },
    () => status,
    () => status
  );
}

/** write it down here and now; the account copy is somebody else's job */
export function writeRun(fields: RunFields): RunSnapshot {
  const snap: RunSnapshot = { v: RUN_VERSION, updatedAt: Date.now(), ...fields };
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
    setStatus({ device: "ok", day: fields.day });
  } catch {
    /* a full or refusing store still leaves the run playable in memory */
    setStatus({ device: "blocked", day: fields.day });
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
 *
 * Both timestamps are put on by the device that was played on — the server
 * keeps what it was sent rather than stamping its own. That matters more than
 * it looks: stamped by the server, this would be comparing a phone's clock
 * against a data centre's, and a laptop running a few minutes fast would beat
 * a phone that had played four days more.
 */
export function newer(
  a: RunSnapshot | null,
  b: RunSnapshot | null
): RunSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export type Remote = Pick<GameServer, "remoteFunction">;

/**
 * Call the server and care about nothing that comes back.
 *
 * Both writes below are fire-and-forget, and both have to survive a server
 * that fails in either of the two ways: a rejected promise, or a throw where
 * it stands. `.catch()` alone only covers the first, and the second would take
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
 * developer takes it, the pay lands — and one account write per change is
 * several a second for a record nothing reads until the next time the game
 * opens. queueSync makes the same trade for the book, at four seconds; this is
 * shorter because what it protects against is the tab dying, and four seconds
 * of a working day is a build.
 */
export const RUN_PUSH_MS = 1500;

/**
 * ...but a quiet gap is not something this game can count on having.
 *
 * The office clock ticks four times a second for the whole working day, and
 * the minute it moves is part of the run — so "write it down once the player
 * stops changing it" describes a moment that never arrives between nine and
 * six. A plain debounce is reset on every tick and fires never, and the first
 * version of this pushed nothing to the account for an entire day: exactly the
 * copy that a new phone depends on, and the only one that cannot be rebuilt
 * from what is on this device.
 *
 * So the wait is capped. Quiet still gets a write in a second and a half; a
 * day that is never quiet gets one every six seconds regardless. Six seconds
 * of the office clock is a quarter of an hour of the day, and it is only ever
 * lost by moving to another device mid-run — the copy on this one is a second
 * behind at worst.
 */
export const RUN_PUSH_MAX_MS = 6000;

/**
 * And the device is not written four times a second either.
 *
 * A kilobyte of JSON stringified and stored on every tick, all day, is work
 * nobody asked for on a battery. One a second is enough: what it risks is a
 * second of a day, and the first write after a quiet moment still happens on
 * the spot, so a purchase or a signed-off build is on disk immediately.
 */
export const RUN_LOCAL_MS = 1000;

let latest: RunFields | null = null;
let latestServer: Remote | null = null;
let lastSnap: RunSnapshot | null = null;

let localTimer: ReturnType<typeof setTimeout> | null = null;
let lastLocalAt = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushSince = 0;

const writeLocal = () => {
  localTimer = null;
  if (!latest) return;
  lastSnap = writeRun(latest);
  lastLocalAt = Date.now();
};

const scheduleLocal = () => {
  if (localTimer !== null) return;
  const due = lastLocalAt + RUN_LOCAL_MS - Date.now();
  if (due <= 0) {
    writeLocal();
    return;
  }
  localTimer = setTimeout(writeLocal, due);
};

const push = () => {
  pushTimer = null;
  pushSince = 0;
  // send what is on disk, not something newer: the two copies disagreeing
  // about which run is the run is the one thing newer() cannot sort out
  if (localTimer !== null) {
    clearTimeout(localTimer);
    writeLocal();
  }
  if (!latestServer || !lastSnap) return;
  /*
   * Unlike the other two calls here, this one's answer is worth having: it is
   * the difference between a run the player can carry to another phone and one
   * that lives in a single browser. A refusal is not the same as a silence,
   * either — refused means the server looked at the snapshot and did not
   * recognise it, which is a fault in this code rather than in the network.
   */
  const server = latestServer;
  void (async () => {
    try {
      const res = (await server.remoteFunction("saveRun", [lastSnap])) as {
        ok?: boolean;
      } | null;
      setStatus({ account: res?.ok === true ? "ok" : "refused" });
    } catch {
      setStatus({ account: "failed" });
    }
  })();
};

const schedulePush = () => {
  if (!latestServer) return;
  const now = Date.now();
  if (!pushSince) pushSince = now;
  if (pushTimer !== null) clearTimeout(pushTimer);
  const wait = Math.min(
    RUN_PUSH_MS,
    Math.max(0, pushSince + RUN_PUSH_MAX_MS - now)
  );
  pushTimer = setTimeout(push, wait);
};

const unqueue = () => {
  if (localTimer !== null) {
    clearTimeout(localTimer);
    localTimer = null;
  }
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  latest = null;
  lastSnap = null;
  pushSince = 0;
};

/**
 * Write the run down: on this device shortly, on the account soon after.
 *
 * Neither write is guaranteed to have happened when this returns. What is
 * guaranteed is that the newest run handed to it is the one both copies end up
 * with, and that neither cadence can be starved by a caller that never stops
 * calling — which, with a clock on the wall, is every caller.
 *
 * The account write can fail as often as it likes. The next change sends the
 * whole run again, so a dropped push loses nothing but the seconds until the
 * next one.
 */
export function saveRun(
  fields: RunFields,
  server: Remote | null | undefined
): void {
  latest = fields;
  latestServer = server ?? null;
  scheduleLocal();
  schedulePush();
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
 * later it lands back on the account — so the next opening resumes a run the
 * player has already finished.
 */
export function clearRun(server: Remote | null | undefined): void {
  unqueue();
  dropRun();
  if (!server) return;
  tell(server, "clearRun", []);
}
