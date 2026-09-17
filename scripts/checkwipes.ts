/**
 * A wipe on one device reaches the others.
 *
 * The account used to forget that a wipe had happened: it emptied itself and
 * nothing more. A second device still holding the old book, years, best and
 * run folded all of them straight back in on its next connection, and the
 * wipe the player asked for was undone by a phone in a drawer.
 *
 * Run: npx tsx scripts/checkwipes.ts
 */
import { readFileSync } from "node:fs";

/** a localStorage that exists, because node has none */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { syncBook, syncYears, resetSave, settleAccount, onAccountWiped } =
  await import("../src/net/save");
const { seenWipes } = await import("../src/net/wipes");
const { RUN_VERSION, RUN_PUSH_MS, saveRun } = await import("../src/office/run");

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

type Srv = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** server.js, run against a state object instead of the platform's */
function account(initial: Record<string, unknown>) {
  let state = JSON.parse(JSON.stringify(initial)) as Record<string, unknown>;
  const $global = {
    getMyState: async () => JSON.parse(JSON.stringify(state)),
    updateMyState: async (patch: Record<string, unknown>) => {
      state = { ...state, ...patch };
    },
  };
  const src = readFileSync("server.js", "utf8");
  const server = new Function("$global", `${src}\nreturn new Server();`)($global) as Srv;
  const remote = {
    remoteFunction: async (name: string, args: unknown[] = []) => server[name](...args),
  };
  return { server, remote, get: () => state };
}

const BUG = "stage01/noDamage:slimeA";
const RUN_ID = "r0a1b2c3d4e5f";
const run = { v: RUN_VERSION, updatedAt: 5, day: 8 };
const old = {
  book: { [BUG]: "caught" },
  finished: [RUN_ID],
  best: 4,
  runs: 1,
  run,
};

/** device B, as it was before anyone wiped anything */
function deviceB() {
  store.clear();
  store.set("fb_codex_v1", JSON.stringify({ [BUG]: "caught" }));
  store.set("fb_years_v1", JSON.stringify([RUN_ID]));
  store.set("fb_best_v1", "4");
  store.set("fb_run", JSON.stringify(run));
}

let wipedCalls = 0;
onAccountWiped(() => void wipedCalls++);

console.log("\nthe account counts its wipes");
{
  const acc = account(old);
  is((await acc.server.getWipes()) === 0, "an account never wiped has had 0");
  await acc.server.resetSave();
  await acc.server.resetSave();
  is((await acc.server.getWipes()) === 2, "and each wipe adds one");
  is(acc.get().wipes === 2, "kept on the account's state");
}

console.log("\na device that has never looked adopts the count and keeps its data");
{
  deviceB();
  const acc = account({ ...old, wipes: 3 });
  wipedCalls = 0;
  const got = await settleAccount(acc.remote);
  is(got === "ok" && seenWipes() === 3, `it takes 3 as seen (${got}, ${seenWipes()})`);
  is(store.has("fb_codex_v1") && store.has("fb_run"), "and nothing on it is thrown away");
  is(wipedCalls === 0, "and nothing is reloaded");
}

console.log("\na wipe on device A empties device B on its next sync");
{
  deviceB();
  const acc = account(old);
  await settleAccount(acc.remote);
  is(seenWipes() === 0, "B has seen the account at 0 wipes");

  await acc.server.resetSave(); // device A
  wipedCalls = 0;
  await syncBook(acc.remote);
  is(!store.has("fb_codex_v1") || store.get("fb_codex_v1") === "{}", "B's book is gone");
  is(!store.has("fb_years_v1"), "B's years are gone");
  is(!store.has("fb_best_v1"), "B's best is gone");
  is(!store.has("fb_run"), "B's run is gone");
  is(seenWipes() === 1, "B has now seen 1");
  is(wipedCalls === 1, "and the page is reopened, so the run in memory goes too");
  is(JSON.stringify(acc.get().book) === "{}", "the account's book stays empty");

  wipedCalls = 0;
  await syncYears(acc.remote);
  is(wipedCalls === 0, "a second sync does not wipe again");
  is((acc.get().finished as unknown[]).length === 0, "and the account's years stay empty");
}

