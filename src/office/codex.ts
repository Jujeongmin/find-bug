import { ENGINE_SCENES, SCENE_YEAR } from "../stages/registry";
import { stage04 } from "../stages/stage04/bugs";
import { generateMutations } from "../engine/generate";
import type { BugCategory } from "../core/types";

/**
 * What the player has seen, across runs.
 *
 * Nothing survived a run before this: twelve days, one star rating, and the
 * save was the rating you remembered. A run shows something like forty of the
 * hundred and twenty-eight faults the game can plant, so the reason to start
 * again was "a better score" — which is a reason to replay the same run, not
 * to want the next one.
 *
 * This is the other reason. It is the only thing in the game that persists, so
 * it is kept deliberately small and deliberately dumb: a flat map of ids to
 * what happened, written where the browser keeps it and read back defensively,
 * because a private window or a cleared site returns nothing and that has to
 * be an empty book rather than a crash.
 */

const KEY = "fb_codex_v1";

export type Seen = "caught" | "missed";
export type Book = Record<string, Seen>;

const id = (sceneId: string, bugId: string) => `${sceneId}/${bugId}`;

export function loadCodex(): Book {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Book = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "caught" || v === "missed") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Record an outcome. Catching something never un-catches it: the book is what
 * the player has managed, not what they managed most recently.
 */
export function recordBug(sceneId: string, bugId: string, result: Seen): void {
  try {
    const book = loadCodex();
    const k = id(sceneId, bugId);
    if (book[k] === "caught") return;
    book[k] = result;
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* a browser that will not store is a browser that plays without a book */
  }
}

/**
 * Fold another copy of the book into this one.
 *
 * Used when the account's copy comes down: the player caught what either
 * device saw, and catching something never un-catches it, so the union is the
 * answer and the order of the two arguments does not matter.
 */
export function mergeCodex(incoming: Book): Book {
  const book = loadCodex();
  let changed = false;
  for (const [id, state] of Object.entries(incoming)) {
    if (book[id] === "caught" || book[id] === state) continue;
    book[id] = state;
    changed = true;
  }
  if (changed) {
    try {
      localStorage.setItem(KEY, JSON.stringify(book));
    } catch {
      /* a browser that will not store is a browser that plays without a book */
    }
  }
  return book;
}

/**
 * Forget everything.
 *
 * The book is the only thing the game keeps, so a player has to be able to
 * put it back to empty — otherwise the one durable record they own is one
 * they cannot get out of. Clearing is deliberately not undoable and says so
 * before it happens.
 */
export function clearCodex(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing was stored, so nothing needs removing */
  }
}

export interface CodexRow {
  sceneId: string;
  bugId: string;
  /** the mutator, or null for the hand-written build that has no mutators */
  mutator: string | null;
  category: BugCategory;
  subtlety: number;
  descKey: string;
  descParams: Record<string, string>;
  state: Seen | "unseen";
}

/**
 * Every fault the game can plant this year, with what the player has done
 * about it. A build that arrives in a later year is left out of the rows and
 * the total alike: the book's "of N" is what the player can meet. The card
 * game is a year-one build, so its loop below is not gated.
 */
export function codexRows(
  book: Book = loadCodex(),
  year: number = Number.MAX_SAFE_INTEGER,
  sceneYear: Readonly<Record<string, number>> = SCENE_YEAR
): CodexRow[] {
  const rows: CodexRow[] = [];
  for (const scene of ENGINE_SCENES) {
    if ((sceneYear[scene.id] ?? 1) > year) continue;
    for (const m of generateMutations(scene)) {
      rows.push({
        sceneId: scene.id,
        bugId: m.bug.id,
        mutator: m.mutator.id,
        category: m.bug.category,
        subtlety: m.bug.subtlety,
        descKey: m.bug.descKey,
        descParams: m.bug.descParams,
        state: book[id(scene.id, m.bug.id)] ?? "unseen",
      });
    }
  }
  for (const b of stage04.bugPool) {
    rows.push({
      sceneId: stage04.id,
      bugId: b.id,
      mutator: null,
      category: b.category,
      subtlety: 0,
      descKey: b.descKey,
      descParams: {},
      state: book[id(stage04.id, b.id)] ?? "unseen",
    });
  }
  return rows;
}

export function codexTally(rows: CodexRow[]) {
  return {
    total: rows.length,
    caught: rows.filter((r) => r.state === "caught").length,
    missed: rows.filter((r) => r.state === "missed").length,
  };
}
