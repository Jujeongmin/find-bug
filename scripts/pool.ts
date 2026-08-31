import { generateMutations } from "../src/engine/generate";
import { ENGINE_SCENES } from "../src/stages/registry";

let total = 0;
for (const s of ENGINE_SCENES) {
  const m = generateMutations(s);
  total += m.length;
  const byMut = new Map<string, string[]>();
  for (const x of m) byMut.set(x.mutator.id, [...(byMut.get(x.mutator.id) ?? []), x.target.objectId]);
  console.log(`\n=== ${s.id}: ${m.length} bugs ===`);
  for (const [k, v] of byMut) console.log(`  ${k.padEnd(17)} ${v.length} (${v.slice(0,4).join(", ")}${v.length>4?", …":""})`);
}
console.log(`\nTOTAL generated bugs across ${ENGINE_SCENES.length} scenes: ${total}`);
