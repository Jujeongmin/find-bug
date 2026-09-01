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
  "stage06:flipSprite:leverA",
  "stage06:flipSprite:leverC",
  "stage06:noAction:leverB",
];

const excluded = new Set(EXCLUDED_BUGS);

/** full id used by the review report and this list */
export function fullBugId(sceneId: string, bugId: string): string {
  return `${sceneId}:${bugId}`;
}

export function isExcluded(sceneId: string, bugId: string): boolean {
  return excluded.has(fullBugId(sceneId, bugId));
}
