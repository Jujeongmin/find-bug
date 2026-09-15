/**
 * Agent8 game server for Find bug.
 *
 * Per the Verse8 docs this class is defined and never exported — the platform
 * picks it up by name. Every method here is callable from the client with
 * `server.remoteFunction("<name>", [args])`.
 *
 * The game runs entirely on the client. What the account is for is the one
 * thing that is meant to outlive a run and a device: the defect book. A player
 * meets perhaps forty of the hundred and fifteen faults in twelve days,
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
 * and the like, and the longest of the hundred and fifteen is forty-five
 * characters. This is a shape, not an identity — a caller determined to fill
 * their own book can still make four hundred well-formed ids that name no
 * real defect. Only the generated pool itself could settle that, and it lives
 * on the client. What this does is make the junk have to try, and stop the
 * obvious version of it, on a record whose blast radius is the caller's own
 * save either way.
 */
const ENTRY_ID = /^stage\d{2}\/[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)*$/;
const MAX_ID_LEN = 64;

/*
 * A finished run's id: "r" and twelve characters, or "legacy-N" for a run the
 * account counted before ids existed. The same pattern as src/office/years.ts.
 */
const RUN_ID = /^(r[0-9a-z]{12}|legacy-\d{1,2})$/;
const MAX_YEARS = 99;

/**
 * What a stored run is allowed to look like.
 *
 * This repeats the field list in src/office/run.ts, and it has to: the platform
 * loads this file on its own and it can import nothing out of the client
 * bundle. The two lists drifting apart is the failure mode — a field added on
 * the client and not here is dropped silently on every save, and the player
 * loses it the first time they open the game somewhere else. scripts/checkrun.ts
 * loads this file and compares them.
 *
 * "n" is a whole number in a range, "b" a boolean, "s" one of a set; the four
 * shaped fields have checkers of their own. Anything that does not check out is
 * left out rather than corrected — a corrected field is a lie about what the
 * player did, and the client's own default is the honest replacement.
 */
const RUN_VERSION = 1;
const MAX_RUN_BYTES = 8192;
const RUN_LIST = 64;

const RUN_FIELDS = {
  day: ["n", 1, 12],
  assignments: ["assignments"],
  pending: ["assignments"],
  delivered: ["n", 0, 999],
  late: ["severities"],
  shipped_: ["severities"],
  caught: ["n", 0, 999],
  missed: ["n", 0, 999],
  minutes: ["n", 0, 1440],
  condition: ["n", 0, 9],
  spirit: ["n", 0, 9],
  borrowed: ["n", 0, 9],
  pay: ["n", 0, 999999],
  owned: ["items"],
  place: ["s", ["office", "home", "lane", "street"]],
  from: ["s", ["wake", "home", "lane", "street", "office"]],
  officeAt: ["spot"],
  dayOver: ["b"],
  hadCoffee: ["b"],
  greeted: ["greeted"],
  talks: ["n", 0, 999],
  lastResult: ["s", [null, "caught", "missed"]],
  overtime: ["n", 0, 1440],
  tookOvertime: ["b"],
  tookFreeCoffee: ["b"],
  workedWeekend: ["b"],
  hobbyDone: ["b"],
  ateOut: ["b"],
  devCoffee: ["b"],
  devCame: ["b"],
  retestUsed: ["b"],
  restedTonight: ["b"],
  earlyTomorrow: ["b"],
  pochaNights: ["n", 0, 99],
  dinnerAsked: ["b"],
  codexAtStart: ["n", 0, 999],
  runId: ["runid"],
  yearAtStart: ["n", 1, 99],
  gift: ["s", [null, "magnifier", "chair", "alarm", "shoes", "thermos"]],
};

