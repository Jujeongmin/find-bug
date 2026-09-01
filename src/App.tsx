import { useMemo, useState } from "react";
import {
  I18nContext,
  detectLang,
  translate,
  translateParams,
  type Lang,
} from "./i18n";
import { Office } from "./office/Office";
import { ReproLab } from "./repro/ReproLab";
import { Workbench } from "./regression/Workbench";
import { DebugLab } from "./debug/DebugLab";
import { useSpaceCloses } from "./components/useSpaceCloses";
import { devFlag } from "./dev";
import "./App.css";

/**
 * The QA floor is the game. It used to sit behind a stage grid that listed
 * thirty builds and a title screen in front of that, both left over from the
 * version this replaced — and signing a build off there dropped the player back
 * onto the title, which is the one screen the game should never show. The grid
 * is gone; its card-matching build moved into the office rotation with the
 * rest.
 *
 * ?lab=1 and ?repro=1 still open the two prototypes that were tried and set
 * aside, because they are worth reading before anyone tries either idea again.
 *
 * ?debug lists every build and every defect in it, and opens any one of them
 * with the answer showing. The office deals one fault at random out of a
 * hundred and twenty, which is fine to play and useless to check against — the
 * defects worth checking are the ones too quiet to come round often.
 */
const LAB = devFlag("lab");
const REPRO = devFlag("repro");
const DEBUG = devFlag("debug");

export default function App() {
  useSpaceCloses();
  const [lang, setLang] = useState<Lang>(detectLang);

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

  const back = () => location.assign(location.pathname);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app-root">
        {/* one phone-shaped frame; nothing outside it ever scrolls */}
        <div className="app-frame">
          {DEBUG ? (
            <DebugLab onExit={back} />
          ) : REPRO ? (
            <ReproLab onExit={back} />
          ) : LAB ? (
            <Workbench onExit={back} />
          ) : (
            <Office onExit={back} />
          )}
        </div>
      </div>
    </I18nContext.Provider>
  );
}