console.log("\nthe server refuses what a device sends from before a wipe");
{
  const acc = account({ ...old, book: {}, finished: [], best: 0, run: null, wipes: 1 });
  is((await acc.server.syncBook({ [BUG]: "caught" }, 0)) === null, "a stale book is refused");
  is(JSON.stringify(acc.get().book) === "{}", "and not merged");
  is((await acc.server.syncYears([RUN_ID], 0)) === null, "stale years are refused");
  is((acc.get().finished as unknown[]).length === 0, "and not merged");
  const saved = (await acc.server.saveRun({ ...run, updatedAt: 9 }, 0)) as { ok?: boolean };
  is(saved?.ok === false && acc.get().run === null, "a stale run is refused");
  is((await acc.server.reportRun(5, 0)) === null && acc.get().best === 0, "a stale rating is refused");

  const taken = (await acc.server.syncBook({ [BUG]: "caught" }, 1)) as Record<string, string> | null;
  is(taken?.[BUG] === "caught", "a current book is taken");
  is(Array.isArray(await acc.server.syncYears([RUN_ID], 1)), "current years are taken");
  is(((await acc.server.saveRun({ ...run, updatedAt: 9 }, 1)) as { ok?: boolean }).ok === true,
     "a current run is taken");
  is(((await acc.server.reportRun(3, undefined)) as { best?: number })?.best === 3,
     "a client that sends no count is still heard, as before");
}

console.log("\nthe device's own wipe moves its count with the account's");
{
  store.clear();
  const acc = account({ ...old, wipes: 4 });
  await settleAccount(acc.remote);
  await resetSave(acc.remote);
  is(acc.get().wipes === 5 && seenWipes() === 5, `both are at 5 (${String(acc.get().wipes)}, ${seenWipes()})`);
  wipedCalls = 0;
  await syncBook(acc.remote);
  is(wipedCalls === 0, "so its next sync is not taken for somebody else's wipe");
}

console.log("\nan account that cannot be asked wipes nothing");
{
  deviceB();
  store.set("fb_wipes_seen", "0");
  const deaf = {
    remoteFunction: async () => {
      throw new Error("no answer");
    },
  };
  wipedCalls = 0;
  const got = await settleAccount(deaf);
  is(got === "ok" && store.has("fb_codex_v1") && wipedCalls === 0, "the device keeps what it has");
}

console.log("\nonce a wipe from elsewhere is found, the run in memory cannot be written back");
{
  /*
   * The page is reopening, but the office on it is still mounted and its
   * clock still ticks: every tick asks to write the run down, and the count
   * it would be sent under is already the new one, so the server would take
   * it. Last in this script, because the stop lasts until the page goes.
   */
  deviceB();
  const acc = account(old);
  await settleAccount(acc.remote);
  await acc.server.resetSave();
  const calls: string[] = [];
  const spy = {
    remoteFunction: async (name: string, args: unknown[] = []) => {
      calls.push(name);
      return acc.remote.remoteFunction(name, args);
    },
  };
  const got = await settleAccount(spy);
  is(got === "wiped", "the wipe is found");
  saveRun({ day: 9 } as never, spy);
  is(!store.has("fb_run"), "the next tick does not put the run back on the device");
  await new Promise((r) => setTimeout(r, RUN_PUSH_MS + 300));
  is(!calls.includes("saveRun"), `nor on the account (${calls.join(",")})`);
  is(acc.get().run === null, "the account's run stays gone");
}

console.log("\nthe callers use it");
{
  const office = readFileSync("src/office/Office.tsx", "utf8");
  const boot = office.slice(office.indexOf("export function Office("), office.indexOf("function OfficeRun("));
  is(boot.includes("settleAccount(server)") && boot.indexOf("settleAccount(server)") < boot.indexOf("fetchRun(server)"),
     "the boot settles the account before fetching the run");
  const wiped = boot.slice(boot.indexOf('if (account === "wiped")'), boot.indexOf('if (account === "owed")'));
  is(/clearTimeout\(timer\)/.test(wiped) && /settled\.current = true/.test(wiped),
     "a wipe found at boot stops the fallback from mounting the old run");
  const books = boot.indexOf("syncBook(server)");
  const years = boot.indexOf("syncYears(server)");
  const fetch = boot.indexOf("fetchRun(server)");
  is(books > 0 && years > 0 && books < fetch && years < fetch,
     "and the account's book and years are in before a run starts from them");
  is(/haltRunWrites\(\)/.test(readFileSync("src/net/save.ts", "utf8")),"a wipe from elsewhere stops the run being written");
  const runTs = readFileSync("src/office/run.ts", "utf8");
  is(/remoteFunction\("saveRun", \[lastSnap, seenWipes\(\)\]\)/.test(runTs), "the run push says which wipe it has seen");
  const save = readFileSync("src/net/save.ts", "utf8");
  for (const name of ["syncBook", "syncYears", "reportRun"]) {
    is(new RegExp(`remoteFunction\\("${name}", \\[[^\\]]*seenWipes\\(\\)`).test(save), `${name} says it too`);
  }
}

console.log(bad ? `\n${bad} FAIL` : "\nwipes reach every device");
process.exitCode = bad ? 1 : 0;
