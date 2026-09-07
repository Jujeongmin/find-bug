/**
 * Agent8 game server for Find bug.
 *
 * Per the Verse8 docs this class is defined and never exported — the platform
 * picks it up by name. Every method here is callable from the client with
 * `server.remoteFunction("<name>", [args])`.
 *
 * The game runs entirely on the client. What the account is for is the one
 * thing that is meant to outlive a run and a device: the defect book. A player
 * meets perhaps forty of the hundred and twenty-one faults in twelve days,
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

/**
 * The one thing on sale, and the id it has to be registered under.
 *
 * It sells the wait, not the reward. Watching the advert and owning this give
 * exactly the same half hour and the same cup of coffee — the daily limits
 * are untouched — so nothing here can be bought that the game does not already
 * hand out for free to anyone willing to sit through thirty seconds.
 */
const REMOVE_ADS = "remove-ads";

/*
 * What an entry id is allowed to look like.
 *
 * It used to be "a string, under eighty characters, with a slash in it",
 * which four hundred entries of "a/b" satisfy — and once four hundred are
 * stored, the cap turns from a guard into a wall: real ids are refused
 * afterwards because the book is full of nothing.
 *
 * The real ones are a stage and a generated bug id, "stage01/floating:tree1"
 * and the like, and the longest of the hundred and twenty-one is forty-five
 * characters. This is a shape, not an identity — a caller determined to fill
 * their own book can still make four hundred well-formed ids that name no
 * real defect. Only the generated pool itself could settle that, and it lives
 * on the client. What this does is make the junk have to try, and stop the
 * obvious version of it, on a record whose blast radius is the caller's own
 * save either way.
 */
const ENTRY_ID = /^stage\d{2}\/[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)*$/;
const MAX_ID_LEN = 64;

// oxlint-disable-next-line no-unused-vars -- the platform picks it up by name
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

  /**
   * What this account has bought.
   *
   * Deliberately not part of syncBook. The book is a merge in both directions
   * and is allowed to fail quietly; this is a fact the account owns outright
   * and the client only ever reads. Keeping them apart means a failed sync
   * cannot lose a purchase and a purchase cannot be spoofed into the book.
   *
   * Note that a wipe does not clear it. resetSave is the player throwing away
   * what they recorded, not what they paid for.
   */
  async getEntitlements() {
    const state = (await $global.getMyState()) || {};
    return { adsRemoved: state.adsRemoved === true };
  }

  /**
   * VXShop calls this when a purchase completes. The client is not involved
   * and cannot be: it is told what it owns afterwards, by getEntitlements.
   *
   * An unknown productId is refused rather than ignored. Something was paid
   * for and nothing was granted, and that is a dispute — which the platform
   * counts, and enough of them cost the shop.
   */
  async $onItemPurchased({ account, purchaseId, productId }) {
    if (productId !== REMOVE_ADS) {
      return { success: false, error: `unknown product: ${productId}` };
    }
    await $global.updateUserState(account, {
      adsRemoved: true,
      adsRemovedAt: Date.now(),
      adsRemovedBy: purchaseId,
    });
    return { success: true };
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
    if (typeof id !== "string" || id.length > MAX_ID_LEN) continue;
    if (!ENTRY_ID.test(id)) continue;
    out[id] = state;
    n++;
  }
  return out;
}
