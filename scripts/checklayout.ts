/**
 * Layout rules that only show on a narrow screen.
 *
 * Run: npx tsx scripts/checklayout.ts
 */
import { readFileSync } from "node:fs";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

console.log("\nthe day's one line sits under the bar, however many rows the bar takes");
{
  /*
   * It was pinned 40px down, which is one row of the bar. On a phone the bar
   * wraps, the machine chips go to a second row, and the line sat on top of
   * them.
   */
  const office = readFileSync("src/office/Office.tsx", "utf8");
  is(/<div className="quest" ref=\{questRef\}>/.test(office), "the line is measured");
  is(/new ResizeObserver\(/.test(office) && /\.wb-header/.test(office), "against the bar, as the bar changes size");
}

console.log(bad ? `\n${bad} FAIL` : "\nthe layout holds");
process.exitCode = bad ? 1 : 0;
