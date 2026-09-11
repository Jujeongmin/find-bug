import { stage01Scene } from "../src/stages/stage01/scene";
import { generateMutations, applyMutation } from "../src/engine/generate";
import { SceneRuntime } from "../src/engine/runtime";
import { streetScene } from "../src/street/scene";
import { laneScene } from "../src/street/lane";

const muts = generateMutations(stage01Scene);
const find = (id: string) => {
  const m = muts.find((x) => x.bug.id === id);
  if (!m) throw new Error("no mutation " + id);
  return m;
};
const tick = (r: SceneRuntime, secs: number) => {
  for (let i = 0; i < secs * 60; i++) r.tick(1 / 60);
};
/*
 * A check that cannot fail is not a check.
 *
 * This printed FAIL and then exited zero, so every assertion written with it
 * was decoration as far as `npm run verify` was concerned — the only things in
 * this file that could actually stop a build were the handful that throw. Found
 * by deliberately breaking one and watching the suite stay green.
 */
let failed = 0;
const ok = (label: string, cond: boolean) => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};
process.on("exit", () => {
  if (failed) {
    console.log(`\n${failed} failed`);
    process.exitCode = 1;
  }
});

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
  /*
   * Drift, on a scene made for the purpose.
   *
   * It used to be checked on stage one's cloud, which was the only object in
   * the whole game with the behaviour — so deleting a decoration deleted the
   * only coverage the behaviour had. A capability the runtime offers should be
   * tested by the runtime's own fixture, not by whichever scene happens to be
   * using it this month.
   */
  const drifting = {
    ...stage01Scene,
    objects: [
      ...stage01Scene.objects,
      {
        id: "driftProbe",
        nameKey: "object.cloud",
        kind: "decor" as const,
        x: 40,
        y: 40,
        render: { bar: { width: 10, height: 10 } },
        behaviors: [
          { t: "drift" as const, axis: "x" as const, speed: 14, wrapMin: -60, wrapMax: 420 },
        ],
      },
    ],
  };
  const d = new SceneRuntime(drifting);
  const c0 = d.state.objects.driftProbe.x;
  tick(d, 2);
  ok("runtime: drift moves an object", d.state.objects.driftProbe.x > c0);
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

/**
 * Eight-way facing. The browser pane this project is developed in suspends
 * requestAnimationFrame, so the game loop cannot be observed there — driving
 * the runtime directly is the only way to see which way a walk points.
 */
{
  const CASES: [string, number, number][] = [
    ["right", 1, 0],
    ["downRight", 1, 1],
    ["down", 0, 1],
    ["downLeft", -1, 1],
    ["left", -1, 0],
    ["upLeft", -1, -1],
    ["up", 0, -1],
    ["upRight", 1, -1],
  ];
  for (const [want, dx, dy] of CASES) {
    const rt = new SceneRuntime(streetScene);
    rt.stick = { x: dx, y: dy };
    rt.tick(0.05);
    const got = rt.state.objects.player.dir4;
    if (got !== want) throw new Error(`facing (${dx},${dy}) gave ${got}, want ${want}`);
    if (!rt.state.objects.player.moving) throw new Error("walking but not marked moving");
  }
  const still = new SceneRuntime(streetScene);
  still.tick(0.05);
  if (still.state.objects.player.moving) throw new Error("standing still but marked moving");
  console.log("PASS  eight facings, and standing still is not moving");

  /* shift turns without walking */
  const turn = new SceneRuntime(streetScene);
  const from = { ...turn.state.objects.player };
  turn.keys.add("shift");
  turn.keys.add("arrowleft");
  tick(turn, 0.5);
  const p = turn.state.objects.player;
  ok("runtime: shift turns the player", p.dir4 === "left");
  ok(
    "runtime: and leaves their feet where they were",
    p.x === from.x && p.y === from.y && !p.moving
  );
  turn.keys.delete("shift");
  tick(turn, 0.2);
  ok("runtime: letting go walks again", turn.state.objects.player.x < from.x);
}

