import type { Assignment } from "./run";
import type { MachineId } from "./scene";
import type { Severity } from "./rating";
import { isHotfix } from "./events";
import { SCENE_YEAR } from "../stages/registry";

/**
 * Which builds go on which machine, day by day.
 *
 * Moved out of Office.tsx so it can be checked without a browser: the schedule
 * is the one thing a new year must not disturb for anyone still in year one,
 * and "it looks the same" is not a check.
 */

/*
 * One per machine, rotated by the day so no machine is always the bad one.
 *
 * Four entries because there are four machines: with three the fourth build
 * doubled a severity that moved from day to day, and the total riding on a
 * day changed with it — which is not something a rating can be a share of.
 */
const SEVERITIES: Severity[] = ["normal", "low", "critical", "normal"];

/**
 * Code freeze: the last two working days, when everything on the machines is
 * critical.
 *
 * Eleven of the twelve days were the same day. The ship date was a number in
 * the corner that counted down past a calendar nothing happened on, and the
 * last morning of the run played exactly like the first.
 *
 * Nothing new is written this close to a release, so what is left on the
 * machines is the work nobody dared touch until now. A day of it weighs
 * sixteen against an ordinary nine, dropping a build costs four times what
 * it costs in week one, and the coffee stops being optional.
 */
export const FREEZE_FROM = 11;
export const isFreeze = (day: number) => day >= FREEZE_FROM;

/**
 * Every build of year one, in the order the rotation has always walked.
 *
 * Written out rather than derived from the scene list, because appending a
 * scene to that list would change this order and move every day of every
 * year-one run. The card game is not a scene the engine drives — it is its
 * own component — but it is a build like any other from the floor, and it has
 * always come last.
 */
export const YEAR_ONE_BUILDS: readonly string[] = [
  "stage01",
  "stage02",
  "stage03",
  "stage05",
  "stage06",
  "stage07",
  "stage04",
];

export interface LaterBuild {
  id: string;
  year: number;
}

/** the builds that arrive after year one, earliest year first */
export const LATER_BUILDS: readonly LaterBuild[] = Object.entries(SCENE_YEAR)
  .map(([id, year]) => ({ id, year }))
  .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

/** the rotation for a run that started in `year` */
export function buildIdsFor(
  year: number,
  later: readonly LaterBuild[] = LATER_BUILDS
): string[] {
  return [
    ...YEAR_ONE_BUILDS,
    ...later.filter((b) => b.year <= year).map((b) => b.id),
  ];
}

/**
 * Four builds a day, one per machine. Each day holds one of each severity and
 * a second normal, and which machine carries the critical one rotates — so
 * there is always a build worth reaching first, and it is never the same walk
 * twice.
 */
export function assignDay(
  day: number,
  builds: readonly string[],
  machines: readonly MachineId[]
): Assignment[] {
  return machines.map((machine, i) => ({
    machine,
    // a stride that is coprime with the list, so the day's four slide along
    // it instead of alternating between the same two sets — 5 is coprime with
    // 7, 8 and 9, which is every length the years produce
    sceneId: builds[(day * 5 + i) % builds.length],
    severity:
      isFreeze(day) || (isHotfix(day) && i === 0)
        ? "critical"
        : SEVERITIES[(i + day) % SEVERITIES.length],
    result: null,
    bugId: null,
  }));
}
