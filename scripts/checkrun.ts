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
  const reset = body.slice(0, body.indexOf("\n  }"));
  is(/run:\s*null/.test(reset), "resetSave clears the run");
  is(!/adsRemoved/.test(reset), "and does not touch adsRemoved");
}

if (bad) {
  console.log(`\n${bad} failed`);
  process.exit(1);
}
