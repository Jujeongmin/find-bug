import { stage01Scene } from "../src/stages/stage01/scene";
import { generateMutations } from "../src/engine/generate";

const muts = generateMutations(stage01Scene);
console.log("generated:", muts.length);
for (const m of muts) {
  console.log(`  ${m.bug.id.padEnd(34)} cat=${m.bug.category.padEnd(15)} answers=[${m.bug.objectIds.join(", ")}]`);
}
const want: [string, string, string][] = [
  ["B1", "attackBtn", "no-action"],
  ["B2", "slimeB", "weird-movement"],
  ["B3", "player", "graphic"],
  ["B4", "potion", "physics"],
  ["B5", "score", "logic"],
  ["B6", "tree1", "physics"],
];
console.log("\n--- original bug coverage ---");
for (const [id, obj, cat] of want) {
  const hit = muts.find(m => m.bug.objectIds.includes(obj) && m.bug.category === cat);
  console.log(`${id} (${obj}/${cat}): ${hit ? "OK  -> " + hit.bug.id : "MISSING"}`);
}
