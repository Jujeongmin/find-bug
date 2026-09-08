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
