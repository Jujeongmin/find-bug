/**
 * The star rating the build ships with.
 *
 * It used to subtract a fixed cost per defect that got out — a quarter star for
 * a low one, a full star for a critical — against a starting five. Over thirty
 * builds that hit the floor after four bad ones, and every run after that
 * scored the same 1.0 whether the player had missed five or twenty-five. The
 * number stopped being a report on the work.
 *
 * Now it is a share of what was at stake. Each build carries a weight by
 * severity, the rating falls from five to one as the lost weight goes from
 * none to all of it, and the square root puts the resolution where the play
 * is: the first defect to ship costs about a star, while the difference
 * between a bad run and a hopeless one still shows.
 */
export type Severity = "low" | "normal" | "critical";

/** what is riding on one build, by how bad its defect would be */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  normal: 2,
  critical: 4,
};

/**
 * A defect found but never walked over to the developer still ships. It counts
 * for half: the work was done and written down, and only the last few steps
 * were missing.
 */
export const LATE_WEIGHT = 0.5;

const weigh = (list: Severity[]) =>
  list.reduce((sum, sv) => sum + SEVERITY_WEIGHT[sv], 0);

/** everything that was ever at stake, given a day's worth of severities */
export function totalStake(days: number, perDay: Severity[]): number {
  return days * weigh(perDay);
}

/**
 * @param shipped severities of builds whose defect got out
 * @param late    severities of defects found but never handed over
 */
export function shipRating(
  shipped: Severity[],
  late: Severity[],
  stake: number
): number {
  const lost = weigh(shipped) + weigh(late) * LATE_WEIGHT;
  const share = stake > 0 ? Math.min(1, lost / stake) : 0;
  return Math.round((5 - 4 * Math.sqrt(share)) * 10) / 10;
}
