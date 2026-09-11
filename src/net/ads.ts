import { devFlag } from "../dev";

/**
 * Rewarded video.
 *
 * The seam this file used to be guessed at the SDK's shape and guessed wrong:
 * it waited for a `Verse8Ads` global that nothing sets and read a `completed`
 * boolean off the result. The real contract is `@verse8/ads`, and it answers
 * with a status — "rewarded", "dismissed", or "failed" with a reason. Against
 * the old reading every finished advert would have come back undefined, which
 * is falsy, so watching one to the end would have earned nothing.
 *
 * Three rules this file exists to hold:
 *
 * - Nothing is granted unless the advert reports "rewarded". Dismissed earns
 *   nothing; so does every kind of failure.
 * - One at a time. The SDK refuses a second advert while one is up, and a
 *   refusal is not the player's fault, so `busy` costs them nothing.
 * - The client asking for a reward is not proof it earned one. The platform's
 *   own guidance draws the line at rewards worth stealing — currency, premium
 *   items, rare drops — and puts those behind a server that checks the
 *   requestId. Ours are half an hour of a fictional day and a cup of coffee:
 *   nothing that can be banked, resold, or carried out of the run. The
 *   requestId is carried anyway, so the day it is worth verifying there is
 *   something to verify with.
 *
 * The SDK arrives when an advert is first asked for, not before. It is no use
 * to anyone who never opens an offer, and the file that has to land before the
 * first frame is not the place to pay for it.
 */

import type { RewardedAdResult } from "@verse8/ads";

/** where an ad is being offered, for the platform's reporting */
export type Placement = "overtime" | "coffee";

/**
 * What the caller needs to know, which is less than the SDK says.
 *
 * "granted" pays out. "none" did not, and the offer stands — the player
 * dismissed it, or it broke in a way that trying again might fix. "gone" means
 * this session has no adverts at all and the offer's third line should stop
 * being drawn.
 */
export type AdOutcome =
  | { kind: "granted"; requestId: string }
  | { kind: "none"; failed: boolean }
  | { kind: "gone" };

/** dev stand-in, so the offer can be played before an advert can be shown */
const STUB = devFlag("playtest");

/**
 * Whether this session can show an advert at all.
 *
 * Two things say no. One is the frame: the SDK talks to a Verse8 host across
 * postMessage, and on a dev server — or anywhere else the game is opened at
 * the top of a window — there is nobody to talk to. The other is the SDK
 * itself reporting `unsupported_env`, which is the platform saying the same
 * thing with more authority.
 *
 * Starting from the frame rather than from optimism is what keeps the offer
 * honest: a third line that cannot pay out is a promise the game breaks the
 * first time anyone presses it.
 *
 * The test is the host, not merely the fact of a frame. Put the game in some
 * other page and the advert call goes out to a parent that never answers —
 * observed hanging well past the timeout the SDK documents, so there is no
 * waiting it out. Nobody is meant to run it there, but "nobody is meant to"
 * is not a reason to leave a button that eats the player instead of failing.
 */
let unsupported = false;

/*
 * The same host test the SDK applies before it will talk to a parent.
 *
 * Built from a string rather than written as a literal. Every route into this
 * file has eaten a backslash at least once, and a pattern with a dead escape
 * in it matches the wrong thing and says nothing about it — here it would
 * match verse8Xio, and any host that owns one.
 */
const VERSE8_HOST = new RegExp("^https://(.*\\.)?verse8\\.io$");

function inHostFrame(): boolean {
  if (typeof window === "undefined") return false;
  let framed: boolean;
  try {
    framed = Boolean(window.parent) && window.parent !== window;
  } catch {
    /* a cross-origin parent throws rather than answering, which is itself an
       answer: there is a frame above this one */
    framed = true;
  }
  if (!framed) return false;
  /*
   * Who is above us, where the browser will say. Firefox has no
   * ancestorOrigins, so there the frame alone has to stand for it — the wait
   * is bounded either way, which is what actually keeps that case survivable.
   */
  const ancestors = window.location.ancestorOrigins;
  if (!ancestors || ancestors.length === 0) return true;
  return VERSE8_HOST.test(ancestors[0] ?? "");
}

export function available(): boolean {
  if (STUB) return true;
  return !unsupported && inHostFrame();
}

/** loaded once, and only if somebody opens an offer */
let sdk: Promise<typeof import("@verse8/ads")> | null = null;

function load(): Promise<typeof import("@verse8/ads")> {
  if (!sdk) sdk = import("@verse8/ads");
  return sdk;
}

