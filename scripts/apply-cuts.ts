import * as fs from "fs";
import { generateMutations } from "../src/engine/generate";
import { ENGINE_SCENES } from "../src/stages/registry";

/**
 * Review cuts: near-identical bugs on interchangeable peers. One instance of
 * each is kept so the bug type still appears; the duplicates are dropped so a
 * single idea can't dominate a stage's pool.
 */
const CUTS: Record<string, Record<string, string[]>> = {
  stage01: {
    // a hopping slime that floats reads as hopping — ambiguous, drop entirely
    floating: ["slimeA", "slimeB", "slimeC"],
    // 9 shadow bugs in one scene is too many; keep player / potion / tree1
    mirrorShadow: ["slimeA", "slimeB", "slimeC", "tree2", "sign", "well"],
    bounceOnEnd: ["slimeA", "slimeB"],
    teleportOnEnd: ["slimeB", "slimeC"],
    freezeAnimation: ["slimeA", "slimeC"],
    counterSkew: ["slimeB", "slimeC"],
    offColor: ["slimeA", "slimeC", "tree2"],
  },
  stage02: {
    floating: ["potion", "sword", "shield", "cat"],
    mirrorShadow: ["apple", "potion", "sword", "shield", "merchant"],
    // five shelf items with the same dead-click bug; keep apple + shield
    noAction: ["potion", "sword", "gem"],
    offColor: ["apple", "potion", "shield"],
  },
  stage03: {
    // four identical coins; keep one of each coin-based bug
    counterSkew: ["coin1", "coin2", "coin4"],
    offColor: ["platformL", "platformR", "jumpPadR", "coin1", "coin3", "coin4", "torch2"],
    freezeAnimation: ["batA", "torch2"],
    noPlatform: ["platformR"],
  },
  stage05: {
    mirrorShadow: ["herb", "crystal", "books", "scroll"],
    offColor: ["herb", "crystal"],
    floating: ["herb", "crystal"],
  },
  stage06: {
    flipSprite: ["leverA", "leverC"],
    noAction: ["leverB"],
    offColor: ["doorA", "doorC"],
  },
};

const ids: string[] = [];
const missing: string[] = [];
for (const scene of ENGINE_SCENES) {
  const spec = CUTS[scene.id];
  if (!spec) continue;
  const muts = generateMutations(scene);
  for (const [mutatorId, objects] of Object.entries(spec)) {
    for (const objectId of objects) {
      const hit = muts.find(
        (m) => m.mutator.id === mutatorId && m.target.objectId === objectId
      );
      if (hit) ids.push(`${scene.id}:${hit.bug.id}`);
      else missing.push(`${scene.id}:${mutatorId}:${objectId}`);
    }
  }
}

const header = `/**
 * Bugs removed after review.
 *
 * Paste a bug id here to drop it from every stage pool. Ids come from the
 * review report (\`npm run report\`) and look like:
 *   "stage01:floating:sign"        scene : mutator : object
 *   "stage06:wiringSwap:leverA:leverB"
 *
 * Excluding is safe: the curriculum re-checks pool sizes, and \`npm run verify\`
 * fails loudly if a stage drops below MIN_POOL bugs.
 *
 * The current entries are duplicate bugs on interchangeable peers — one of each
 * kind is kept, the rest dropped so no single idea dominates a pool.
 */
export const EXCLUDED_BUGS: string[] = [
${ids
  .sort()
  .map((i) => `  "${i}",`)
  .join("\n")}
];

const excluded = new Set(EXCLUDED_BUGS);

/** full id used by the review report and this list */
export function fullBugId(sceneId: string, bugId: string): string {
  return \`\${sceneId}:\${bugId}\`;
}

export function isExcluded(sceneId: string, bugId: string): boolean {
  return excluded.has(fullBugId(sceneId, bugId));
}
`;

fs.writeFileSync("src/engine/exclusions.ts", header, "utf8");
console.log(`wrote ${ids.length} exclusions`);
if (missing.length) console.log("NOT FOUND (already gated out):\n  " + missing.join("\n  "));
