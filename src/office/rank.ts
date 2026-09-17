/**
 * The player's rank, from how many builds they have mastered.
 *
 * A title and nothing else: it changes what the book, the first morning, the
 * ship screen and the developer's hello say, and no number in the day.
 * Worked out from the mastered list, which is worked out from the book, so
 * there is nothing to store and a wipe takes the rank with everything else.
 */

/** the mastered count each rank starts at: newcomer, junior, senior, lead, head */
export const RANK_STEPS = [0, 1, 3, 6, 9] as const;

export function rankOf(mastered: number): number {
  let rank = 0;
  RANK_STEPS.forEach((step, i) => {
    if (mastered >= step) rank = i;
  });
  return rank;
}

export const rankKey = (rank: number): string => `rank.${rank}`;
