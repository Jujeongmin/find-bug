import type { GameServer } from "@agent8/gameserver";
import { loadCodex, mergeCodex, type Seen } from "../office/codex";
import { loadYears, mergeYears } from "../office/years";

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

/*
 * A wipe that has not reached the account yet.
 *
 * Erasing is the one thing here that a merge cannot carry. Every other call
 * may fail quietly because the next one says the same thing again — the local
 * book is whole, so sending it late loses nothing. A wipe is the opposite: the
 * local book is gone, the account still has it, and the very next sync folds
 * the account's copy back in and undoes what the player asked for. Offline,
 * that is not an edge case; it is what happens.
 *
 * So the intent outlives the attempt. It is written down before the call, it
 * survives a reload, and nothing is pulled down until it has been carried out.
 */
const RESET_KEY = "fb_reset_owed";

function resetOwed(): boolean {
  try {
    return localStorage.getItem(RESET_KEY) === "1";
  } catch {
    return false;
  }
}

function setResetOwed(owed: boolean): void {
  try {
    if (owed) localStorage.setItem(RESET_KEY, "1");
    else localStorage.removeItem(RESET_KEY);
  } catch {
    /* a browser that will not store it will not remember the book either */
  }
}

/**
 * Which book the answers in flight belong to.
 *
 * A sync sent before a wipe is still on its way back after it, carrying the
 * very entries that were just erased. Bumping this on a wipe makes those
 * answers stale, and a stale answer is dropped rather than merged.
 */
let epoch = 0;

/** pull the account's copy down and fold both ways */
export async function syncBook(server: Remote): Promise<void> {
  // a wipe still owed is carried out first, and nothing is pulled until it is
  if (resetOwed()) {
    await resetSave(server);
    if (resetOwed()) return;
  }
  const sent = epoch;
  try {
    const merged = (await server.remoteFunction("syncBook", [
      loadCodex(),
    ])) as Book | null;
    if (merged && sent === epoch) mergeCodex(merged);
  } catch {
    /* no server, or it said no. The local book is still the book. */
  }
}

/**
 * Fold this device's finished runs into the account's, both ways.
 *
 * The same posture as the book: a union, allowed to fail quietly, and a wipe
 * still owed is carried out before anything is pulled down — otherwise the
 * account's set would come straight back over an emptied device.
 */
export async function syncYears(server: Remote): Promise<void> {
  if (resetOwed()) {
    await resetSave(server);
    if (resetOwed()) return;
  }
  const sent = epoch;
  try {
    const merged = (await server.remoteFunction("syncYears", [
      loadYears(),
    ])) as unknown;
    if (Array.isArray(merged) && sent === epoch) mergeYears(merged);
  } catch {
    /* no server, or it said no. The local set is still the set. */
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

/**
 * Wipe the account's copy as well, so the two do not disagree.
 *
 * Safe to call with no server: the intent is recorded either way, and the
 * next sync that finds a connection carries it out before it pulls anything
 * down. That is what the old comment here promised and did not do — offline,
 * it returned at the first line and the account kept a book that came back on
 * the next connection.
 */
export async function resetSave(
  server: Remote | null | undefined
): Promise<void> {
  setResetOwed(true);
  epoch++;
  // a push scheduled before the wipe would send the emptied book and merge the
  // account's answer straight back over it
  if (pending !== null) {
    clearTimeout(pending);
    pending = null;
  }
  if (!server) return;
  try {
    await server.remoteFunction("resetSave", []);
    setResetOwed(false);
  } catch {
    /* the local book is already gone; this one goes on the next connection,
       which is now something that actually happens */
  }
}
