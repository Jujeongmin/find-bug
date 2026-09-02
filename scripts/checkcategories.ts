/**
 * Does each defect's category match what the defect actually does?
 *
 * One mechanical rule, which is the only part of this a script can judge: a
 * mutator whose apply() only touches `render` changes what the build looks
 * like and nothing else, so a player who calls that a graphic fault is
 * describing the code. Either the category is graphic or graphic is one of the
 * readings it accepts.
 *
 * floating was the one that failed it. It is filed as physics — the physics
 * category's own description names hovering — but what it does is lift the
 * drawing twenty-eight pixels and leave the position, the collision and the
 * shadow where they were.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("src/engine/mutators.ts", "utf8");
const re =
  /id: "([A-Za-z]+)",\s*\n\s*category: "([a-z-]+)",(?:\s*\n\s*alsoCategories: \[([^\]]*)\],)?[\s\S]*?apply: \(s, t\) =>([\s\S]*?)answerIds/g;

let bad = 0;
let seen = 0;
let m: RegExpExecArray | null;
while ((m = re.exec(src))) {
  const [, id, category, also = "", body] = m;
  seen++;
  const rendersOnly = /o\.render\./.test(body) && !/o\.behaviors|b\.t ===/.test(body);
  const takesGraphic = category === "graphic" || also.includes("graphic");
  if (rendersOnly && !takesGraphic) {
    console.log(
      `FAIL  ${id}: only changes how it is drawn, but "${category}" does not accept graphic`
    );
    bad++;
  }
}
if (!seen) {
  console.log("FAIL  no mutators matched — the pattern has drifted from the file");
  process.exit(1);
}
if (bad) process.exit(1);
console.log(`PASS  all ${seen} mutators: what they change matches what they accept`);
