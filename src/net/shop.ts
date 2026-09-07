import { useSyncExternalStore } from "react";
import type { GameServer } from "@agent8/gameserver";

/**
 * What the player has bought, and the one thing there is to buy.
 *
 * The shop sells the wait and not the reward. Owning this does not open
 * anything the game keeps shut: the half hour and the cup of coffee are the
 * same ones the advert hands out for nothing, the daily limits are untouched,
 * and a player who watches thirty seconds ends the day in exactly the state a
 * player who paid does. What changes is that the button stops costing thirty
 * seconds — the offer is still a choice between working late, going home, and
 * taking the free half hour, and the third one simply arrives at once.
 *
 * That is also why it is safe for this to be wrong in the player's favour.
 * The account is the record, but the account is not always reachable, and a
 * paying player whose network hiccuped should not be shown an advert they
 * bought their way out of. So the answer is remembered locally between reads.
 * Somebody who forges that flag gets, at most, the thing they could already
 * have had by sitting through two adverts.
 */

const PRODUCT_ID = "remove-ads";

/** the id this must be registered under in the Verse8 VXShop dashboard */
export const REMOVE_ADS = PRODUCT_ID;

type Remote = Pick<GameServer, "remoteFunction">;

const KEY = "fb_ads_removed";

function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function remember(v: boolean): void {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* a browser that will not store it asks the account again next time */
  }
}

let adsRemoved = remembered();
const listeners = new Set<() => void>();

function set(v: boolean): void {
  if (v === adsRemoved) return;
  adsRemoved = v;
  remember(v);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** whether the adverts have been bought out, as a value React re-reads */
export function useAdsRemoved(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => adsRemoved,
    () => false
  );
}

/**
 * Ask the account what it owns.
 *
 * Never un-sets on failure. A server that did not answer is not a server
 * saying no, and treating silence as "you own nothing" would take the
 * purchase away from the one player who paid for it every time the network
 * went quiet.
 */
export async function loadEntitlements(
  server: Remote | null | undefined
): Promise<void> {
  if (!server) return;
  try {
    const res = (await server.remoteFunction("getEntitlements", [])) as {
      adsRemoved?: boolean;
    } | null;
    if (res?.adsRemoved === true) set(true);
  } catch {
    /* the remembered answer stands */
  }
}
