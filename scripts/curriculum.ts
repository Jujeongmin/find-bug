import { buildCurriculum, poolFor, MIN_POOL } from "../src/engine/curriculum";
import { ENGINE_SCENES, SCENE_BY_ID } from "../src/stages/registry";

const cur = buildCurriculum(ENGINE_SCENES, 30);
console.log(`stages: ${cur.length}\n`);
let bad = 0;
let prev = "";
for (const s of cur) {
  const scene = SCENE_BY_ID[s.sceneId];
  const pool = scene ? poolFor(scene, s.minBand, s.maxBand).length : 8;
  const dup = s.sceneId === prev ? "  <-- REPEAT" : "";
  if (dup) bad++;
  if (pool < MIN_POOL) bad++;
  prev = s.sceneId;
  console.log(
    `${String(s.n).padStart(2)}. ${s.sceneId.padEnd(9)} band ${s.minBand}-${s.maxBand} ${"★".repeat(s.stars).padEnd(3)} pool=${String(pool).padStart(2)}${s.bespoke ? " (bespoke)" : ""}${dup}`
  );
}
const scenes = new Set(cur.map((s) => s.sceneId));
console.log(`\ndistinct scenes used: ${scenes.size} (${[...scenes].join(", ")})`);
console.log(bad === 0 ? "VALID: no repeats, every pool >= MIN_POOL" : `${bad} PROBLEMS`);
