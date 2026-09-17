/**
 * Do the translations say the same thing the code expects?
 *
 * Two failures that ship silently and look like a crash to the player: a key
 * whose translation dropped a {placeholder}, so a sentence renders with a
 * number missing, and one that invented a placeholder the caller never passes,
 * so "{n}" appears on screen in braces.
 *
 * English is the floor under every language, so a key missing from ja or zh is
 * a gap rather than a fault and is only counted.
 */
import ko from "../src/i18n/ko.json";
import en from "../src/i18n/en.json";
import ja from "../src/i18n/ja.json";
import zhHant from "../src/i18n/zh-Hant.json";
import zhHans from "../src/i18n/zh-Hans.json";
import { PASSERS, passerKeys, passerLine } from "../src/street/passers";
import { pochaKeys, pochaLine } from "../src/street/pocha";
import { devKeys, devLine, devShipLine } from "../src/office/devlines";
import { eventFor, eventKeys } from "../src/office/events";

type Dict = Record<string, string>;
const dicts: [string, Dict][] = [
  ["ko", ko],
  ["ja", ja],
  ["zh-Hant", zhHant],
  ["zh-Hans", zhHans],
];

const slots = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

let bad = 0;
for (const [name, dict] of dicts) {
  const missing: string[] = [];
  for (const [key, value] of Object.entries(en as Dict)) {
    const other = dict[key];
    if (other === undefined) {
      missing.push(key);
      continue;
    }
    if (slots(value) !== slots(other)) {
      console.log(
        `FAIL  ${name} ${key}\n        en: ${slots(value) || "(none)"}\n        ${name}: ${slots(other) || "(none)"}`
      );
      bad++;
    }
  }
  const extra = Object.keys(dict).filter((k) => !(k in (en as Dict)));
  if (extra.length) {
    console.log(`FAIL  ${name}: ${extra.length} keys English does not have: ${extra.slice(0, 5).join(", ")}`);
    bad++;
  }
  console.log(
    `PASS  ${name}: ${Object.keys(en).length - missing.length}/${Object.keys(en).length} translated` +
      (missing.length ? `, ${missing.length} falling back to English` : "")
  );
}
/*
 * The people on the walk ask for their lines by number, so the dictionary has
 * to hold as many as each of them promises. A missing one is not a crash: the
 * key renders as itself, and a stranger says "street.b.e1" to you.
 */
{
  const missing = passerKeys().filter((k) => !(k in (en as Dict)));
  if (missing.length) {
    console.log(`FAIL  lines the passers-by ask for and English does not have: ${missing.join(", ")}`);
    bad++;
  } else {
    console.log(`PASS  every line the passers-by can ask for exists (${passerKeys().length})`);
  }

  /* and the rules that decide which of them is said */
  const p = PASSERS.passer0;
  const cases: [string, string, string][] = [
    [
      "the freeze is the first thing said that week",
      passerLine(p, 0, { dayOver: false, freeze: true, worn: true }),
      "street.a.freeze",
    ],
    [
      "and only the first thing: after that, the rotation",
      passerLine(p, 1, { dayOver: false, freeze: true, worn: false }),
      "street.a.m1",
    ],
    [
      "a borrowed night shows on the walk in",
      passerLine(p, 0, { dayOver: false, freeze: false, worn: true }),
      "street.a.tired",
    ],
    [
      "but not on the walk home, which has its own lines",
      passerLine(p, 0, { dayOver: true, freeze: false, worn: true }),
      "street.a.e0",
    ],
    [
      "the evening pool wraps on its own length",
      passerLine(p, 2, { dayOver: true, freeze: false, worn: false }),
      "street.a.e0",
    ],
  ];
  for (const [label, got, want] of cases) {
    if (got === want) {
      console.log(`PASS  ${label}`);
    } else {
      console.log(`FAIL  ${label}: got ${got}, want ${want}`);
      bad++;
    }
  }
}

/* and the stall, which has an owner now rather than a price list */
{
  const missing = pochaKeys().filter((k) => !(k in (en as Dict)));
  if (missing.length) {
    console.log(`FAIL  lines the stall owner asks for and English does not have: ${missing.join(", ")}`);
    bad++;
  } else {
    console.log(`PASS  every line the stall owner can ask for exists (${pochaKeys().length})`);
  }
  const night = (over: Partial<Parameters<typeof pochaLine>[0]>) =>
    pochaLine({ nights: 3, spirit: 3, max: 5, freeze: false, lastDay: false, ...over });
  const cases: [string, string, string][] = [
    ["the first night is the first night", night({ nights: 0, spirit: 1 }), "pocha.first"],
    ["the last one knows it is the last", night({ lastDay: true, freeze: true }), "pocha.last"],
    ["the freeze comes before the face", night({ freeze: true, spirit: 1 }), "pocha.freeze"],
    ["a bad fortnight is spoken to", night({ spirit: 1, nights: 2 }), "pocha.low0"],
    ["a good one too", night({ spirit: 4, nights: 3 }), "pocha.high1"],
    ["and the middle alternates", night({ spirit: 3, nights: 4 }), "pocha.mid0"],
  ];
  for (const [label, got, want] of cases) {
    if (got === want) {
      console.log(`PASS  ${label}`);
    } else {
      console.log(`FAIL  ${label}: got ${got}, want ${want}`);
      bad++;
    }
  }
}

