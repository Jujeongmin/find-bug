import { devFlag } from "../dev";
/**
 * Rewarded video, and the seam it will arrive through.
 *
 * The Verse8 SDK is not installed yet, so `available()` is false in a normal
 * build and every offer that depends on it simply does not appear — no dead
 * button, no promise the game cannot keep. Under ?playtest=1 a stub stands in
 * so the flow around the offer can be played and judged before the real thing
 * exists.
 *
 * Two rules this file exists to hold:
 *
 * - Nothing is granted unless the ad reports completion. A dismissed ad returns
 *   false and the caller must do nothing.
 * - The client asking for a reward is not proof it earned one. When the SDK
 *   lands, the grant moves behind a server call that verifies the impression;
 *   until then the rewards here are small and local by design — half an hour of
 *   a fictional day, a coffee — and nothing that can be resold or banked.
 */

/** where an ad is being offered, for the platform's reporting */
export type Placement = "overtime" | "coffee";

interface Verse8Ads {
  showRewarded(opts: { placementId: string }): Promise<{ completed: boolean }>;
}

const sdk = (): Verse8Ads | undefined =>
  (globalThis as { Verse8Ads?: Verse8Ads }).Verse8Ads;

/** dev stand-in, so the offer can be played before the SDK is installed */
const STUB = devFlag("playtest");

export function available(): boolean {
  return Boolean(sdk()) || STUB;
}

/**
 * Show a rewarded ad. Resolves true only if it ran to the end.
 *
 * Must be called from a user gesture — the platform refuses otherwise, which
 * is why every caller here hangs off a button the player pressed.
 */
export async function showRewarded(placementId: Placement): Promise<boolean> {
  const ads = sdk();
  if (!ads) {
    if (!STUB) return false;
    // the stub waits, so the pause an ad creates is part of what gets judged
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  }
  try {
    const res = await ads.showRewarded({ placementId });
    return Boolean(res?.completed);
  } catch {
    return false;
  }
}
