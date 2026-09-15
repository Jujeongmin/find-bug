/**
 * The runs this player has finished, on this device.
 *
 * A finished run is a year, and the year decides what the next run holds. It
 * is counted as a set of run ids rather than a number, for the same reason the
 * book is a set: two devices that each finish a run offline have finished two,
 * and a number merged by taking the larger would say one; a report sent twice
 * is still one run, and a number incremented on the server would say two.
 *
 * Local storage is what the game reads. The account keeps a second copy that
 * is folded in both ways — see syncYears in src/net/save.ts.
 */

const KEY = "fb_years_v1";

/** no more than this many runs are kept, which puts the year at 99 */
export const MAX_YEARS = 99;

/**
 * What a run id looks like: "r" and twelve characters for a run this build
 * started, or "legacy-N" for a run the account counted before ids existed.
 * The server holds the same pattern.
 */
export const RUN_ID = /^(r[0-9a-z]{12}|legacy-\d{1,2})$/;

export const isRunId = (v: unknown): v is string =>
  typeof v === "string" && RUN_ID.test(v);

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newRunId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = "r";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function loadYears(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const id of parsed) {
      if (out.length >= MAX_YEARS) break;
      if (isRunId(id) && !out.includes(id)) out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}

function store(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* a browser that will not store plays every run as the same year */
  }
}

/** fold ids in; anything that is not a run id, or past the cap, is ignored */
export function mergeYears(incoming: readonly unknown[]): string[] {
  const ids = loadYears();
  let changed = false;
  for (const id of incoming) {
    if (ids.length >= MAX_YEARS) break;
    if (!isRunId(id) || ids.includes(id)) continue;
    ids.push(id);
    changed = true;
  }
  if (changed) store(ids);
  return ids;
}

/** a run has shipped */
export function addYear(id: string): string[] {
  return mergeYears([id]);
}

export function clearYears(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing was stored, so nothing needs removing */
  }
}

/** the year a run started now would be */
export const yearOf = (ids: readonly string[]): number =>
  Math.min(ids.length, MAX_YEARS - 1) + 1;
