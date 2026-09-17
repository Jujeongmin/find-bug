/**
 * How many wipes of the account this device has seen.
 *
 * The account counts its wipes. A device that finds the count higher than the
 * one it remembers is holding data somebody threw away on another device, and
 * it must drop that data rather than fold it back in. Every write this device
 * sends carries the count it has seen, so the server can refuse one that was
 * made before a wipe it has not heard about.
 *
 * Kept in its own module because both the book sync and the run push need it,
 * and the book sync already reaches into the run.
 *
 * Undefined means this device has never asked: it adopts whatever the account
 * says without wiping, because it cannot tell what it holds apart from what
 * came before.
 */
const KEY = "fb_wipes_seen";

export function seenWipes(): number | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function setSeenWipes(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* a browser that will not store this will not store the book either */
  }
}
