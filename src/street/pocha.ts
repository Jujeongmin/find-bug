/**
 * The stall at the end of your own block, and the person running it.
 *
 * It used to be a vending machine that happened to sell soup: walk up, pay
 * twenty-five, read the line about what it cost. The one thing money buys in
 * this game that is not equipment was the one thing in it nobody said anything
 * about.
 *
 * So the owner gets a line every night, chosen from what they can see: whether
 * they have met you before, what the week is, and the state you turned up in.
 * The mechanical line — what it cost and what it did — still follows it, so
 * the numbers are never hidden behind the talk.
 */
export interface PochaNight {
  /** nights already eaten here this run, before tonight */
  nights: number;
  /** spirits as they are on arrival, before the bowl */
  spirit: number;
  /** the ceiling spirits are measured against */
  max: number;
  /** the week the code is frozen */
  freeze: boolean;
  /** the last night of the fortnight */
  lastDay: boolean;
}

/**
 * Which line the owner says tonight.
 *
 * Order matters: meeting you at all comes before the week, the week before the
 * shape you are in — a stranger does not comment on your face, and somebody
 * who has watched you all fortnight does.
 */
export function pochaLine(n: PochaNight): string {
  if (n.nights === 0) return "pocha.first";
  if (n.lastDay) return "pocha.last";
  if (n.freeze) return "pocha.freeze";
  const band = n.spirit <= 1 ? "low" : n.spirit >= n.max - 1 ? "high" : "mid";
  // two of each, alternating, so a fortnight of the same band is not one
  // sentence said six times
  return `pocha.${band}${n.nights % 2}`;
}

/** every dictionary key the owner can ask for */
export function pochaKeys(): string[] {
  return [
    "pocha.first",
    "pocha.last",
    "pocha.freeze",
    ...["low", "mid", "high"].flatMap((band) => [`pocha.${band}0`, `pocha.${band}1`]),
  ];
}
