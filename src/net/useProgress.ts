import { useCallback, useEffect, useRef, useState } from "react";
import { useGameServer } from "@agent8/gameserver";

const KEY = "fb_progress";

function readLocal(): number {
  try {
    const n = parseInt(localStorage.getItem(KEY) ?? "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLocal(n: number) {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* private browsing — local save is best effort */
  }
}

export interface Progress {
  /** highest stage number signed off */
  cleared: number;
  /** true once the Verse8 server has answered */
  synced: boolean;
  reportClear: (stageNo: number) => void;
}

/**
 * Progress is kept locally so the game works offline and in plain `npm run dev`,
 * and mirrored to the Verse8 server when one is reachable so it follows the
 * player across devices. The higher of the two always wins.
 */
export function useProgress(): Progress {
  const { server, connected } = useGameServer();
  const [cleared, setCleared] = useState<number>(readLocal);
  const [synced, setSynced] = useState(false);
  const serverRef = useRef(server);
  serverRef.current = server;

  /* pull the saved value once the socket is up */
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await serverRef.current.remoteFunction("getProgress", []);
        if (cancelled || !remote) return;
        const merged = Math.max(Number(remote.cleared) || 0, readLocal());
        setCleared(merged);
        writeLocal(merged);
        setSynced(true);
        // push local progress earned before this device ever connected
        if (merged > (Number(remote.cleared) || 0)) {
          await serverRef.current.remoteFunction("reportClear", [merged]);
        }
      } catch {
        /* server unreachable — keep playing on the local save */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const reportClear = useCallback(
    (stageNo: number) => {
      setCleared((prev) => {
        const next = Math.max(prev, stageNo);
        writeLocal(next);
        return next;
      });
      if (!connected) return;
      serverRef.current.remoteFunction("reportClear", [stageNo]).catch(() => {
        /* the local save already holds it; nothing to recover */
      });
    },
    [connected]
  );

  return { cleared, synced, reportClear };
}
