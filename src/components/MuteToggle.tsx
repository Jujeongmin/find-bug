import { useState } from "react";
import { sfx } from "../audio/sfx";
import { useI18n } from "../i18n";

export function MuteToggle() {
  const { t } = useI18n();
  const [muted, setMuted] = useState(() => sfx.isMuted());

  return (
    <button
      className={`mute-btn ${muted ? "off" : ""}`}
      aria-pressed={muted}
      title={muted ? t("sound.on") : t("sound.off")}
      onClick={() => {
        const next = !muted;
        sfx.setMuted(next);
        setMuted(next);
        // confirm audibly that sound came back
        if (!next) sfx.play("click");
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