/*
 * The machine on the pavement is a rectangle, and one circle over a rectangle
 * leaves its corners open. Every corner of its footprint has to be solid, or
 * the player walks up the outside of it and stands in the middle of the art.
 */
{
  const rt = new SceneRuntime(streetScene);
  // every corner of the body, the sign standing on top of it, and the middle
  const CORNERS: [number, number][] = [
    [8, 302],
    [52, 302],
    [8, 366],
    [52, 366],
    [30, 334],
    [30, 290],
  ];
  for (const [x, y] of CORNERS) {
    if (!rt.blockedAt(x, y)) {
      throw new Error(`the vending machine is walkable at ${x},${y}`);
    }
  }
  ok("runtime: the vending machine is solid to its corners", true);
  // and the pavement around it is not: a machine you cannot walk past is a wall
  for (const [x, y] of [[30, 386], [60, 334], [30, 284]] as [number, number][]) {
    if (rt.blockedAt(x, y)) throw new Error(`the pavement is walled at ${x},${y}`);
  }
  ok("runtime: and the pavement beside it is not", true);

  /*
   * The lamp is a post with arms on it. The post is what you walk into; the
   * pavement either side of it is not, or the street is a fence.
   */
  const post: [number, number][] = [
    [28, 450],
    [28, 480],
    [28, 514],
  ];
  for (const [x, y] of post) {
    if (!rt.blockedAt(x, y)) throw new Error(`the lamp post is walkable at ${x},${y}`);
  }
  for (const [x, y] of [[16, 480], [40, 480]] as [number, number][]) {
    if (rt.blockedAt(x, y)) throw new Error(`the pavement is walled at ${x},${y}`);
  }
  ok("runtime: the lamp post is solid the whole way up, and only the post", true);
}

/*
 * The stall is two parasols over a counter, hung from its feet, so all of its
 * art is above the point it stands at — the thing a box on a sprite has to be
 * moved for.
 */
{
  const rt = new SceneRuntime(laneScene);
  const inside: [number, number][] = [
    [286, 560],
    [250, 540],
    [322, 592],
  ];
  for (const [x, y] of inside) {
    if (!rt.blockedAt(x, y)) throw new Error(`the stall is walkable at ${x},${y}`);
  }
  /*
   * And the empty pavement around it, including the strip above the canopy:
   * the parasols do not reach the top of their own tiles, and a box the size
   * of the cell walls off eighteen pixels of nothing.
   */
  for (const [x, y] of [[230, 560], [286, 520]] as [number, number][]) {
    if (rt.blockedAt(x, y)) throw new Error(`the block is walled at ${x},${y}`);
  }
  ok("runtime: the stall is solid where it is drawn, and nowhere else", true);

  /*
   * And nobody squeezes under it. The tent stands eight pixels off the bottom
   * of the block, which is a gap somebody will walk through — behind the
   * canopy, so it reads as walking through the stall itself.
   */
  for (const [x, y] of [[286, 600], [286, 604]] as [number, number][]) {
    if (!rt.blockedAt(x, y)) throw new Error(`there is a way under the stall at ${x},${y}`);
  }
  ok("runtime: and there is no squeezing under it", true);
}

/*
 * The people on the street walk about and talk to themselves.
 *
 * Both are timed and both are random, so what is checked is what has to hold
 * every time: they stay inside the box they were given, they never stand
 * inside something solid, and a mutter goes up and comes down again.
 */
{
  const rt = new SceneRuntime(streetScene);
  const spec = streetScene.objects.find((o) => o.id === "passer0")!;
  const box = spec.behaviors.find((b) => b.t === "wander");
  if (!box || box.t !== "wander") throw new Error("passer0 does not wander");
  const start = { ...rt.state.objects.passer0 };
  let moved = 0;
  let saidSomething = false;
  let wentQuietAgain = false;
  let wasSaying = false;
  for (let i = 0; i < 60 * 60; i++) {
    rt.tick(1 / 60);
    const os = rt.state.objects.passer0;
    if (Math.hypot(os.x - start.x, os.y - start.y) > 8) moved++;
    // the walls are the box, plus a step of slack: the goal is inside it and
    // the last step of any walk lands on the goal
    if (os.x < box.minX - 2 || os.x > box.maxX + 2) {
      throw new Error(`wandered out of its box: x ${os.x}`);
    }
    if (os.y < box.minY - 2 || os.y > box.maxY + 2) {
      throw new Error(`wandered out of its box: y ${os.y}`);
    }
    if (rt.blockedAt(os.x, os.y, "passer0")) {
      throw new Error(`walked into something solid at ${os.x},${os.y}`);
    }
    if (os.says) {
      saidSomething = true;
      wasSaying = true;
    } else if (wasSaying) {
      wentQuietAgain = true;
    }
  }
  ok("runtime: a minute of street leaves nobody where they started", moved > 0);
  ok("runtime: and nobody inside a wall", true);
  ok("runtime: somebody says something to themselves", saidSomething);
  ok("runtime: and stops saying it", wentQuietAgain);
}

