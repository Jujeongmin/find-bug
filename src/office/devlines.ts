/**
 * What the developer says, and when.
 *
 * They are the only person in the game you work with rather than walk past, so
 * what they say is picked from the state of the day rather than from a counter:
 * the build you have just signed off matters more than the day, and the day
 * matters more than small talk — otherwise the same line comes back and stops
 * being read.
 *
 * The order is the whole design, which is why it lives here as one function
 * rather than as a ladder inside a click handler: scripts/checki18n.ts asserts
 * both the order and that every line it can ask for has been written.
 */
export interface DevTalk {
  /** which day of the fortnight, and how many there are */
  day: number;
  days: number;
  /** the first hello of the run */
  firstTalk: boolean;
  /** confirmed defects waiting on your desk to be handed over */
  pending: number;
  /** what the build you just came out of turned out to be */
  lastResult: "caught" | "missed" | null;
  /** builds still unverified today */
  left: number;
  /** the week the code is frozen */
  freeze: boolean;
  /** a weekend you came in on anyway */
  weekend: boolean;
  /** the morning something that already shipped came back */
  hotfix: boolean;
  /** how the player is holding up */
  spirit: number;
  /** how many times they have been spoken to */
  talks: number;
  /** the relationship, 0 to 3, earned by handing defects over */
  level: number;
  /** the player's rank, 0 to 4, from the builds they have mastered */
  rank: number;
}

/** how many things they say when there is nothing more pressing */
export const IDLE_LINES = 5;

export function devLine(s: DevTalk): string {
  // the first hello of a run knows who has walked in
  if (s.firstTalk) {
    if (s.rank >= 4) return "office.dev.introRank3";
    if (s.rank >= 2) return "office.dev.introRank2";
    if (s.rank >= 1) return "office.dev.introRank1";
    return "office.dev.intro";
  }
  if (s.pending) return "office.dev.waiting";
  if (s.lastResult === "caught") return "office.dev.caught";
  if (s.lastResult === "missed") return "office.dev.missed";
  /*
   * The last day comes before "you have looked at everything".
   *
   * It used to come after, so on the one day of the fortnight they have
   * something to say about, they told you to go home instead. What tomorrow
   * is depends on how much of their work you have caught: a stranger says the
   * date, somebody who knows you says what they think of it.
   */
  if (s.day >= s.days) {
    return s.level >= 3
      ? "office.dev.lastWarm"
      : s.level >= 1
        ? "office.dev.lastKnown"
        : "office.dev.lastFlat";
  }
  if (s.left === 0) return "office.dev.allDone";
  // today's news before the week's
  if (s.hotfix) return "office.dev.hotfix";
  // both of these are about the week rather than the person, so they sit above
  // the small talk and below anything happening today
  if (s.weekend) return "office.dev.weekend";
  if (s.freeze) return "office.dev.freeze";
  // someone who sees you every day notices before you do
  if (s.spirit <= 1 && s.talks % 3 === 0) return "office.dev.worried";
  // the small talk is where the change is felt, so it belongs to the level
  // rather than to the number of times you have said hello
  if (s.level > 0) return `office.dev.warm${s.level}_${s.talks % 2}`;
  return `office.dev.idle${s.talks % IDLE_LINES}`;
}

/**
 * And one line after it is all over.
 *
 * The results screen was two numbers and a book count — what the company got
 * and what it cost the person — with nobody in it. This is the one person who
 * saw both.
 */
export function devShipLine(rating: number, level: number): string {
  if (level >= 3) return "office.dev.shipWarm";
  if (rating >= 4) return "office.dev.shipGood";
  if (rating >= 2.5) return "office.dev.shipOk";
  return "office.dev.shipBad";
}

/**
 * And what they say to the screen when nobody has asked them anything. They
 * do not wander — they are working — but a room with one other person in it
 * should not be silent for eight hours.
 */
export const DEV_MUTTERS = [
  "mutter.dev0",
  "mutter.dev1",
  "mutter.dev2",
  "mutter.dev3",
];

/** every dictionary key the developer can ask for */
export function devKeys(): string[] {
  return [
    "office.dev.intro",
    "office.dev.introRank1",
    "office.dev.introRank2",
    "office.dev.introRank3",
    "office.dev.waiting",
    "office.dev.caught",
    "office.dev.missed",
    "office.dev.allDone",
    "office.dev.lastFlat",
    "office.dev.lastKnown",
    "office.dev.lastWarm",
    "office.dev.weekend",
    "office.dev.hotfix",
    "office.dev.freeze",
    "office.dev.worried",
    "office.dev.shipGood",
    "office.dev.shipOk",
    "office.dev.shipBad",
    "office.dev.shipWarm",
    ...Array.from({ length: IDLE_LINES }, (_, i) => `office.dev.idle${i}`),
    ...[1, 2, 3].flatMap((lv) => [
      `office.dev.warm${lv}_0`,
      `office.dev.warm${lv}_1`,
    ]),
    ...DEV_MUTTERS,
  ];
}
