import { useMemo, useState } from "react";
import {
  I18nContext,
  detectLang,
  translate,
  translateParams,
  type Lang,
} from "./i18n";
import { EngineStage } from "./engine/EngineStage";
import { buildCurriculum } from "./engine/curriculum";
import { ENGINE_SCENES, SCENE_BY_ID } from "./stages/registry";
import { Stage04 } from "./stages/stage04/Stage04";
import { useProgress } from "./net/useProgress";
import { EndingScreen } from "./components/EndingScreen";
import "./App.css";

const CURRICULUM = buildCurriculum(ENGINE_SCENES, 30);
/** ?playtest=1 unlocks every stage and reveals answers — dev only */
const PLAYTEST = new URLSearchParams(location.search).has("playtest");

export default function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  /** stage number currently being played, or null on the title screen */
  const [playing, setPlaying] = useState<number | null>(null);
  /** shown right after the last build is signed off */
  const [showEnding, setShowEnding] = useState(false);
  /** signed-off builds, mirrored to the Verse8 server when one is reachable */
  const { cleared, reportClear } = useProgress();

  const i18n = useMemo(
    () => ({
      lang,
      setLang,
      t: (key: string) => translate(lang, key),
      tp: (key: string, params: Record<string, string>) =>
        translateParams(lang, key, params),
    }),
    [lang]
  );
  const { t } = i18n;

  const stage = playing ? CURRICULUM.find((s) => s.n === playing) : undefined;
  const scene = stage && !stage.bespoke ? SCENE_BY_ID[stage.sceneId] : undefined;

  const onClear = () => {
    if (stage) {
      reportClear(stage.n);
      if (stage.n >= CURRICULUM.length) setShowEnding(true);
    }
    setPlaying(null);
  };

  const exit = () => setPlaying(null);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app-root">
        <div className="lang-switch">
          <button
            className={lang === "ko" ? "on" : ""}
            onClick={() => setLang("ko")}
          >
            한국어
          </button>
          <button
            className={lang === "en" ? "on" : ""}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>

        {showEnding && (
          <EndingScreen
            total={CURRICULUM.length}
            onBackToTitle={() => setShowEnding(false)}
          />
        )}

        {playing === null && !showEnding && (
          <div className="title-screen wide">
            <h1>🐛 {t("game.title")}</h1>
            <p className="subtitle">{t("game.subtitle")}</p>
            <p className="progress-line">
              {t("game.progress")}: {cleared} / {CURRICULUM.length}
              {cleared >= CURRICULUM.length && (
                <button className="link-btn" onClick={() => setShowEnding(true)}>
                  {t("ending.replay")}
                </button>
              )}
            </p>
            <div className="stage-grid">
              {CURRICULUM.map((s) => {
                const unlocked = PLAYTEST || s.n <= cleared + 1;
                const done = s.n <= cleared;
                return (
                  <button
                    key={s.id}
                    className={`stage-cell ${done ? "done" : ""} ${
                      unlocked ? "" : "locked"
                    }`}
                    disabled={!unlocked}
                    onClick={() => setPlaying(s.n)}
                  >
                    <span className="cell-no">{s.n}</span>
                    <span className="cell-name">{t(s.nameKey)}</span>
                    <span className="cell-stars">
                      {done ? "✅" : "★".repeat(s.stars)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {stage && scene && (
          <EngineStage
            key={stage.id}
            scene={scene}
            stageNo={stage.n}
            title={t(stage.nameKey)}
            tutorial={stage.n === 1}
            playtest={PLAYTEST}
            minBand={stage.minBand}
            maxBand={stage.maxBand}
            onClear={onClear}
            onExit={exit}
          />
        )}

        {stage && stage.bespoke && (
          <Stage04
            onClear={onClear}
            onExit={exit}
            playtest={PLAYTEST}
            stageNo={stage.n}
            title={t(stage.nameKey)}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
}
