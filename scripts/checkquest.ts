/**
 * Does every quest line fit on one line of the chip?
 *
 * The chip sits over the room and says the one thing to do next. Two lines of
 * it covers more of the scene than a hint should, and it is the line a player
 * reads at a glance rather than reads — so it has to be a glance.
 *
 * This used to estimate: a Hangul or Han character about one font size wide,
 * everything else about half. It does not have to. Neo둥근모 Pro is drawn on a
 * sixteen-unit grid and every advance is a whole number of sixteenths, so the
 * width of a string is exact arithmetic. The table below was read off the font
 * itself with measureText, and the check at the top of the run pins it to what
 * a browser actually drew.
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

/**
 * How wide each character is, in sixteenths of the font size.
 *
 * Anything not listed is a full sixteen — which is every Hangul syllable,
 * every kana, every Han character, the em dash, and the pips and hearts the
 * bar is drawn with. Defaulting to the widest is also the safe way round for
 * a check that asks "does this fit".
 */
const UNITS: Record<string, number> = {};
const put = (u: number, chars: string) => {
  for (const ch of chars) UNITS[ch] = u;
};
put(3, "'");
put(5, " !),.:;I]`ijl|·");
put(6, '"([ft');
put(7, "+Y{}");
put(8, "0123456789#$%&-/<=>?ABCDEFGHJKLNOPQRSUVXZ\\^_abcdeghknopqrsuvxyz~");
put(9, "*MTWmw");
put(12, "@、");
put(15, "…");

const width = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + ((UNITS[ch] ?? 16) * size) / 16, 0);

/**
 * What the chip has, on the narrowest phone worth drawing for.
 *
 *   360  frame — .app-frame is min(100vw, 100dvh * 9/16)
 *   -24  .quest max-width: calc(100% - 24px)
 *   -22  .quest padding: 4px 11px, both sides
 *   ---
 *   314
 *
 * It was 200 before, which was wrong in the same breath as the width model
 * was wrong, and in the opposite direction — so the two hid each other.
 */
const BUDGET = 314;
const FONT = 12;

/** the longest thing each placeholder is ever replaced with */
const SAMPLE: Record<string, string> = { machine: "machine D", n: "12" };

let bad = 0;

/*
 * The table above, against what a browser drew.
 *
 * Every one of these was measured with canvas measureText at 12px in the real
 * font. Two come out a sixteenth wide because "fi" is kerned tighter than the
 * sum of its parts; over-estimating is the safe direction for this check, so
 * the tolerance is one-sided.
 */
const MEASURED: [string, number][] = [
  ["A번 기기부터 — 오늘 제일 심각…", 180],
  ["커피를 사자 — 4번째 빌드용…", 164.25],
  ["더는 못 본다 — 커피나 퇴근…", 162],
  ["잡은 12건 개발자에게…", 126.75],
  ["오늘은 쉬는 날이다…", 114.75],
  ["출근하자 — 현관으로…", 126.75],
  ["Get to work — the front door…", 165],
  ["Out of eyes — coffee, or home…", 169.5],
  ["machine D first — worst today…", 170.25],
  ["machine Dから — 今日一番重い…", 177],
  ["先看machine D — 今天最嚴重…", 165],
  ["走向大路 — 往公司…", 114.75],
];
for (const [text, real] of MEASURED) {
  const got = width(text, FONT);
  const off = got - real;
  if (off < 0 || off > 1) {
    console.log(
      `FAIL  width model is off by ${off.toFixed(2)}px on "${text}" (model ${got}, drawn ${real})`
    );
    bad++;
  }
}
if (!bad) {
  console.log(
    `PASS  the width table matches what the browser drew, on all ${MEASURED.length} samples`
  );
}

for (const [name, dict] of dicts) {
  for (const [key, value] of Object.entries(dict)) {
    if (!key.startsWith("quest.")) continue;
    const filled = value.replace(/\{(\w+)\}/g, (m, slot) => SAMPLE[slot] ?? m);
    const w = Math.round(width(filled, FONT));
    if (w > BUDGET) {
      console.log(`FAIL  ${name} ${key}: ${w}px of ${BUDGET}\n        ${filled}`);
      bad++;
    }
  }
}
if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
console.log(`PASS  every quest line fits one line in all ${dicts.length} languages`);
