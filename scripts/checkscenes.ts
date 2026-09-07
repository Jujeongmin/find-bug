import { generateMutations, applyMutation } from "../src/engine/generate";
import { SceneRuntime } from "../src/engine/runtime";
import { ENGINE_SCENES } from "../src/stages/registry";
import { stage03Scene } from "../src/stages/stage03/scene";
import { stage06Scene } from "../src/stages/stage06/scene";

let fails = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};
const tick = (r: SceneRuntime, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) r.tick(1 / 60);
};
const mut = (scene: any, id: string) => {
  const m = generateMutations(scene).find((x) => x.bug.id === id);
  if (!m) throw new Error("missing mutation " + id);
  return m;
};

/* every generated mutation must actually change the scene */
for (const scene of ENGINE_SCENES) {
  const all = generateMutations(scene);
  const noops = all.filter(
    (m) => JSON.stringify(applyMutation(scene, m)) === JSON.stringify(scene)
  );
  ok(`${scene.id}: no no-op mutations (${all.length} bugs)`, noops.length === 0);
  if (noops.length) console.log("   no-ops:", noops.map((n) => n.bug.id).join(", "));
}

/* every scene boots and ticks without throwing */
for (const scene of ENGINE_SCENES) {
  let threw = false;
  try {
    for (const m of generateMutations(scene)) {
      const r = new SceneRuntime(applyMutation(scene, m));
      tick(r, 2);
    }
  } catch (e) {
    threw = true;
    console.log("   error:", String(e));
  }
  ok(`${scene.id}: all mutations run 2s without throwing`, !threw);
}

/* stage 3: platformer physics */
{
  const r = new SceneRuntime(stage03Scene);
  const y0 = r.state.objects.player.y;
  r.jump();
  tick(r, 0.25);
  ok("stage03: jump rises", r.state.objects.player.y < y0);
  tick(r, 3);
  const groundY = stage03Scene.sideView!.groundY;
  ok("stage03: lands back on ground", Math.abs(r.state.objects.player.y - groundY) < 1);

  const r2 = new SceneRuntime(stage03Scene);
  r2.state.objects.player.x = 55; // left jump pad
  tick(r2, 0.2);
  ok("stage03: jump pad launches", r2.state.objects.player.vy < 0);

  const m = mut(stage03Scene, "noBounce:jumpPadR");
  const r3 = new SceneRuntime(applyMutation(stage03Scene, m));
  r3.state.objects.player.x = 305;
  tick(r3, 0.2);
  ok("stage03: noBounce kills the right pad", r3.state.objects.player.vy === 0);

  const m2 = mut(stage03Scene, "noPlatform:platformL");
  const r4 = new SceneRuntime(applyMutation(stage03Scene, m2));
  r4.state.objects.player.x = 70;
  r4.state.objects.player.y = 480;
  tick(r4, 1.5);
  ok("stage03: noPlatform drops the player through", r4.state.objects.player.y > 500);
}

/* stage 6: the shooting gallery — tap a target, it drops and scores */
{
  const r = new SceneRuntime(stage06Scene);
  r.click("targetA");
  ok("stage06: tapping a target knocks it down", !r.state.objects.targetA.alive);
  ok("stage06: a hit scores", r.state.counters.score === 10 && r.state.counters.hits === 1);
  tick(r, 2);
  ok("stage06: the target pops back up", r.state.objects.targetA.alive);

  const dead = mut(stage06Scene, "noHit:targetB");
  const r2 = new SceneRuntime(applyMutation(stage06Scene, dead));
  r2.click("targetB");
  ok("stage06: a target that ignores taps stays up", r2.state.objects.targetB.alive);

  const skew = mut(stage06Scene, "counterSkew:targetA:score");
  const r3 = new SceneRuntime(applyMutation(stage06Scene, skew));
  r3.click("targetA");
  ok("stage06: counterSkew scores the wrong amount", r3.state.counters.score !== 10);

  const base = new SceneRuntime(stage06Scene);
  tick(base, 1);
  ok("stage06: targets ride their rails", base.state.objects.targetC.x > stage06Scene.objects.find(o => o.id === "targetC")!.x);
}

/*
 * Every judged scene opens on a briefing, so every judged scene needs the line
 * at the top of it.
 *
 * introKey is optional on SceneSpec because the rooms you walk around in have
 * no briefing, and four of them used to carry a line that was translated into
 * five languages and never once drawn. Optional is right for the type and
 * useless as a guarantee, so the guarantee lives here: a build the player has
 * to sign off on must be able to say what it is.
 */
for (const scene of ENGINE_SCENES) {
  ok(
    `${scene.id}: has an intro line to open the briefing with`,
    typeof scene.introKey === "string" && scene.introKey.length > 0
  );
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);

/* death: running out of health ends the run instead of respawning */
{
  const r = new SceneRuntime(stage03Scene);
  const spikes = stage03Scene.objects.find((o) => o.id === "spikes")!;
  r.state.objects.player.x = spikes.x;
  r.state.objects.player.y = spikes.y;
  let guard = 0;
  while (!r.state.dead && guard++ < 60 * 60) {
    r.tick(1 / 60);
    r.state.objects.player.x = spikes.x;
    r.state.objects.player.y = spikes.y;
  }
  ok("stage03: standing on spikes eventually kills you", r.state.dead === true);
  ok("stage03: health bottoms out at 0", r.state.counters.hp === 0);
  const before = r.state.counters.hp;
  r.tick(1 / 60);
  ok("stage03: no free respawn after death", r.state.counters.hp === before);

  const fresh = new SceneRuntime(stage03Scene);
  ok("stage03: player no longer spawns on the spikes",
     Math.abs(fresh.state.objects.player.x - spikes.x) > 30);
  ok("stage03: a fresh run starts alive", fresh.state.dead === false);
}
