/**
 * Bugs removed after review.
 *
 * Paste a bug id here to drop it from every stage pool. Ids come from the
 * review report (`npm run report`) and look like:
 *   "stage06:wiringSwap:leverA:leverB"
 *
 * Excluding is safe: the curriculum re-checks pool sizes, and `npm run verify`
 * fails loudly if a stage drops below MIN_POOL bugs.
 *
 * The current entries are duplicate bugs on interchangeable peers — one of each
 * kind is kept, the rest dropped so no single idea dominates a pool.
 */
export const EXCLUDED_BUGS: string[] = [
  "stage01:bounceOnEnd:slimeA:bounce",
  "stage01:bounceOnEnd:slimeB:bounce",
  "stage01:counterSkew:slimeB:score",
  "stage01:counterSkew:slimeC:score",
  /*
   * Floating, on the three trees.
   *
   * The tell is the gap the lift opens between a thing and the shadow it
   * leaves on the ground, and the lift is a flat twenty-eight pixels however
   * big the thing is. On a shop counter's bread that is ninety-two per cent
   * of the loaf and unmissable. On a tree it is fifty-five, under a canopy
   * that is most of what the eye is looking at, and in the forest it is a
   * dark shadow on dark grass as well.
   *
   * Reported as not reading at all, and the measurements agree: the trees are
   * the three largest things floating can be planted on, and there is a clear
   * gap between them and everything else it can reach.
   */
  "stage01:floating:tree1",
  "stage01:floating:tree2",
  "stage05:floating:tree3",
  "stage01:floating:slimeA",
  "stage01:floating:slimeB",
  "stage01:floating:slimeC",
  "stage01:freezeAnimation:slimeA",
  "stage01:freezeAnimation:slimeC",
  "stage01:mirrorShadow:slimeA",
  "stage01:mirrorShadow:slimeB",
  "stage01:mirrorShadow:slimeC",
  "stage01:mirrorShadow:tree2",
  "stage01:teleportOnEnd:slimeB:teleport",
  "stage01:teleportOnEnd:slimeC:teleport",
  /*
   * The candles. Both of them, so the idea goes rather than one half of it.
   *
   * A frozen flame is a fair defect on paper — there are two candles, so the
   * still one has a moving one beside it to be judged against. In the room it
   * is not: a flame that flickers on a 0.6s cycle and a flame that does not
   * look alike for most of any second you spend looking, and the player is
   * asked to hold two of them in their eye at once, at opposite ends of the
   * shop, while the clock runs. That is a test of patience rather than of
   * noticing.
   *
   * The other candle defect stays: an offset glow is wrong wherever the flame
   * happens to be in its cycle, so it can be seen rather than waited out.
   */
  "stage02:freezeAnimation:candle1",
  "stage02:freezeAnimation:candle2",
  "stage02:floating:cat",
  "stage02:floating:potion",
  "stage02:mirrorShadow:merchant",
  "stage02:mirrorShadow:potion",
  "stage02:noAction:potion",
  "stage03:counterSkew:coin1:coins",
  "stage03:counterSkew:coin2:coins",
  "stage03:counterSkew:coin4:coins",
  "stage03:freezeAnimation:batA",
  "stage03:freezeAnimation:torch2",
  "stage03:noPlatform:platformR",
  "stage05:counterSkew:herb3:herbs",
  "stage05:counterSkew:herb4:herbs",
  "stage05:counterSkew:herb5:herbs",
  "stage05:floating:bug1",
  "stage05:floating:bug2",
  "stage05:floating:herb1",
  "stage05:floating:herb2",
  "stage05:floating:herb3",
  "stage05:floating:herb4",
  "stage05:floating:herb5",
  "stage05:floating:spring",
  "stage05:floating:toad1",
  "stage05:floating:toad3",
  "stage05:floating:tree1",
  "stage05:floating:tree2",
  "stage05:noCollision:tree1",
  "stage05:noDamage:bug1",
  "stage05:noDamage:bug2",
  "stage05:noDamage:toad3",
  "stage05:noPickup:herb3",
  "stage05:noPickup:herb4",
  "stage05:noPickup:herb5",
  "stage05:noRespawn:herb3",
  "stage05:noRespawn:herb4",
  "stage05:noRespawn:herb5",
  /*
   * Wrapping round, on the shooting range's targets.
   *
   * teleportOnEnd makes a patrolling thing reach the end of its run and come
   * back on from the other side instead of turning. Everywhere else it is
   * planted that is plainly wrong, because the thing it is planted on is
   * alive or is under the player's feet: a slime does not teleport across an
   * arena, a wasp does not cross a field in one frame, and a platform that
   * vanishes from under you is the clearest fault in the game.
   *
   * A target on a rail is none of those. A shooting gallery where the row
   * slides one way and comes round again is a shooting gallery; so is one
   * that slides back and forth. There is no intuition saying which of the two
   * a target owes you, so the defect asks the player to notice a difference
   * and then guess which side of it is the bug — and the peers do not settle
   * it either, because either pattern reads as a different rail rather than
   * as a broken one.
   *
   * Reported as not reading as a fault at all. The same reasoning as the
   * floating trees above: the tell has to be something the player already
   * expects of the object, and here they expect nothing.
   */
  "stage06:teleportOnEnd:targetA:teleport",
  "stage06:teleportOnEnd:targetB:teleport",
  "stage06:teleportOnEnd:targetC:teleport",
  "stage06:flipSprite:leverA",
  "stage06:flipSprite:leverC",
  "stage06:noAction:leverB",
  /*
   * Wrapping round, on the mine's ore barrels.
   *
   * The same reasoning that took it off the shooting range's targets: a
   * thing riding a rail has no end behaviour the player already expects of
   * it. A barrel that reaches the end of the track and comes back on from
   * the other side reads as a loop line, not a broken one. The barrels keep
   * the recoil fault, which is wrong whichever way a rail runs.
   */
  "stage08:teleportOnEnd:barrel1:teleport",
  "stage08:teleportOnEnd:barrel2:teleport",
];

const excluded = new Set(EXCLUDED_BUGS);

/** full id used by the review report and this list */
export function fullBugId(sceneId: string, bugId: string): string {
  return `${sceneId}:${bugId}`;
}

export function isExcluded(sceneId: string, bugId: string): boolean {
  return excluded.has(fullBugId(sceneId, bugId));
}
