/**
 * Mastery: a build whose every fault is caught costs nothing to inspect, and
 * the faults a player has not caught are dealt first.
 *
 * Run: npx tsx scripts/checkmastery.ts
 */
import { codexRows, type Book } from "../src/office/codex";
import { buildProgress, masteredBuilds, preferFor } from "../src/office/mastery";
import { pickMutation, generateMutations } from "../src/engine/generate";
import { poolFor } from "../src/engine/curriculum";
import { pickBug } from "../src/core/judge";
import { ENGINE_SCENES } from "../src/stages/registry";
import { stage04 } from "../src/stages/stage04/bugs";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

const all = codexRows({}, 99);
const bookWith = (sceneId: string, state: "caught" | "missed", except?: string): Book => {
  const book: Book = {};
  for (const r of all) {
    if (r.sceneId !== sceneId) continue;
    book[`${r.sceneId}/${r.bugId}`] = r.bugId === except ? "missed" : state;
  }
  return book;
};

console.log("\na build is mastered when every one of its faults is caught");
{
  is(masteredBuilds(codexRows({}, 99)).length === 0, "an empty book masters nothing");
  const rows = codexRows(bookWith("stage03", "caught"), 99);
  const m = masteredBuilds(rows);
  is(m.length === 1 && m[0] === "stage03", `catching all of stage03 masters stage03 alone (${m.join(",")})`);
  const first = all.find((r) => r.sceneId === "stage03")!.bugId;
  const oneMissed = codexRows(bookWith("stage03", "caught", first), 99);
  is(masteredBuilds(oneMissed).length === 0, "one missed fault keeps it from mastery");
  const p = buildProgress(oneMissed).get("stage03")!;
  is(p.total === p.caught + 1, `progress counts it (${p.caught}/${p.total})`);
  const y1 = buildProgress(codexRows({}, 1));
  is(!y1.has("stage08") && !y1.has("stage09"), "year one's progress has no mine or kitchen");
  is(buildProgress(codexRows({}, 99)).size === 9, "every build has progress by year 99");
}

console.log("\nthe faults preferred are the ones not caught");
{
  const first = all.find((r) => r.sceneId === "stage03")!.bugId;
  const book: Book = { [`stage03/${first}`]: "caught" };
  const pref = preferFor(codexRows(book, 99), "stage03");
  const total = all.filter((r) => r.sceneId === "stage03").length;
  is(pref.length === total - 1 && !pref.includes(first), "a caught fault is not preferred");
  const missedBook: Book = { [`stage03/${first}`]: "missed" };
  is(preferFor(codexRows(missedBook, 99), "stage03").includes(first), "a missed one still is");
  is(preferFor(codexRows(bookWith("stage03", "caught"), 99), "stage03").length === 0,
     "a mastered build prefers nothing");
}

console.log("\npicking follows the preference, and falls back to everything");
{
  const scene = ENGINE_SCENES.find((s) => s.id === "stage03")!;
  const muts = generateMutations(scene);
  const want = [muts[2].bug.id, muts[5].bug.id];
  const got = new Set<string>();
  for (let i = 0; i < 200; i++) got.add(pickMutation(muts, undefined, want).bug.id);
  is([...got].every((id) => want.includes(id)) && got.size === 2, `only preferred ones come (${[...got].join(",")})`);

  const noPref = new Set<string>();
  for (let i = 0; i < 400; i++) noPref.add(pickMutation(muts, undefined, []).bug.id);
  is(noPref.size > 2, "an empty preference picks from everything");
  const stale = new Set<string>();
  for (let i = 0; i < 400; i++) stale.add(pickMutation(muts, undefined, ["nope"]).bug.id);
  is(stale.size > 2, "a preference matching nothing picks from everything");

  const re = new Set<string>();
  for (let i = 0; i < 200; i++) re.add(pickMutation(muts, want[0], want).bug.id);
  is(re.size === 1 && re.has(want[1]), "a re-roll keeps the preference and leaves out the last one");

  const pool = stage04.bugPool;
  const wantCard = [pool[1].id];
  const cards = new Set<string>();
  for (let i = 0; i < 100; i++) cards.add(pickBug(pool, undefined, wantCard).id);
  is(cards.size === 1 && cards.has(pool[1].id), "the card build follows it too");
  const anyCard = new Set<string>();
  for (let i = 0; i < 300; i++) anyCard.add(pickBug(pool, undefined, []).id);
  is(anyCard.size > 1, "and falls back the same way");
}

console.log("\nevery fault in the book can be dealt, so every build can be mastered");
{
  for (const scene of ENGINE_SCENES) {
    const banded = poolFor(scene, 1, 4);
    const dealt = (banded.length >= 1 ? banded : generateMutations(scene)).map((m) => m.bug.id).sort();
    const book = all.filter((r) => r.sceneId === scene.id).map((r) => r.bugId).sort();
    is(JSON.stringify(dealt) === JSON.stringify(book),
       `${scene.id}: the office deals exactly the book's ${book.length} faults`);
  }
  const cards = stage04.bugPool.map((b) => b.id).sort();
  const cardBook = all.filter((r) => r.sceneId === "stage04").map((r) => r.bugId).sort();
  is(JSON.stringify(cards) === JSON.stringify(cardBook), "stage04: the card pool is the book's");
}

console.log(bad ? `\n${bad} FAIL` : "\nmastery holds");
process.exitCode = bad ? 1 : 0;
