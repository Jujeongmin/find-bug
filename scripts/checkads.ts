/**
 * Does the game wait long enough for an advert to finish?
 *
 * `timeoutMs` does not bound the loading of an advert. The SDK arms its timer
 * the moment the request goes out and only cancels it when the final result
 * comes back, so it bounds the whole thing — the load, the video, and the
 * player sitting through it. Ask for less than an advert takes and the player
 * watches it to the end and is told it failed.
 *
 * The host has a budget of its own for the same span, and it is the one that
 * should decide: it knows what it is playing. Ours exists only for a parent
 * that never answers at all, so it has to be the longer of the two.
 *
 * Both numbers are read out of the files rather than imported, because
 * src/net/ads.ts reaches for import.meta.env and the SDK ships minified.
 */
import { readFileSync } from "node:fs";

let bad = 0;
const ok = (msg: string) => console.log(`PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`FAIL  ${msg}`);
  bad++;
};
const is = (cond: boolean, msg: string) => (cond ? ok(msg) : fail(msg));

/** the host's own budget for one ad break, out of the SDK we ship against */
function hostBudgetMs(): number {
  const sdk = readFileSync("node_modules/@verse8/ads/dist/index.mjs", "utf8");
  const m = sdk.match(/adBreakTimeoutMs>0\?[A-Za-z.]+:([0-9]+e?[0-9]*)/);
  if (!m) {
    console.log(
      "FAIL  cannot find the SDK's adBreakTimeoutMs default — the pattern has drifted"
    );
    process.exit(1);
  }
  return Number(m[1]);
}

/**
 * A number declared in ads.ts, by name.
 *
 * Either side of the sum may be another of these constants, because that is
 * how the last resort is written — as "the SDK's wait, and then some".
 */
function ours(name: string, seen: string[] = []): number {
  if (seen.includes(name)) {
    console.log(`FAIL  ${name} in ads.ts is defined in terms of itself`);
    process.exit(1);
  }
  const src = readFileSync("src/net/ads.ts", "utf8");
  const m = src.match(
    new RegExp(`const ${name}\\s*=\\s*([0-9_A-Za-z]+)\\s*(?:\\+\\s*([0-9_A-Za-z]+))?`)
  );
  if (!m) {
    console.log(`FAIL  ads.ts has no ${name} — this check has drifted`);
    process.exit(1);
  }
  const term = (t: string | undefined): number => {
    if (!t) return 0;
    if (/^[0-9_]+$/.test(t)) return Number(t.replace(/_/g, ""));
    return ours(t, [...seen, name]);
  };
  return term(m[1]) + term(m[2]);
}

const host = hostBudgetMs();
const asked = ours("AD_WAIT_MS");
const giveUp = ours("GIVE_UP_MS");

console.log("\nan advert is given time to finish");
is(
  asked > host,
  `we wait longer than the host does (${asked}ms asked, host gives up at ${host}ms)`
);
is(
  giveUp > asked,
  `and our own last resort is later still (${giveUp}ms)`
);

/*
 * The half of this that has no number in it: a rejected promise must not be
 * left to the timer. bound() used to attach only a `then`, so an SDK that
 * threw left the player watching a disabled prompt until the clock ran out —
 * and now that the clock is the best part of a minute, that matters more.
 */
console.log("\nand a broken advert does not hold the player there");
{
  const src = readFileSync("src/net/ads.ts", "utf8");
  const b = src.slice(src.indexOf("function bound("));
  const body = b.slice(0, b.indexOf("\n}"));
  is(
    /\.catch\(|,\s*\(\)\s*=>|\.then\([^)]*,/.test(body),
    "bound() handles a rejection as well as a resolution"
  );
}

if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
