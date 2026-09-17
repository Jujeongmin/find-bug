/**
 * The QA rank: how many builds are mastered, said as a job title.
 *
 * Run: npx tsx scripts/checkrank.ts
 */
import { readFileSync } from "node:fs";
import { RANK_STEPS, rankKey, rankOf } from "../src/office/rank";
import { buildIdsFor } from "../src/office/schedule";
import ko from "../src/i18n/ko.json";
import en from "../src/i18n/en.json";
import ja from "../src/i18n/ja.json";
import zhHans from "../src/i18n/zh-Hans.json";
import zhHant from "../src/i18n/zh-Hant.json";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

console.log("\nthe rank follows the count");
{
  const want: [number, number][] = [[0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [9, 3], [10, 4], [12, 4]];
  for (const [n, r] of want) is(rankOf(n) === r, `${n} mastered is rank ${r} (${rankOf(n)})`);
  is(RANK_STEPS.length === 5 && RANK_STEPS[4] === buildIdsFor(Number.MAX_SAFE_INTEGER).length,
     `five ranks, the last at every build (${RANK_STEPS[4]})`);
}

console.log("\nevery rank has a name in every language");
{
  const keys = [
    ...RANK_STEPS.map((_, i) => rankKey(i)),
    "rank.morning",
    "rank.promoted",
  ];
  const dicts: [string, Record<string, string>][] = [
    ["ko", ko], ["en", en], ["ja", ja], ["zh-Hans", zhHans], ["zh-Hant", zhHant],
  ];
  for (const [lang, d] of dicts) {
    const missing = keys.filter((k) => !(k in d));
    is(missing.length === 0, `${lang}: ${missing.length ? "missing " + missing.join(", ") : "all there"}`);
  }
}

console.log("\nthe office uses it");
{
  const office = readFileSync("src/office/Office.tsx", "utf8");
  is(/const rank = rankOf\(mastered\.length\)/.test(office), "the rank comes from the mastered builds");
  is(/level: devLevel,\s*rank,/.test(office), "the developer is told it");
  is(office.includes('"rank.morning"') && office.includes('"rank.promoted"'), "the morning and the ship screen say it");
}

console.log(bad ? `\n${bad} FAIL` : "\nthe ranks hold");
process.exitCode = bad ? 1 : 0;
