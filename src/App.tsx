import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  I18nContext,
  detectLang,
  rememberLang,
  translate,
  translateParams,
  loadLang,
  type Lang,
} from "./i18n";
import { Office } from "./office/Office";
import { useSpaceCloses } from "./components/useSpaceCloses";
import { Loading } from "./components/Loading";
import { preloadArt } from "./components/preload";
import { DEV_TOOLS, devFlag } from "./dev";
import "./App.css";

/*
 * The three testing surfaces are fetched when they are asked for.
 *
 * They are a third of the bundle and nobody who is playing the game ever opens
 * one — they are reached by a query parameter, on a build that has the tools
 * turned on. Shipping them in the file that has to arrive before the first
 * frame is paying for them on every visit.
 */
const ReproLab = lazy(() =>
  import("./repro/ReproLab").then((m) => ({ default: m.ReproLab }))
);
const Workbench = lazy(() =>
  import("./regression/Workbench").then((m) => ({ default: m.Workbench }))
);
const DebugLab = lazy(() =>
  import("./debug/DebugLab").then((m) => ({ default: m.DebugLab }))
);

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
 * hundred and eighteen, which is fine to play and useless to check against — the
 * defects worth checking are the ones too quiet to come round often.
 */
const LAB = devFlag("lab");
const REPRO = devFlag("repro");
const DEBUG = devFlag("debug");

export default function App() {
  useSpaceCloses();
  /*
   * Nothing opens until the art has arrived.
   *
   * A sheet that has not landed draws nothing, so the first walk to work used
   * to happen through a street whose buildings turned up one at a time.
   */
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void preloadArt((p) => live && setProgress(p)).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const [lang, setLangState] = useState<Lang>(detectLang);
  /*
   * Switching language fetches it first.
   *
   * The dictionaries arrive one at a time now, so flipping the setting before
   * the new one lands would show the whole game in English for as long as the
   * fetch takes. It is remembered straight away either way: the choice is the
   * player's the moment they make it, whatever the network does next.
   */
  const setLang = (next: Lang) => {
    rememberLang(next);
    void loadLang(next).then(() => setLangState(next));
  };

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
          {!ready ? (
            <Loading progress={progress} />
          ) : (
            // the labs arrive as their own files, and the wait for one is the
            // same screen the game itself opened on
            <Suspense fallback={<Loading progress={1} />}>
              {DEBUG ? (
                <DebugLab onExit={back} />
              ) : REPRO ? (
                <ReproLab onExit={back} />
              ) : LAB ? (
                <Workbench onExit={back} />
              ) : (
                <Office onExit={back} />
              )}
            </Suspense>
          )}
          {/*
            A built game with the testing surfaces still in it looks exactly
            like the real one, which is how a debug build gets released. It
            does not look like it any more. The dev server is not tagged: there
            it is the expected state and the tag would be noise.
          */}
          {DEV_TOOLS && !import.meta.env.DEV && <span className="debug-tag">DEBUG</span>}
        </div>
      </div>
    </I18nContext.Provider>
  );
}
