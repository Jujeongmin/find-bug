/**
 * Everything the game draws, fetched before it starts.
 *
 * The rooms are built out of sprite sheets, and a sheet that has not arrived
 * yet draws nothing: the first walk to work used to happen through a street
 * whose buildings appeared one at a time, and the office door was a gap in the
 * wall until the sheet holding it landed. Loading them up front costs a few
 * hundred kilobytes at the start and makes the game the same on every visit.
 *
 * The list is the art itself rather than a written-down copy of it: it comes
 * out of the same tables the renderer reads, so a sheet added to the game is
 * a sheet the loading screen waits for.
 */
import { ART } from "../engine/spriteStyle";

/**
 * A floor under how fast this can be over.
 *
 * On a warm cache everything resolves in a frame or two, and a loading screen
 * that appears and vanishes inside one is a flash of dark rather than a
 * screen. Long enough to read the line on it, short enough not to be a wait.
 */
const MIN_MS = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** one image, resolved whether it loads or fails */
function fetchImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    // a sheet that 404s must not hold the game shut: the room it belongs to
    // will be missing its art either way, and a black screen is worse
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * Loads every sheet and prop, reporting 0..1 as they arrive.
 *
 * Progress counts images, not bytes: the browser gives no honest byte count
 * for an <img>, and a bar that moves in even steps is a truer picture of
 * "seven of nine" than one that jumps with file size.
 */
export async function preloadArt(
  onProgress: (fraction: number) => void
): Promise<void> {
  const started = Date.now();
  let done = 0;
  onProgress(0);
  await Promise.all(
    ART.map((src) =>
      fetchImage(src).then(() => {
        done++;
        onProgress(done / ART.length);
      })
    )
  );
  const left = MIN_MS - (Date.now() - started);
  if (left > 0) await sleep(left);
}
