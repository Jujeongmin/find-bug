import type { GameServer } from "@agent8/gameserver";
import { loadCodex, mergeCodex, type Seen } from "../office/codex";

/**
 * The account copy of the defect book.
 *
 * Local storage is the source of truth for drawing: the game must open and
 * play with no server at all, on a dev machine, offline, or in a browser that
 * refuses to store anything. The account is a second copy that survives a
 * device change, which is the whole point of a book that fills up across runs.
 *
 * Everything here is a merge rather than a write, in both directions. Two
 * devices are two partial books and the player caught what either of them saw;
 * catching something never un-catches it, so the states are ordered and there
 * is no last-write-wins question to get wrong.
 *
 * Every call is allowed to fail silently. A book that did not sync is a book
 * that syncs next time, and there is nothing the player could usefully do
 * about it in the middle of a working day.
 */

type Book = Record<string, Seen>;
type Remote = Pick<GameServer, "remoteFunction">;

let pending: number | null = null;

/** pull the account's copy down and fold both ways */
export async function syncBook(server: Remote): Promise<void> {
  try {
    const merged = (await server.remoteFunction("syncBook", [
      loadCodex(),
    ])) as Book | null;
    if (merged) mergeCodex(merged);
  } catch {
    /* no server, or it said no. The local book is still the book. */
  }
}

/**
 * Push after a catch, but not once per catch.
 *
 * A build ends in a burst — the defect goes in the book, the developer takes
 * it, the day moves on — and three calls a second up the wire for a record
 * that is only read between runs is rude for no benefit.
 */
export function queueSync(server: Remote | null | undefined): void {
  if (!server) return;
  if (pending !== null) clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    void syncBook(server);
  }, 4000);
}

/** the end of a run, for the account's best and its count */
export async function reportRun(
  server: Remote | null | undefined,
  rating: number
): Promise<void> {
  if (!server) return;
  try {
    await server.remoteFunction("reportRun", [rating]);
  } catch {
    /* the rating is on screen either way */
  }
}