/* and the one person in the game you work with rather than walk past */
{
  const missing = devKeys().filter((k) => !(k in (en as Dict)));
  if (missing.length) {
    console.log(`FAIL  lines the developer asks for and English does not have: ${missing.join(", ")}`);
    bad++;
  } else {
    console.log(`PASS  every line the developer can ask for exists (${devKeys().length})`);
  }
  const talk = (over: Partial<Parameters<typeof devLine>[0]>) =>
    devLine({
      day: 4,
      days: 12,
      firstTalk: false,
      pending: 0,
      lastResult: null,
      left: 2,
      freeze: false,
      weekend: false,
      hotfix: false,
      spirit: 3,
      talks: 0,
      level: 0,
      rank: 0,
      ...over,
    });
  const cases: [string, string, string][] = [
    ["a build just signed off comes first", talk({ lastResult: "caught", left: 0, day: 12 }), "office.dev.caught"],
    ["and a pile on your desk before that", talk({ pending: 2, lastResult: "caught" }), "office.dev.waiting"],
    [
      "the last day beats being finished for the day",
      talk({ day: 12, left: 0 }),
      "office.dev.lastFlat",
    ],
    [
      "and what they say about it depends on what reached them",
      talk({ day: 12, level: 3 }),
      "office.dev.lastWarm",
    ],
    ["the day it came back is today's news", talk({ hotfix: true, weekend: true }), "office.dev.hotfix"],
    ["a weekend is remarked on", talk({ weekend: true }), "office.dev.weekend"],
    ["so is the freeze", talk({ freeze: true }), "office.dev.freeze"],
    ["and the state you are in, before small talk", talk({ spirit: 1 }), "office.dev.worried"],
    ["otherwise the relationship talks", talk({ level: 2, talks: 3 }), "office.dev.warm2_1"],
    ["or nothing much does", talk({ talks: 7 }), "office.dev.idle2"],
    ["a newcomer is greeted as before", talk({ firstTalk: true }), "office.dev.intro"],
    ["a junior is recognised", talk({ firstTalk: true, rank: 1 }), "office.dev.introRank1"],
    ["a senior is trusted", talk({ firstTalk: true, rank: 2 }), "office.dev.introRank2"],
    ["and so is a lead", talk({ firstTalk: true, rank: 3 }), "office.dev.introRank2"],
    ["the head of QA is a title", talk({ firstTalk: true, rank: 4 }), "office.dev.introRank3"],
    ["after hello, rank changes nothing", talk({ talks: 7, rank: 4 }), "office.dev.idle2"],
    ["the ship is spoken to as well", devShipLine(4.5, 0), "office.dev.shipGood"],
    ["and a friend says something else about it", devShipLine(1, 3), "office.dev.shipWarm"],
  ];
  for (const [label, got, want] of cases) {
    if (got === want) {
      console.log(`PASS  ${label}`);
    } else {
      console.log(`FAIL  ${label}: got ${got}, want ${want}`);
      bad++;
    }
  }
}

/* the two days that are not like the others */
{
  const missing = eventKeys().filter((k) => !(k in (en as Dict)));
  if (missing.length) {
    console.log(`FAIL  lines the calendar asks for and English does not have: ${missing.join(", ")}`);
    bad++;
  } else {
    console.log(`PASS  every line the two events can ask for exists (${eventKeys().length})`);
  }
  const days: [number, string | null][] = [
    [4, null],
    [5, "hotfix"],
    [6, null],
    [9, "dinner"],
    [12, null],
  ];
  for (const [day, want] of days) {
    const got = eventFor(day);
    if (got === want) {
      console.log(`PASS  day ${day} is ${want ?? "an ordinary day"}`);
    } else {
      console.log(`FAIL  day ${day}: got ${got}, want ${want}`);
      bad++;
    }
  }
}

/*
 * A fault description names a counter by its key, like the object it names.
 * The build screen translated both; the book and the debug list translated
 * only the object, and the book printed "object.score" to the player.
 */
console.log("\nevery screen that describes a fault translates its counter too");
{
  const { readFileSync } = await import("node:fs");
  for (const file of ["src/office/Office.tsx", "src/debug/DebugLab.tsx", "src/engine/EngineStage.tsx"]) {
    const src = readFileSync(file, "utf8");
    const objs = (src.match(/obj: t\([^)]*descParams\.obj/g) ?? []).length;
    const counters = (src.match(/counter: [^,}]*descParams\.counter/g) ?? []).length;
    if (objs > 0 && objs === counters) {
      console.log(`PASS  ${file}: ${objs} description(s), counter translated in each`);
    } else {
      console.log(`FAIL  ${file}: ${objs} translate obj, ${counters} translate counter`);
      bad++;
    }
  }
}

if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
console.log("\nplaceholders line up in every language");
