import { stage01Scene } from "../src/stages/stage01/scene";
import { generateMutations, applyMutation } from "../src/engine/generate";
import { SceneRuntime } from "../src/engine/runtime";

const muts = generateMutations(stage01Scene);
const find = (id: string) => {
  const m = muts.find((x) => x.bug.id === id);
  if (!m) throw new Error("no mutation " + id);
  return m;
};
const tick = (r: SceneRuntime, secs: number) => {
  for (let i = 0; i < secs * 60; i++) r.tick(1 / 60);
};
const ok = (label: string, cond: boolean) =>
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

/* baseline: no mutation */
{
  const r = new SceneRuntime(stage01Scene);
  r.state.objects.player.x = r.state.objects.slimeA.x;
  r.state.objects.player.y = r.state.objects.slimeA.y;
  r.click("attackBtn");
  ok("baseline: attack button kills a slime", !r.state.objects.slimeA.alive);
  ok("baseline: score +10", r.state.counters.score === 10);
}

/* B1 noAction */
{
  const m = find("noAction:attackBtn");
  const r = new SceneRuntime(applyMutation(stage01Scene, m));
  r.state.objects.player.x = r.state.objects.slimeA.x;
  r.state.objects.player.y = r.state.objects.slimeA.y;
  r.click("attackBtn");
  ok("B1: button does nothing", r.state.objects.slimeA.alive);
  const r2 = new SceneRuntime(applyMutation(stage01Scene, m));
  r2.state.objects.player.x = r2.state.objects.slimeA.x;
  r2.state.objects.player.y = r2.state.objects.slimeA.y;
  r2.doAttack(70);
  ok("B1: spacebar attack still works", !r2.state.objects.slimeA.alive);
}

/* B2 freezeAnimation */
{
  const s = applyMutation(stage01Scene, find("freezeAnimation:slimeB"));
  const b = s.objects.find((o) => o.id === "slimeB")!;
  const a = s.objects.find((o) => o.id === "slimeA")!;
  ok("B2: slimeB lost animate", !b.behaviors.some((x) => x.t === "animate"));
  ok("B2: slimeA kept animate", a.behaviors.some((x) => x.t === "animate"));
  ok("B2: slimeB still patrols", b.behaviors.some((x) => x.t === "patrol"));
}

/* B3 mirrorShadow */
{
  const s = applyMutation(stage01Scene, find("mirrorShadow:player"));
  const p = s.objects.find((o) => o.id === "player")!;
  const other = s.objects.find((o) => o.id === "tree1")!;
  ok("B3: player shadow flipped", p.render.shadow!.offsetX < 0);
  ok("B3: other shadows unchanged", other.render.shadow!.offsetX > 0);
}

/* B4 floating */
{
  const s = applyMutation(stage01Scene, find("floating:potion"));
  const p = s.objects.find((o) => o.id === "potion")!;
  ok("B4: potion lifted", (p.render.liftY ?? 0) > 0);
  ok("B4: shadow stays on ground", p.render.shadow !== undefined);
}

/* B5 counterSkew */
{
  const r = new SceneRuntime(applyMutation(stage01Scene, find("counterSkew:slimeA:score")));
  r.state.objects.player.x = r.state.objects.slimeA.x;
  r.state.objects.player.y = r.state.objects.slimeA.y;
  r.doAttack(70);
  const popup = r.state.popups.find((p) => p.text.startsWith("+"));
  // counterSkew now doubles the real change while the popup keeps the design value
  ok("B5: score moves by a different amount than shown", r.state.counters.score === 20);
  ok("B5: popup still claims +10", popup?.text === "+10");
}

/* B6 noCollision */
{
  const base = new SceneRuntime(stage01Scene);
  base.state.objects.player.x = stage01Scene.objects.find(o=>o.id==="tree1")!.x + 45;
  base.state.objects.player.y = stage01Scene.objects.find(o=>o.id==="tree1")!.y;
  base.keys.add("arrowleft");
  tick(base, 1);
  const blockedX = base.state.objects.player.x;

  const r = new SceneRuntime(applyMutation(stage01Scene, find("noCollision:tree1")));
  r.state.objects.player.x = stage01Scene.objects.find(o=>o.id==="tree1")!.x + 45;
  r.state.objects.player.y = stage01Scene.objects.find(o=>o.id==="tree1")!.y;
  r.keys.add("arrowleft");
  tick(r, 1);
  ok("B6: normally blocked by tree1", blockedX > stage01Scene.objects.find(o=>o.id==="tree1")!.x);
  ok("B6: passes through when mutated", r.state.objects.player.x < blockedX - 20);
}

/* generic runtime sanity */
{
  const r = new SceneRuntime(stage01Scene);
  const c0 = r.state.objects.cloud.x;
  tick(r, 2);
  ok("runtime: cloud drifts", r.state.objects.cloud.x > c0);
  const s0 = r.state.objects.slimeA.x;
  tick(r, 1);
  ok("runtime: slime patrols", r.state.objects.slimeA.x !== s0);
  const r2 = new SceneRuntime(stage01Scene);
  r2.state.objects.player.x = r2.state.objects.potion.x;
  r2.state.objects.player.y = r2.state.objects.potion.y;
  r2.state.counters.hp = 2;
  tick(r2, 0.1);
  ok("runtime: potion heals", r2.state.counters.hp === 4);
}
