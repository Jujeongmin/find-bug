import { buildCurriculum, poolFor, MIN_POOL } from "../src/engine/curriculum";
import { ENGINE_SCENES, SCENE_BY_ID } from "../src/stages/registry";
import { generateMutations, applyMutation } from "../src/engine/generate";
import { scoreMutations } from "../src/engine/score";
import { SceneRuntime } from "../src/engine/runtime";

let fails = 0;
const ok = (l: string, c: boolean) => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l}`); };

const cur = buildCurriculum(ENGINE_SCENES, 30);
ok("curriculum has 30 stages", cur.length === 30);
ok("no scene repeats back-to-back",
   cur.every((s, i) => i === 0 || s.sceneId !== cur[i - 1].sceneId));
ok("difficulty never decreases",
   cur.every((s, i) => i === 0 || s.maxBand >= cur[i - 1].maxBand));
ok("stars rise monotonically",
   cur.every((s, i) => i === 0 || s.stars >= cur[i - 1].stars));

let poolsOk = true, minPool = 99;
for (const s of cur) {
  if (s.bespoke) continue;
  const n = poolFor(SCENE_BY_ID[s.sceneId], s.minBand, s.maxBand).length;
  minPool = Math.min(minPool, n);
  if (n < MIN_POOL) poolsOk = false;
}
ok(`every stage pool >= ${MIN_POOL} (smallest = ${minPool})`, poolsOk);

/* the band filter must actually separate easy from hard */
for (const scene of ENGINE_SCENES) {
  const easy = poolFor(scene, 1, 2);
  const hard = poolFor(scene, 3, 4);
  if (!easy.length || !hard.length) continue;
  const avgE = easy.reduce((a, m) => a + m.score, 0) / easy.length;
  const avgH = hard.reduce((a, m) => a + m.score, 0) / hard.length;
  ok(`${scene.id}: band 1-2 easier than 3-4 (${avgE.toFixed(2)} < ${avgH.toFixed(2)})`, avgE < avgH);
}

/* every stage can actually be played: pick a bug, apply, run */
let ran = true;
for (const s of cur) {
  if (s.bespoke) continue;
  const scene = SCENE_BY_ID[s.sceneId];
  for (const m of poolFor(scene, s.minBand, s.maxBand)) {
    try {
      const r = new SceneRuntime(applyMutation(scene, m));
      for (let i = 0; i < 60; i++) r.tick(1 / 60);
    } catch { ran = false; }
  }
}
ok("every bug in every stage runs 1s without throwing", ran);

/* no-op guard still holds after dedupe removal */
let noops = 0;
for (const scene of ENGINE_SCENES) {
  for (const m of generateMutations(scene)) {
    if (JSON.stringify(applyMutation(scene, m)) === JSON.stringify(scene)) noops++;
  }
}
ok(`no no-op mutations anywhere (${noops})`, noops === 0);

const total = ENGINE_SCENES.reduce((a, s) => a + scoreMutations(s, generateMutations(s)).length, 0);
console.log(`\ntotal generated bugs: ${total} across ${ENGINE_SCENES.length} scenes`);
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURES`);
