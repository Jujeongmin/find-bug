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

if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
console.log("\nplaceholders line up in every language");
