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
if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
console.log("\nplaceholders line up in every language");
