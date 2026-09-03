import { WALK_SHEET } from "../engine/spriteStyle";
import { useI18n } from "../i18n";
import type { CSSProperties } from "react";

/**
 * The screen the game opens on while its art is arriving.
 *
 * It is the walk to work in miniature, which is what this game is: the bar is
 * the pavement, and the person walking along it is the one you are about to
 * play. They are the same sprite, from the same sheet, at the same scale the
 * street draws them — a loading screen drawn in a different style than the
 * game is a promise the game does not keep.
 *
 * The percentage is not shown. What it is loading is not the player's
 * business, and a number that hangs at 87 is worse company than somebody
 * walking.
 */
export function Loading({ progress }: { progress: number }) {
  const { t } = useI18n();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="loading">
      <h1 className="loading-title">{t("loading.title")}</h1>
      <p className="loading-sub">{t("loading.sub")}</p>
      <div className="loading-track">
        <div className="loading-fill" style={{ width: `${pct}%` }} />
        {/*
          Walking on top of the bar rather than beside it: the fill is the
          ground under them, so the walk and the progress are one thing.
        */}
        <div
          className="loading-walker"
          style={
            { left: `${pct}%`, "--walk": `url(${WALK_SHEET})` } as CSSProperties
          }
        />
      </div>
    </div>
  );
}
