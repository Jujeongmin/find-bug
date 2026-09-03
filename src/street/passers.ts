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

/** every dictionary key the three of them can ask for */
export function passerKeys(): string[] {
  return Object.values(PASSERS).flatMap((p) => [
    ...Array.from({ length: p.morning }, (_, i) => `street.${p.who}.m${i}`),
    ...Array.from({ length: p.evening }, (_, i) => `street.${p.who}.e${i}`),
  ]);
}
