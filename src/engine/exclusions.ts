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
  "stage02:floating:shield",
  "stage02:floating:sword",
  "stage02:mirrorShadow:apple",
  "stage02:mirrorShadow:merchant",
  "stage02:mirrorShadow:potion",
  "stage02:mirrorShadow:shield",
  "stage02:mirrorShadow:sword",
  "stage02:noAction:gem",
  "stage02:noAction:potion",
  "stage02:noAction:sword",
  "stage03:counterSkew:coin1:coins",
  "stage03:counterSkew:coin2:coins",
  "stage03:counterSkew:coin4:coins",
  "stage03:freezeAnimation:batA",
  "stage03:freezeAnimation:torch2",
  "stage03:noPlatform:platformR",
  "stage05:floating:crystal",
  "stage05:floating:herb",
  "stage05:mirrorShadow:books",
  "stage05:mirrorShadow:crystal",
  "stage05:mirrorShadow:herb",
  "stage05:mirrorShadow:scroll",
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
