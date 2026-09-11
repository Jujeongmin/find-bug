/**
 * Nothing in this game gets to decide an advert is over except the host.
 *
 * `timeoutMs` does not bound the loading of an advert. The SDK arms its timer
 * the moment the request goes out and only cancels it when the final result
 * comes back, so it covers the load, the video, and the player sitting through
 * the video. Ask for less than the advert takes and the player watches it to
 * the end and is told it failed — and the reward that arrives a moment later
 * is dropped, because the request is already out of the SDK's map.
 *
 * The SDK's own documentation is unambiguous about this, and it is quoted here
 * so the rule survives whoever reads this file next:
 *
 *   "Per-request timeout in ms. No default — omit it and the request waits for
 *    the host. Supply one only to bound total time."
 *   "timeout | The host did not respond within an explicitly supplied
 *    timeoutMs. Never raised when timeoutMs is omitted."
 *
 * So there is no right number, and this checks that none is passed. What is
 * left is one last resort for a host that never answers at all, which has to
 * be far longer than any advert could be.
 *
 * Everything is read out of the files rather than imported: src/net/ads.ts
 * reaches for import.meta.env, and the SDK ships minified.
 */
import { readFileSync } from "node:fs";

let bad = 0;
const ok = (msg: string) => console.log(`PASS  ${msg}`);
const fail = (msg: string) => {
  console.log(`FAIL  ${msg}`);
  bad++;
};
const is = (cond: boolean, msg: string) => (cond ? ok(msg) : fail(msg));

const ads = readFileSync("src/net/ads.ts", "utf8");

console.log("\nthe host decides when the advert is over");
{
  const at = ads.indexOf("mod.showRewarded(");
  if (at < 0) {
    console.log("FAIL  ads.ts does not call mod.showRewarded — this has drifted");
    process.exit(1);
  }
  // the statement, which ends at the first semicolon after the call
  const rest = ads.slice(at);
  const call = rest.slice(0, rest.indexOf(";") + 1);
  is(
    !/timeoutMs/.test(call),
    `showRewarded is called without a timeoutMs — ${call.trim()}`
  );
  /*
   * The documented sentence, checked against the SDK actually installed. If a
   * future version gives timeoutMs a default, omitting it stops meaning "wait
   * for the host" and this whole approach needs revisiting — so the claim is
   * pinned to the file rather than to memory.
   */
  const readme = readFileSync("node_modules/@verse8/ads/README.md", "utf8");
  is(
    /Never raised when `?timeoutMs`? is omitted/.test(readme),
    "and the SDK still promises never to time out when it is omitted"
  );
}

console.log("\nbut a host that never answers does not keep the player");
{
  const m = ads.match(/const GIVE_UP_MS\s*=\s*([0-9_]+)/);
  if (!m) {
    console.log("FAIL  ads.ts has no GIVE_UP_MS — this check has drifted");
    process.exit(1);
  }
  const giveUp = Number(m[1].replace(/_/g, ""));

  /*
   * The SDK renders the web advert in this frame when the host asks it to, and
   * caps that ad break itself. Our last resort has to sit well past that cap,
   * or it becomes the thing deciding an advert is over after all.
   */
  const sdk = readFileSync("node_modules/@verse8/ads/dist/index.mjs", "utf8");
  const h = sdk.match(/adBreakTimeoutMs>0\?[A-Za-z.]+:([0-9]+e?[0-9]*)/);
  if (!h) {
    console.log(
      "FAIL  cannot find the SDK's adBreakTimeoutMs default — the pattern has drifted"
    );
    process.exit(1);
  }
  const hostCap = Number(h[1]);

  is(
    giveUp >= hostCap * 3,
    `the last resort is far past the SDK's own ad-break cap (${giveUp}ms against ${hostCap}ms)`
  );
  is(
    giveUp >= 120_000,
    `and past any advert that could still be playing (${giveUp}ms)`
  );
}

/*
 * The half of this with no number in it: a rejected promise must not be left
 * to the timer. bound() used to attach only a `then`, so an SDK that threw
 * left the player watching a disabled prompt until the clock ran out — and the
 * clock is now three minutes.
 */
console.log("\nand a broken advert does not hold them either");
{
  const b = ads.slice(ads.indexOf("function bound("));
  const body = b.slice(0, b.indexOf("\n}"));
  is(
    /\.catch\(|\.then\([^)]*,|,\s*\(e/.test(body),
    "bound() handles a rejection as well as a resolution"
  );
}

if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
