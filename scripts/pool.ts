import { generateMutations } from "../src/engine/generate";
import { ENGINE_SCENES } from "../src/stages/registry";
import { MUTATORS } from "../src/engine/mutators";

let total = 0;
const fired = new Set<string>();
for (const s of ENGINE_SCENES) {
  const m = generateMutations(s);
  total += m.length;
  const byMut = new Map<string, string[]>();
  for (const x of m) {
    fired.add(x.mutator.id);
    byMut.set(x.mutator.id, [...(byMut.get(x.mutator.id) ?? []), x.target.objectId]);
  }
  console.log(`\n=== ${s.id}: ${m.length} bugs ===`);
  for (const [k, v] of byMut) console.log(`  ${k.padEnd(17)} ${v.length} (${v.slice(0,4).join(", ")}${v.length>4?", …":""})`);
}
console.log(`\nTOTAL generated bugs across ${ENGINE_SCENES.length} scenes: ${total}`);

/*
 * A mutator that fires nowhere is a bug type the game claims to have and has
 * never once shown anyone. They go dead quietly: each needs something from a
 * scene — an overlap, a pair of links, a meter — and a scene that never grants
 * it produces no candidates, no warning and no error.
 */
const dead = MUTATORS.filter((m) => !fired.has(m.id)).map((m) => m.id);
console.log(
  dead.length
    ? `
NEVER GENERATED (${dead.length}/${MUTATORS.length}): ${dead.join(", ")}`
    : `
every one of the ${MUTATORS.length} mutators fires somewhere`
);
