/**
 * Agent8 game server for "출시 전 마지막 검증".
 *
 * Per the Verse8 docs this class is defined and never exported — the platform
 * picks it up by name. Every method here is callable from the client with
 * `server.remoteFunction("<name>", [args])`.
 *
 * The game itself runs entirely on the client; the server only keeps a player's
 * verified-build count so progress survives a device change, and exposes a
 * small leaderboard built from that number.
 */

/** highest stage number the curriculum can hand out */
const MAX_STAGE = 60;

class Server {
  /** connectivity probe used by the client before it trusts server progress */
  async ping() {
    return "pong";
  }

  /** the caller's saved progress */
  async getProgress() {
    const state = (await $global.getMyState()) || {};
    return {
      account: $sender.account,
      cleared: Number(state.cleared) || 0,
      updatedAt: Number(state.updatedAt) || 0,
    };
  }

  /**
   * Records a signed-off build. Progress only ever moves forward, so a stale
   * client can't roll a player back.
   */
  async reportClear(stageNo) {
    const n = Math.floor(Number(stageNo));
    if (!Number.isFinite(n) || n < 1 || n > MAX_STAGE) return null;

    const state = (await $global.getMyState()) || {};
    const cleared = Math.max(Number(state.cleared) || 0, n);
    await $global.updateMyState({
      cleared,
      updatedAt: Date.now(),
    });
    return cleared;
  }

  /** lets a player wipe their own save */
  async resetProgress() {
    await $global.updateMyState({ cleared: 0, updatedAt: Date.now() });
    return 0;
  }
}