/* the ship rating spreads across the play, instead of pinning to the floor */
{
  const { shipRating, totalStake } = await import("../src/office/rating");
  type Sev = "low" | "normal" | "critical";
  const stake = totalStake(10, ["low", "normal", "critical"]);
  const fill = (n: number, sv: Sev): Sev[] => Array.from({ length: n }, () => sv);

  const clean = shipRating([], [], stake);
  if (clean !== 5) throw new Error(`a clean ship should be 5.0, got ${clean}`);

  const everything = shipRating(
    [...fill(10, "low"), ...fill(10, "normal"), ...fill(10, "critical")],
    [],
    stake
  );
  if (everything !== 1) throw new Error(`shipping every defect should be 1.0, got ${everything}`);

  // one critical out of thirty builds is one star, and a low one is not
  const oneCritical = shipRating(["critical"], [], stake);
  const oneLow = shipRating(["low"], [], stake);
  if (!(oneCritical > 3.7 && oneCritical < 4.3))
    throw new Error(`one critical shipped should cost about a star, got ${oneCritical}`);
  if (!(oneLow > oneCritical))
    throw new Error("a low defect should cost less than a critical one");

  // the middle of the range is where a rating earns its keep: these used to
  // collapse onto 1.0 together
  const third = shipRating(fill(10, "normal"), [], stake);
  const half = shipRating([...fill(5, "critical"), ...fill(5, "normal")], [], stake);
  if (!(third > 2 && third < 3.5)) throw new Error(`ten normal defects out: ${third}`);
  if (!(half < third)) throw new Error("losing more should never score higher");

  // undelivered counts, but for less than never having looked
  const found = shipRating([], ["critical"], stake);
  if (!(found > oneCritical)) throw new Error("finding it should beat missing it");
  if (!(found < 5)) throw new Error("finding it and sitting on it is not a clean ship");

  console.log("PASS  ship rating: clean 5.0, all out 1.0, and the middle spreads");
}

/*
 * Nobody on the pavement gets to stand on you.
 *
 * A passer-by is a blocker as well as a wanderer, and the player is neither —
 * so the wandering half walked straight onto the player's own square, and the
 * blocking half then had the player inside a circle rather than pressed up
 * against one. Inside it, every escape the movement code knows how to try —
 * the diagonal, each axis on its own, and the tangent past the edge — is still
 * inside it, so all four failed and the player stood there until the passer
 * happened to wander off. It pauses for up to four and a half seconds at a
 * time, so "happened to" was most of a morning.
 *
 * Two things are checked, because either alone leaves the fault reachable: a
 * walker does not step onto the player, and a player who is inside a blocker
 * anyway can always get back out of it.
 */
{
  const rt = new SceneRuntime(streetScene);
  const p = rt.state.objects.player;
  const q = rt.state.objects.passer0;
  // stand the player in the middle of where passer0 walks, and hold still.
  // Not on its starting square: the check is whether a minute of wandering
  // ever arrives on the player, not whether it can leave a spot it was
  // already sharing.
  p.x = 150;
  p.y = 380;
  let landedOn = 0;
  for (let i = 0; i < 60 * 60; i++) {
    rt.tick(1 / 60);
    if (Math.hypot(q.x - p.x, q.y - p.y) < 8) landedOn++;
  }
  ok("a passer-by never walks onto the player", landedOn === 0);
}

{
  const rt = new SceneRuntime(streetScene);
  const p = rt.state.objects.player;
  // The same trap, held still. A passer-by walks off in half a second and
  // frees the player by accident, which is not the property being checked —
  // the crate by the wall never moves, so being inside it stays being inside
  // it until the movement code itself does something about it.
  const c = rt.state.objects.crateStreet;
  p.x = c.x;
  p.y = c.y;
  const from = { x: p.x, y: p.y };
  rt.keys.add("arrowdown");
  for (let i = 0; i < 30; i++) rt.tick(1 / 60);
  rt.keys.clear();
  ok(
    "and a player caught inside one can always walk out",
    Math.hypot(p.x - from.x, p.y - from.y) > 4
  );
}

/*
 * A wall is a wall all the way to its corners.
 *
 * solid() used to lay a row of overlapping circles along a building's face, on
 * the reasoning that blocking is round and a face is not. A circle cannot
 * reach into a corner, and two side by side leave a scallop between them: on
 * the house — 178 by 88, four circles of radius 44 — the top corners were open
 * for thirty pixels each. What that looked like was a player standing inside
 * their own front wall, which is how it was reported.
 *
 * Every point inside the wall is checked rather than a sample, because the
 * holes were in the places a sample would miss.
 */
{
  const rt = new SceneRuntime(laneScene);
  const wall = { x: 91, y: 272, w: 178, h: 88 };
  let open = 0;
  let first = "";
  for (let y = wall.y + 1; y < wall.y + wall.h; y++) {
    for (let x = wall.x + 1; x < wall.x + wall.w; x++) {
      if (!rt.blockedAt(x, y)) {
        if (!open) first = `${x},${y}`;
        open++;
      }
    }
  }
  ok(
    `the house blocks every point inside it${open ? ` — ${open} open, first at ${first}` : ""}`,
    open === 0
  );

  // and it is not fatter than the art: the pavement either side is walkable
  ok(
    "and the pavement beside it still is not blocked",
    !rt.blockedAt(wall.x - 2, wall.y + wall.h / 2) &&
      !rt.blockedAt(wall.x + wall.w + 2, wall.y + wall.h / 2)
  );
}
