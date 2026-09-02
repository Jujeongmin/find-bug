import { useEffect, useRef, useState } from "react";
import { useGameServer } from "@agent8/gameserver";
import { sfx } from "../audio/sfx";
import { clearCodex } from "../office/codex";
import { resetSave } from "../net/save";
import { useI18n, LANGS, type Lang } from "../i18n";
import { SettingsIcon, SpeakerIcon, SpeakerMutedIcon } from "./icons";

/**
 * Language and sound, behind one button in the corner of the floor.
 *
 * Both used to sit out on the floor itself: two language buttons and a
 * speaker. Two fit. Five do not — a row reading 한국어 EN 日本語 繁體 简体 is
 * most of the width of a phone, permanently, over a game that never needs it
 * after the first ten seconds.
 *
 * So the corner holds one gear, and everything that is a setting lives behind
 * it. That is also where the volume slider goes: a control that wants a drag
 * has no business on top of a scene the player is dragging to walk around.
 */
export function Settings() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [vol, setVol] = useState(() => sfx.getVolume());
  const panel = useRef<HTMLDivElement>(null);
  const { server, connected } = useGameServer();
  /*
   * Wiping asks once.
   *
   * The book is the only thing the game keeps, and a stray press in a panel
   * that otherwise only changes a language or a volume should not be able to
   * empty it. The button becomes the question rather than opening a dialogue
   * over the top of one.
   */
  const [confirming, setConfirming] = useState(false);
  /*
   * Silence is silence. A slider at nothing and a speaker still drawn as on
   * is the panel disagreeing with itself about whether the game makes a
   * sound, and the player believes the icon.
   */
  const silent = muted || vol === 0;

  // clicking the floor closes it, the same as walking away from a menu
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div className="settings" ref={panel}>
      {open && (
        <div className="settings-panel">
          <label>{t("settings.language")}</label>
          <div className="settings-langs">
            {LANGS.map((l) => (
              <button
                key={l.id}
                className={lang === l.id ? "on" : ""}
                onClick={() => setLang(l.id as Lang)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <label>
            {t("settings.sound")}
            <b>{silent ? "—" : `${Math.round(vol * 100)}%`}</b>
          </label>
          <div className="settings-sound">
            <button
              className={`settings-mute ${silent ? "off" : ""}`}
              aria-pressed={silent}
              title={silent ? t("sound.on") : t("sound.off")}
              onClick={() => {
                // pressing the speaker while the slider is at nothing has to
                // bring sound back, not toggle a flag nobody can hear
                if (silent) {
                  if (vol === 0) {
                    sfx.setVolume(1);
                    setVol(1);
                  }
                  sfx.setMuted(false);
                  setMuted(false);
                  sfx.play("click");
                  return;
                }
                sfx.setMuted(true);
                setMuted(true);
              }}
            >
              {silent ? <SpeakerMutedIcon /> : <SpeakerIcon />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(vol * 100)}
              aria-label={t("settings.sound")}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                sfx.setVolume(next);
                setVol(next);
                setMuted(sfx.isMuted());
              }}
              /* one blip on release, not one per pixel of the drag */
              onPointerUp={() => sfx.play("click")}
            />
          </div>

          <label>{t("settings.data")}</label>
          <button
            className={`settings-wipe ${confirming ? "arm" : ""}`}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              clearCodex();
              void resetSave(connected ? server : null);
              setConfirming(false);
              setOpen(false);
              sfx.play("fail");
            }}
          >
            {t(confirming ? "settings.wipeSure" : "settings.wipe")}
          </button>
        </div>
      )}
      <button
        className={`settings-btn ${open ? "on" : ""}`}
        title={t("settings.title")}
        onClick={() => setOpen((v) => !v)}
      >
        <SettingsIcon />
      </button>
    </div>
  );
}
