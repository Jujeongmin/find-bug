import { generateMutations, applyMutation } from "../src/engine/generate";
import { SceneRuntime } from "../src/engine/runtime";
import { ENGINE_SCENES } from "../src/stages/registry";
import { stage03Scene } from "../src/stages/stage03/scene";
import { stage06Scene } from "../src/stages/stage06/scene";
import { stage08Scene } from "../src/stages/stage08/scene";
import { stage09Scene } from "../src/stages/stage09/scene";

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

/*
 * The two bats are peers, so they fly the same orbit at the same pace and
 * differ only in height. They used to differ in speed and in width as well,
 * and a player who reported "one bat is faster" was marked wrong, because
 * no fault makes a bat faster: the difference was the level, not a defect.
 */
{
  const bats = stage03Scene.objects.filter((o) => o.peerGroup === "bat");
  const orbit = (o: (typeof bats)[number]) => {
    const f = o.behaviors.find((b) => b.t === "sineFly");
    return f && f.t === "sineFly" ? { cx: f.cx, ampX: f.ampX, ampY: f.ampY, speed: f.speed } : null;
  };
  const orbits = bats.map((b) => JSON.stringify(orbit(b)));
  ok(`stage03: the two bats fly the same orbit (${orbits.join(" / ")})`,
     bats.length === 2 && orbits[0] !== "null" && orbits[0] === orbits[1]);

  // and no fault is allowed to change how a bat flies: a bat's speed is not
  // something a player can be asked to judge
  const reshaped = generateMutations(stage03Scene)
    .filter((m) => bats.some((b) => b.id === m.target.objectId))
    .filter((m) => {
      const after = applyMutation(stage03Scene, m).objects.find((o) => o.id === m.target.objectId)!;
      return JSON.stringify(orbit(after)) !== JSON.stringify(orbit(stage03Scene.objects.find((o) => o.id === m.target.objectId)!));
    })
    .map((m) => m.bug.id);
  ok(`stage03: no fault changes a bat's speed or path${reshaped.length ? " — " + reshaped.join(", ") : ""}`,
     reshaped.length === 0);
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

/* stage 8: the mine — each lever lifts the gate above it, and only that one */
{
  const r = new SceneRuntime(stage08Scene);
  r.click("leverA");
  ok("stage08: lever A lifts gate A and only gate A",
     r.isTriggered("gateA") && !r.isTriggered("gateB") && !r.isTriggered("gateC"));
  tick(r, 3);
  ok("stage08: the gate comes back down", !r.isTriggered("gateA"));

  const crossed = new SceneRuntime(applyMutation(stage08Scene, mut(stage08Scene, "wiringSwap:leverA:leverB")));
  crossed.click("leverA");
  ok("stage08: with the wires crossed, lever A lifts gate B",
     !crossed.isTriggered("gateA") && crossed.isTriggered("gateB"));

  const dead = new SceneRuntime(applyMutation(stage08Scene, mut(stage08Scene, "noAction:leverB")));
  dead.click("leverB");
  ok("stage08: a dead lever lifts nothing", !dead.isTriggered("gateB"));

  const rc = new SceneRuntime(stage08Scene);
  const chest = stage08Scene.objects.find((o) => o.id === "chest2")!;
  rc.state.objects.player.x = chest.x;
  rc.state.objects.player.y = chest.y;
  tick(rc, 0.1);
  ok("stage08: walking onto a chest takes it for 10 gold",
     rc.state.counters.gold === 10 && !rc.state.objects.chest2.alive);
  rc.state.objects.player.x = 180;
  rc.state.objects.player.y = 400;
  tick(rc, 6.2);
  ok("stage08: the chest is back six seconds later", rc.state.objects.chest2.alive);

  const rh = new SceneRuntime(stage08Scene);
  const spider = stage08Scene.objects.find((o) => o.id === "spider1")!;
  rh.state.objects.player.x = spider.x;
  rh.state.objects.player.y = spider.y + 10;
  tick(rh, 0.1);
  ok("stage08: a spider hurts", rh.state.counters.hp === 2);

  const rb = new SceneRuntime(stage08Scene);
  let lo = 999, hi = -999;
  for (let i = 0; i < 60 * 12; i++) {
    rb.tick(1 / 60);
    lo = Math.min(lo, rb.state.objects.barrel1.x);
    hi = Math.max(hi, rb.state.objects.barrel1.x);
  }
  ok(`stage08: an ore barrel rides the whole rail and stays on it (${lo.toFixed(0)}..${hi.toFixed(0)})`,
     lo >= 50 && hi <= 310 && hi - lo > 200);

  const pair = stage08Scene.objects.filter((o) => o.peerGroup === "barrel");
  const runs = pair.map((o) => JSON.stringify(o.behaviors));
  ok("stage08: the two barrels share one run and one speed", runs.length === 2 && runs[0] === runs[1]);
}

/* stage 9: the kitchen — a knob lights its own burner, and its thermometer climbs */
{
  const r = new SceneRuntime(stage09Scene);
  r.click("knobL");
  ok("stage09: the left knob lights the left burner only",
     r.state.flags.fireL === true && !r.state.flags.fireR);
  tick(r, 2);
  const h = r.state.counters.heatL;
  ok(`stage09: the left heat rises, the right does not (${h.toFixed(1)})`,
     h > 55 && h < 65 && r.state.counters.heatR === 0);
  r.click("knobL");
  tick(r, 2);
  ok("stage09: the heat falls again when the burner is off", r.state.counters.heatL < h);

  const inverted = applyMutation(stage09Scene, mut(stage09Scene, "invertMeter:gaugeL"));
  const meter = inverted.objects.find((o) => o.id === "gaugeL")!.behaviors.find((b) => b.t === "meter");
  ok("stage09: invertMeter turns the left thermometer backwards",
     !!meter && meter.t === "meter" && meter.invert === true);

  const dead = new SceneRuntime(applyMutation(stage09Scene, mut(stage09Scene, "noAction:knobR")));
  dead.click("knobR");
  tick(dead, 1);
  ok("stage09: a dead knob lights nothing", !dead.state.flags.fireR && dead.state.counters.heatR === 0);

  const rp = new SceneRuntime(stage09Scene);
  const dish = stage09Scene.objects.find((o) => o.id === "dish1")!;
  rp.state.objects.player.x = dish.x;
  rp.state.objects.player.y = dish.y;
  tick(rp, 0.1);
  ok("stage09: taking a dish serves an order", rp.state.counters.served === 1);

  const rw = new SceneRuntime(stage09Scene);
  const x0 = rw.state.objects.customer1.x;
  tick(rw, 3);
  ok("stage09: the customers walk", rw.state.objects.customer1.x !== x0);

  const pairs = ["gauge", "knob", "customer"].map((g) => {
    const runs = stage09Scene.objects
      .filter((o) => o.peerGroup === g)
      .map((o) => JSON.stringify(o.behaviors).replace(/"(fire|heat)[LR]"/g, '"$1"'));
    return runs.length === 2 && runs[0] === runs[1];
  });
  ok("stage09: each left-and-right pair behaves identically", pairs.every(Boolean));
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
process.exitCode = fails ? 1 : 0;