/** true while an advert is up; the SDK shows one at a time and says so */
let showing = false;

/**
 * Show a rewarded advert.
 *
 * Must be called from a user gesture — the ad networks treat anything else as
 * a policy violation, which is why every caller here hangs off a button the
 * player pressed.
 *
 * Never throws: the SDK resolves on every path, and the two things that can go
 * wrong outside it — the module failing to arrive, and there being no host to
 * ask — resolve too.
 */
export async function showRewarded(placementId: Placement): Promise<AdOutcome> {
  if (STUB) {
    // the stub waits, so the pause an advert creates is part of what gets judged
    await new Promise((r) => setTimeout(r, 1200));
    return { kind: "granted", requestId: `stub-${placementId}-${Date.now()}` };
  }
  if (!available()) return { kind: "gone" };
  if (showing) return { kind: "none", failed: false };

  let mod: typeof import("@verse8/ads");
  try {
    mod = await load();
  } catch {
    // it did not arrive and will not arrive on a retry either
    sdk = null;
    unsupported = true;
    return { kind: "gone" };
  }

  showing = true;
  let res: RewardedAdResult;
  try {
    /*
     * No timeoutMs. The SDK's own words: "No default — omit it and the request
     * waits for the host. Supply one only to bound total time", and "timeout is
     * never raised when timeoutMs is omitted."
     *
     * Supplying one was the bug. Any number here is a wall in front of the
     * advert, and the advert is the thing being waited for — a wall at twenty
     * seconds failed a thirty second advert, and a wall at sixty would fail a
     * ninety second one. The host is the only party that knows how long what
     * it is playing runs for, so the host is the one that ends this.
     */
    res = await bound(mod.showRewarded({ placementId }));
  } finally {
    showing = false;
  }
  return read(res);
}

/**
 * The one number left, and what it is for.
 *
 * Not a limit on the advert. The advert is ended by the host, which is the
 * only party that knows what it is playing. This is the case the host never
 * answers at all — a Verse8 page whose ad bridge is not there, where the
 * handshake gets no reply inside its own half second, the SDK carries on
 * anyway, and without a timeoutMs nothing is ever going to resolve. Left
 * alone, that is a prompt frozen mid-evening for the rest of the run.
 *
 * Three minutes because it has to be past any advert that could legitimately
 * still be running, and no rewarded advert runs three minutes. It is a guess,
 * and it is only ever reached by something already broken: an advert that is
 * genuinely playing when this fires has been mistreated, so the number is
 * deliberately far past where that could happen rather than tuned close to it.
 */
const GIVE_UP_MS = 180_000;

/**
 * The wait, ended by us if the SDK does not end it.
 *
 * `timeoutMs` is asked for as well, and where the host answers it is the one
 * that matters. But a parent that never replies at all was observed leaving
 * the promise open past that deadline, and the shape of that failure is a
 * player at six o'clock looking at a button that has stopped meaning anything.
 * Losing the advert is a cost; losing the evening is not one to offer.
 *
 * A rejection is handled beside the resolution rather than left to the timer.
 * The SDK is documented as resolving on every path and does, but "the promise
 * we were handed behaved" is not something to stake the better part of a
 * minute of somebody's evening on.
 */
function bound(p: Promise<RewardedAdResult>): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          status: "failed",
          requestId: "",
          error: { code: "timeout", message: "no answer from the host" },
        }),
      GIVE_UP_MS
    );
    const done = (r: RewardedAdResult) => {
      clearTimeout(timer);
      resolve(r);
    };
    void p.then(done, (e: unknown) =>
      done({
        status: "failed",
        requestId: "",
        error: {
          code: "platform_error",
          message: e instanceof Error ? e.message : "threw",
        },
      })
    );
  });
}

/** the SDK's answer, reduced to what the office does about it */
function read(res: RewardedAdResult): AdOutcome {
  if (res.status === "rewarded") {
    /*
     * res.reward is a hint for the animation, not the grant. What the half
     * hour is worth is decided here, by the office, and an advert that came
     * back with a different number in it does not get to change that.
     */
    return { kind: "granted", requestId: res.requestId };
  }
  if (res.status === "dismissed") return { kind: "none", failed: false };
  switch (res.error.code) {
    case "busy":
      // one was already up; not the player's doing and not worth a message
      return { kind: "none", failed: false };
    case "unsupported_env":
      unsupported = true;
      return { kind: "gone" };
    default:
      // timeout, platform_error: worth saying so, and worth letting them retry
      return { kind: "none", failed: true };
  }
}
