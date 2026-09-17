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
import { readFileSync } from "node:fs";
import {
  parseRun,
  saveRun,
  clearRun,
  fetchRun,
  RUN_VERSION,
  RUN_PUSH_MS,
  RUN_PUSH_MAX_MS,
  RUN_LOCAL_MS,
  type RunFields,
  type Remote,
} from "../src/office/run";
import { settleOwedReset } from "../src/net/save";

/** a localStorage that exists, because node has none */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

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
  runId: "r0a1b2c3d4e5f",
  yearAtStart: 3,
  gift: "alarm",
  masteredAtStart: ["stage03", "stage04"],
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

console.log("\nthe clock comes back, even though it does not tick in whole minutes");
{
  /*
   * The office clock advances by MINUTES_PER_SECOND / 4 — 0.575 — four times
   * a second, so the minute in any real snapshot is a fraction. Read back
   * through a whole-number check it was dropped in silence, and every day
   * that was resumed started again at nine o'clock.
   */
  const back = parseRun({
    v: RUN_VERSION,
    updatedAt: 1,
    day: 8,
    minutes: 579.1000000000031,
  });
  is(
    back?.minutes === 579,
    "a fractional minute is kept, rounded to the minute it shows"
  );
  is(
    parseRun({ v: RUN_VERSION, updatedAt: 1, minutes: 870 })?.minutes === 870,
    "and a whole one is untouched"
  );
  is(
    parseRun({ v: RUN_VERSION, updatedAt: 1, minutes: 99999 })?.minutes ===
      undefined,
    "but a clock outside the day is still refused"
  );
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

  // both copies have to be stamped by the player's own devices, or newer()
  // is comparing a phone's clock against a data centre's
  const stamp = Date.now() - 60_000;
  is(
    sanitiseRun({ v: RUN_VERSION, updatedAt: stamp, day: 4 })?.updatedAt ===
      stamp,
    "the client's own timestamp is kept, not replaced with the server's"
  );
  const absurd = Date.now() + 400 * 86400000;
  is(
    (sanitiseRun({ v: RUN_VERSION, updatedAt: absurd, day: 4 })
      ?.updatedAt as number) < absurd,
    "but a clock a year fast cannot park a run ahead of every later one"
  );

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

console.log("\na clock that never stops does not starve the account");
{
  // the office clock calls setMinutes every 250ms all working day, so the run
  // never has the quiet second and a half a plain debounce waits for. This is
  // that day, at speed: the first version of saveRun pushed nothing at all.
  store.clear();
  const srv = fakeServer();
  const started = Date.now();
  let day = 1;
  const ticking = setInterval(() => {
    saveRun({ ...FULL, minutes: 540 + day++ }, srv as unknown as Remote);
  }, 250);
  await wait(RUN_PUSH_MAX_MS + 800);
  clearInterval(ticking);
  const ticks = Math.round((Date.now() - started) / 250);
  is(
    srv.calls.length >= 1,
    `${ticks} ticks with no gap still reach the account (${srv.calls.length} writes)`
  );
  is(
    store.get("fb_run") !== undefined,
    "and the device is written too, without one write per tick"
  );
}

console.log("\na run with no server still reaches the device");
{
  store.clear();
  saveRun({ ...FULL, day: 3 }, null);
  await wait(RUN_LOCAL_MS + 200);
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

console.log("\nwiping the account takes the run and leaves the purchase");
{
  const src = readFileSync("server.js", "utf8");
  const body = src.slice(src.indexOf("async resetSave()"));
  const reset = body.slice(0, body.indexOf("\n  }"));
  is(/run:\s*null/.test(reset), "resetSave clears the run");
  is(!/adsRemoved/.test(reset), "and does not touch adsRemoved");
}

console.log("\na wipe still owed is carried out before any run is pulled");
{
  /*
   * The wipe button empties this device, sends the wipe, and reloads in the
   * same moment - so the account usually has not heard it yet. The debt is
   * written down first for exactly that case. The boot used to fetch the
   * account's run without looking at it, took back the run that had just
   * been thrown away, and the next autosave put it on the account again
   * after the owed wipe had emptied it.
   */
  const calls: string[] = [];
  const good = {
    remoteFunction: async (name: string) => {
      calls.push(name);
      if (name === "getRun") return { v: RUN_VERSION, updatedAt: 1, ...FULL };
      return true;
    },
  } as unknown as Remote;

  store.set("fb_reset_owed", "1");
  const settled = await settleOwedReset(good);
  is(settled === true, "an owed wipe that reaches the account settles");
  is(calls[0] === "resetSave" && !calls.includes("getRun"),
     `the wipe is sent, and nothing is pulled to send it (${calls.join(",") || "no calls"})`);
  is(store.get("fb_reset_owed") === undefined, "and the debt is cleared");

  calls.length = 0;
  const nothingOwed = await settleOwedReset(good);
  is(nothingOwed === true && calls.length === 0, "with nothing owed, the account is asked nothing");

  const deaf = {
    remoteFunction: async () => {
      throw new Error("no answer");
    },
  } as unknown as Remote;
  store.set("fb_reset_owed", "1");
  const unheard = await settleOwedReset(deaf);
  is(unheard === false, "a wipe the account did not hear is not settled");
  is(store.get("fb_reset_owed") === "1", "and it stays owed for the next connection");
  store.delete("fb_reset_owed");
}

console.log("\nthe boot does not take the account's run while a wipe is owed");
{
  const src = readFileSync("src/office/Office.tsx", "utf8");
  const boot = src.slice(src.indexOf("export function Office("), src.indexOf("function OfficeRun("));
  const settleAt = boot.indexOf("settleOwedReset(server)");
  const fetchAt = boot.indexOf("fetchRun(server)");
  is(settleAt >= 0 && fetchAt > settleAt,
     "Office settles an owed wipe before it fetches the account's run");
}

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

console.log("\nthe run writes itself down, and knows when not to");
{
  const src = readFileSync("src/office/Office.tsx", "utf8");
  const start = src.indexOf("const wire = JSON.stringify(");
  is(start !== -1, "the run is built as one string");
  const block = src.slice(start, start + 3000);
  const missing = (Object.keys(FULL) as string[]).filter(
    // shorthand ("minutes,") or written out ("minutes: Math.round(minutes),")
    (k) => !new RegExp(`(^|[^A-Za-z_])${k}\\s*(,|:|\\s*\\})`, "m").test(block)
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

if (bad) {
  console.log(`\n${bad} failed`);
  process.exit(1);
}
