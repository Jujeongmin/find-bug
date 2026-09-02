/**
 * Does every quest line fit on one line of the chip?
 *
 * The chip sits over the room and says the one thing to do next. Two lines of
 * it covers more of the scene than a hint should, and it is the line a player
 * reads at a glance rather than reads — so it has to be a glance.
 *
 * Width is estimated rather than measured: a Hangul or Han character is about
 * the font size wide, Latin about half. That is close enough to catch a line
 * that has grown, which is the whole job. The budget is a 360-wide phone frame
 * less the chip's margins and padding, with room to spare for a narrower one.
 */
import ko from "../src/i18n/ko.json";
import en from "../src/i18n/en.json";
import ja from "../src/i18n/ja.json";
import zhHant from "../src/i18n/zh-Hant.json";
import zhHans from "../src/i18n/zh-Hans.json";

type Dict = Record<string, string>;
const dicts: [string, Dict][] = [
  ["ko", ko],
  ["en", en],
  ["ja", ja],
  ["zh-Hant", zhHant],
  ["zh-Hans", zhHans],
];

/** the longest thing each placeholder is ever replaced with */
const SAMPLE: Record<string, string> = { machine: "machine D", n: "12" };
const BUDGET = 200;
const FONT = 12;

const width = (s: string) =>
  [...s].reduce(
    (w, ch) => w + (/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? FONT : FONT * 0.52),
    0
  );

let bad = 0;
for (const [name, dict] of dicts) {
  for (const [key, value] of Object.entries(dict)) {
    if (!key.startsWith("quest.")) continue;
    const filled = value.replace(/\{(\w+)\}/g, (m, slot) => SAMPLE[slot] ?? m);
    const w = Math.round(width(filled));
    if (w > BUDGET) {
      console.log(`FAIL  ${name} ${key}: ${w}px of ${BUDGET}\n        ${filled}`);
      bad++;
    }
  }
}
if (bad) {
  console.log(`\n${bad} quest line(s) would wrap on a narrow phone`);
  process.exit(1);
}
console.log(`PASS  every quest line fits one line in all ${dicts.length} languages`);
