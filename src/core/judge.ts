import type { BugCategory, BugDef, Verdict } from "./types";

/**
 * Deterministic judging: the picked object AND category must both match.
 * The verdict never leaks which half was wrong to the UI shown on failure —
 * callers must only use `correct` for player-facing feedback.
 */
export function judge(
  activeBug: BugDef,
  pickedObjectId: string,
  pickedCategory: BugCategory
): Verdict {
  const objectCorrect = activeBug.objectIds.includes(pickedObjectId);
  const categoryCorrect =
    activeBug.category === pickedCategory ||
    !!activeBug.alsoCategories?.includes(pickedCategory);
  return {
    correct: objectCorrect && categoryCorrect,
    objectCorrect,
    categoryCorrect,
  };
}

/** Pick a random bug from the pool, excluding the previously used one. */
export function pickBug(pool: BugDef[], excludeId?: string): BugDef {
  const candidates =
    pool.length > 1 && excludeId
      ? pool.filter((b) => b.id !== excludeId)
      : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
