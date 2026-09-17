/**
 * The player's rank, from how many builds they have mastered.
 *
 * A title and nothing else: it changes what the book, the first morning, the
 * ship screen and the developer's hello say, and no number in the day.
 * Worked out from the mastered list, which is worked out from the book, so
 * there is nothing to store and a wipe takes the rank with everything else.
 */

import { buildIdsFor } from "./schedule";

/**
 * The mastered count each rank starts at: newcomer, junior, senior, lead,
 * and head of QA, which is every build there is — so a build added in a
 * later year moves the last step with it.
 */
export const RANK_STEPS: readonly number[] = [
  0,
  1,
  3,
  6,
  buildIdsFor(Number.MAX_SAFE_INTEGER).length,
];

export function rankOf(mastered: number): number {
  let rank = 0;
  RANK_STEPS.forEach((step, i) => {
    if (mastered >= step) rank = i;
  });
  return rank;
}

export const rankKey = (rank: number): string => `rank.${rank}`;
