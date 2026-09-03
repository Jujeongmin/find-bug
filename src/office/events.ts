/**
 * The two days in the fortnight that are not like the others.
 *
 * Twelve days of the same shape is a rota, not a run: the only thing that ever
 * changed was the freeze at the end, and it changes everything at once. These
 * are smaller and land in the middle, one on each side of the ledger the game
 * keeps — a day that takes more out of you than it should, and an evening that
 * gives some of it back at a price.
 *
 * They are days rather than triggers so the calendar is a thing the player can
 * learn: the fifth is always the bad Friday, the ninth is always the dinner.
 */
export type DayEvent = "hotfix" | "dinner";

/**
 * Day five is the Friday of the first week — the last working day before a
 * weekend that is, in this game, the only rest the calendar hands out. Day
 * nine is the middle of the second week, far enough in that spirits have
 * usually been spent and far enough from the ship that an evening off is not
 * obviously wrong.
 */
const EVENTS: Record<number, DayEvent> = {
  5: "hotfix",
  9: "dinner",
};

export const eventFor = (day: number): DayEvent | null => EVENTS[day] ?? null;

export const isHotfix = (day: number) => eventFor(day) === "hotfix";
export const isDinner = (day: number) => eventFor(day) === "dinner";

/** what the two of them cost and give */
export const HOTFIX_CONDITION = 1;
export const DINNER_SPIRIT = 2;

/** every dictionary key the two days can ask for */
export function eventKeys(): string[] {
  return [
    "event.hotfix.morning",
    "event.dinner.went",
    "event.dinner.skipped",
    "offer.dinner.title",
    "offer.dinner.body",
    "offer.dinner.yes",
    "offer.dinner.no",
  ];
}
