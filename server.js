/**
 * Agent8 game server for Find bug.
 *
 * Per the Verse8 docs this class is defined and never exported — the platform
 * picks it up by name. Every method here is callable from the client with
 * `server.remoteFunction("<name>", [args])`.
 *
 * The game runs entirely on the client. What the account is for is the one
 * thing that is meant to outlive a run and a device: the defect book. A player
 * meets perhaps forty of the hundred and twenty-eight faults in twelve days,
 * and the reason to start again is the ones they have not met — which is worth
 * nothing if it lives in the site data of one browser.
 *
 * It used to keep a `cleared` count out of the stage grid, counting up to
 * sixty. The grid was removed; the number had nothing left to count.
 */

/** every id is "<sceneId>/<bugId>", and no book can be larger than the pool */
const MAX_ENTRIES = 400;
const CAUGHT = "caught";
const MISSED = "missed";

class Server {
  
  
  /**
   * Fold a client's book into the account's and hand back the union.
   *
   * A merge rather than a write, in both directions: two devices are two
   * partial books, and the player caught what either of them saw. Catching
   * something never un-catches it, so "caught" always wins over "missed" no
   * matter which side is newer — there is no last-write-wins question to get
   * wrong, because the states are ordered.
   */
  async syncBook(incoming) {
    const state = (await $global.getMyState()) || {};
    const book = sanitise(state.book);
    const add = sanitise(incoming);
    let changed = false;
    for (const id of Object.keys(add)) {
      if (book[id] === CAUGHT) continue;
      if (book[id] === add[id]) continue;
      if (Object.keys(book).length >= MAX_ENTRIES && !(id in book)) continue;
      book[id] = add[id];
      changed = true;
    }
    if (changed) {
      await $global.updateMyState({ book, updatedAt: Date.now() });
    }
    return book;
  }

  /** the end of a run: the rating it shipped with, best kept */
  async reportRun(rating) {
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) return null;
    const state = (await $global.getMyState()) || {};
    const best = Math.max(Number(state.best) || 0, r);
    const runs = (Number(state.runs) || 0) + 1;
    await $global.updateMyState({ best, runs, updatedAt: Date.now() });
    return { best, runs };
  }

  /** lets a player wipe their own save */
  async resetSave() {
    await $global.updateMyState({
      book: {},
      best: 0,
      runs: 0,
      updatedAt: Date.now(),
    });
    return true;
  }
}

/**
 * Whatever came in, reduced to entries this game recognises.
 *
 * The argument arrives from a client and is therefore not to be trusted with
 * the shape it claims: anything that is not a known state under a plausible id
 * is dropped rather than stored, and the whole thing is capped so one caller
 * cannot grow another player's state without bound.
 */
function sanitise(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  let n = 0;
  for (const [id, state] of Object.entries(raw)) {
    if (n >= MAX_ENTRIES) break;
    if (state !== CAUGHT && state !== MISSED) continue;
    if (typeof id !== "string" || id.length > 80 || !id.includes("/")) continue;
    out[id] = state;
    n++;
  }
  return out;
}
