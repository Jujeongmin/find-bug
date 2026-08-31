import { generateMutations } from "../src/engine/generate";
import { scoreMutations } from "../src/engine/score";
import { ENGINE_SCENES } from "../src/stages/registry";

let grand = 0;
const table: Record<string, number[]> = {};
for (const s of ENGINE_SCENES) {
  const scored = scoreMutations(s, generateMutations(s));
  grand += scored.length;
  const counts = [0, 0, 0, 0];
  for (const m of scored) counts[m.band - 1]++;
  table[s.id] = counts;
  console.log(`${s.id}: total ${scored.length}  band1=${counts[0]} band2=${counts[1]} band3=${counts[2]} band4=${counts[3]}`);
}
console.log(`\nTOTAL ${grand}`);
console.log("\nsample hardest / easiest per scene:");
for (const s of ENGINE_SCENES) {
  const scored = scoreMutations(s, generateMutations(s)).sort((a, b) => a.score - b.score);
  const f = (m: any) => `${m.bug.id}(${m.score.toFixed(2)})`;
  console.log(`  ${s.id}: easiest ${f(scored[0])} | hardest ${f(scored[scored.length - 1])}`);
}
