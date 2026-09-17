import type { CodexRow } from "./codex";

/**
 * Mastery: a build whose every fault is in the book as caught.
 *
 * Nothing here is stored. The book already is, on the device and on the
 * account, and a wipe that empties it takes mastery with it — a second copy
 * would only be something that could disagree. The rows carry the year's
 * gating, so a build that has not arrived yet is not in any of these.
 */

export interface Progress {
  caught: number;
  total: number;
}

export function buildProgress(rows: readonly CodexRow[]): Map<string, Progress> {
  const out = new Map<string, Progress>();
  for (const r of rows) {
    const p = out.get(r.sceneId) ?? { caught: 0, total: 0 };
    p.total++;
    if (r.state === "caught") p.caught++;
    out.set(r.sceneId, p);
  }
  return out;
}

export function masteredBuilds(rows: readonly CodexRow[]): string[] {
  return [...buildProgress(rows)]
    .filter(([, p]) => p.total > 0 && p.caught === p.total)
    .map(([id]) => id);
}

/**
 * Whether catching this one fault is what masters its build: every other
 * fault in the build is already caught, and this one is not. Asked before the
 * catch is written down, so the moment can be announced once and only once.
 */
export function completes(
  rows: readonly CodexRow[],
  sceneId: string,
  bugId: string
): boolean {
  const mine = rows.filter((r) => r.sceneId === sceneId);
  const target = mine.find((r) => r.bugId === bugId);
  if (!target || target.state === "caught") return false;
  return mine.every((r) => r === target || r.state === "caught");
}

/**
 * The faults of one build that the book does not have as caught. Dealt first,
 * so each run moves the book on instead of dealing the ones it already has;
 * a mastered build has none, and is dealt from everything again.
 */
export function preferFor(rows: readonly CodexRow[], sceneId: string): string[] {
  return rows
    .filter((r) => r.sceneId === sceneId && r.state !== "caught")
    .map((r) => r.bugId);
}
