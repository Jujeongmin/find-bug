/**
 * The people on the walk, and how many things each of them has to say.
 *
 * Three strangers used to share one pool of six lines off a single counter, so
 * saying hello to one and then to another read as one person following you up
 * the street. They have their own lines now, and their own count of how many
 * times you have spoken to them.
 *
 * Morning and evening are separate pools for the same reason: the walk home is
 * not the walk in, and "I'll be up at three again tonight" is a strange thing
 * to hear at seven in the evening from somebody going the other way.
 *
 * Two lines each stand outside that rotation and are said first, on the days
 * they are about: the week the code is frozen, and the morning after a night
 * that was borrowed against. A stranger who says the same thing on the worst
 * morning of the fortnight as on the first one is scenery.
 *
 * The counts are the contract with the dictionaries — street.a.m0, .m1 and so
 * on — and scripts/checki18n.ts fails if a line this promises is not there.
 */
export interface Passer {
  /** the letter their lines are filed under */
  who: string;
  morning: number;
  evening: number;
}

export const PASSERS: Record<string, Passer> = {
  // the one already standing there when you arrive, asleep on their feet
  passer0: { who: "a", morning: 3, evening: 2 },
  // the one on their fourth coffee, who is not going home either
  passer1: { who: "b", morning: 3, evening: 2 },
  // the neighbour, on the step of the block you live on
  passer2: { who: "c", morning: 3, evening: 2 },
};

/** what the walk looks like when somebody is being said hello to */
export interface Walk {
  /** the day is over: this is the way home, not the way in */
  dayOver: boolean;
  /** the code is frozen, and has been all week */
  freeze: boolean;
  /** the morning after a night that was borrowed against */
  worn: boolean;
}

/**
 * Which line this person says, given how many times they have been spoken to
 * today.
 *
 * A pure function so the rules can be read in one place and checked without a
 * browser: the day's own line comes first and only once, and after that they
 * are back in their rotation.
 */
export function passerLine(person: Passer, said: number, walk: Walk): string {
  const first = said === 0;
  if (first && walk.freeze) return `street.${person.who}.freeze`;
  // a night at the office shows on the walk in; by the walk home it is just
  // today, and they have their own evening to talk about
  if (first && walk.worn && !walk.dayOver) return `street.${person.who}.tired`;
  const pool = walk.dayOver ? person.evening : person.morning;
  return `street.${person.who}.${walk.dayOver ? "e" : "m"}${said % pool}`;
}

/** the days that get a line of their own, said before anything in rotation */
export const PASSER_SPECIALS = ["freeze", "tired"] as const;

/** every dictionary key the three of them can ask for */
export function passerKeys(): string[] {
  return Object.values(PASSERS).flatMap((p) => [
    ...Array.from({ length: p.morning }, (_, i) => `street.${p.who}.m${i}`),
    ...Array.from({ length: p.evening }, (_, i) => `street.${p.who}.e${i}`),
    ...PASSER_SPECIALS.map((s) => `street.${p.who}.${s}`),
  ]);
}