const SEVERITIES = ["low", "normal", "critical"];
const ITEMS = ["magnifier", "chair", "alarm", "shoes", "thermos", "retest"];
const MACHINE_IDS = ["machineA", "machineB", "machineC", "machineD"];
const RESULTS = [null, "caught", "missed"];

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

  /**
   * Fold a device's finished runs into the account's and hand back the union.
   *
   * A set, not a count: two devices that each finished a run offline have
   * finished two, and a run reported twice is one.
   *
   * The account counted runs as a number before this existed. The first time
   * a `finished` set is written, that number becomes that many legacy ids —
   * less whatever ids arrived in the same call, because the ship screen reports
   * the rating before it syncs, so a run that just shipped is already in `runs`
   * and is also arriving here. After that the number is never read again, so a
   * report that lands between two syncs cannot be counted twice.
   */
  async syncYears(incoming) {
    const state = (await $global.getMyState()) || {};
    const add = sanitiseYears(incoming);
    const had = Array.isArray(state.finished);
    let finished;
    if (had) {
      finished = sanitiseYears(state.finished);
    } else {
      const runs =
        Number.isInteger(state.runs) && state.runs > 0
          ? Math.min(state.runs, MAX_YEARS)
          : 0;
      const legacy = Math.max(0, runs - add.length);
      finished = Array.from({ length: legacy }, (_, i) => `legacy-${i + 1}`);
    }
    const before = finished.length;
    for (const id of add) {
      if (finished.length >= MAX_YEARS) break;
      if (!finished.includes(id)) finished.push(id);
    }
    if (!had || finished.length !== before) {
      await $global.updateMyState({ finished, updatedAt: Date.now() });
    }
    return finished;
  }

  /**
   * Lets a player wipe their own save.
   *
   * The run goes with the book. Wiping is the player throwing away what they
   * recorded, and a twelve-day run they no longer want is part of that — but
   * `adsRemoved` is untouched, here as everywhere: what they paid for is not
   * theirs to lose by pressing this.
   */
  async resetSave() {
    await $global.updateMyState({
      book: {},
      best: 0,
      runs: 0,
      run: null,
      finished: [],
      updatedAt: Date.now(),
    });
    return true;
  }

  /**
   * The run in progress, kept for the next device.
   *
   * Not folded into syncBook, for the same reason getEntitlements is not: the
   * book is a merge that is allowed to fail quietly, and this is a
   * last-one-wins record. Sharing a call would mean a failed book sync could
   * cost a day of work, and a rejected run could cost the book.
   */
  async saveRun(snapshot) {
    const run = sanitiseRun(snapshot);
    if (!run) return { ok: false };
    await $global.updateMyState({ run, updatedAt: Date.now() });
    return { ok: true };
  }

  async getRun() {
    const state = (await $global.getMyState()) || {};
    return state.run && state.run.v === RUN_VERSION ? state.run : null;
  }

  async clearRun() {
    await $global.updateMyState({ run: null, updatedAt: Date.now() });
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

function isInt(v, lo, hi) {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

function runAssignment(v) {
  if (!v || typeof v !== "object") return undefined;
  if (!MACHINE_IDS.includes(v.machine)) return undefined;
  if (!SEVERITIES.includes(v.severity)) return undefined;
  if (typeof v.sceneId !== "string" || v.sceneId.length > 32) return undefined;
  if (!RESULTS.includes(v.result)) return undefined;
  if (v.bugId !== null && (typeof v.bugId !== "string" || v.bugId.length > 64))
    return undefined;
  const out = {
    machine: v.machine,
    sceneId: v.sceneId,
    severity: v.severity,
    result: v.result,
    bugId: v.bugId,
  };
  if (v.hotfix === true) out.hotfix = true;
  return out;
}

function runList(v, each) {
  if (!Array.isArray(v) || v.length > RUN_LIST) return undefined;
  const out = [];
  for (const x of v) {
    const one = each(x);
    if (one === undefined) return undefined;
    out.push(one);
  }
  return out;
}

function runField(rule, v) {
  switch (rule[0]) {
    case "n":
      return isInt(v, rule[1], rule[2]) ? v : undefined;
    case "b":
      return typeof v === "boolean" ? v : undefined;
    case "s":
      return rule[1].includes(v) ? v : undefined;
    case "assignments":
      return runList(v, runAssignment);
    case "severities":
      return runList(v, (x) => (SEVERITIES.includes(x) ? x : undefined));
    case "runid":
      return typeof v === "string" && RUN_ID.test(v) ? v : undefined;
    case "items":
      return runList(v, (x) => (ITEMS.includes(x) ? x : undefined));
    case "spot":
      if (v === null) return null;
      if (!v || typeof v !== "object") return undefined;
      if (typeof v.x !== "number" || !Number.isFinite(v.x)) return undefined;
      if (typeof v.y !== "number" || !Number.isFinite(v.y)) return undefined;
      return { x: v.x, y: v.y };
    case "greeted": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
      const out = {};
      let n = 0;
      for (const [id, times] of Object.entries(v)) {
        if (n++ >= RUN_LIST) return undefined;
        if (id.length > 40) return undefined;
        if (!isInt(times, 0, 999)) return undefined;
        out[id] = times;
      }
      return out;
    }
    default:
      return undefined;
  }
}

/**
 * A run as sent by a client, reduced to one this server will store.
 *
 * The same posture as sanitise: the argument claims a shape and is not believed
 * about it. The size cap comes before the field walk because the cheapest way
 * to grow somebody's state without bound is a field this does not know about,
 * and the whole object is measured whether or not any of it is recognised.
 */
function sanitiseRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.v !== RUN_VERSION) return null;
  if (JSON.stringify(raw).length > MAX_RUN_BYTES) return null;
  /*
   * The client's own timestamp is kept, not replaced with this machine's.
   *
   * It is the client that compares the two copies on the next boot — the one
   * on the device against the one here — and stamping this with server time
   * would make that a comparison between a phone's clock and a data centre's.
   * A laptop running a few minutes fast would then beat a phone that had
   * played four days more, and the player would lose those four days to a
   * clock. Both sides written by the player's own devices is the only version
   * of that comparison that means anything.
   *
   * A day's grace on the future is there so a badly-set clock cannot park a
   * run permanently ahead of every later one. The blast radius either way is
   * the caller's own save.
   */
  const ceiling = Date.now() + 86400000;
  const out = {
    v: RUN_VERSION,
    updatedAt: isInt(raw.updatedAt, 0, ceiling) ? raw.updatedAt : Date.now(),
  };
  for (const [key, rule] of Object.entries(RUN_FIELDS)) {
    const value = runField(rule, raw[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** a list of run ids as sent by a client: well formed, distinct, capped */
function sanitiseYears(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const id of raw) {
    if (out.length >= MAX_YEARS) break;
    if (typeof id !== "string" || !RUN_ID.test(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
