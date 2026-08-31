import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { stage02Scene } from "../stages/stage02/scene";
import { generateMutations, applyMutation, pickMutation } from "../engine/generate";
import type { Mutation } from "../engine/generate";
import { factsFor, currentValue, type SpecEntry } from "../spec/facts";
import { sfx } from "../audio/sfx";

/** re-measurements allowed per build; recording is free, checking is not */
const BUDGET = 8;

/** builds between now and the ship date */
const BUILDS = 8;

/** what happened to each build's regression once it shipped */
type Outcome = { build: number; bugId: string; descKey: string; descParams: Record<string, string>; caught: boolean; falseReport: boolean };

/** ?playtest=1 reveals the live regression, for testing the loop */
const PLAYTEST = new URLSearchParams(location.search).has("playtest");

/**
 * Vertical slice of the regression design.
 *
 * Build 1 is the baseline and is clean by construction: whatever the player
 * sees is correct, and they write down whichever facts they think are worth
 * defending. Every later build carries one regression, and the only way to
 * find it is that a recorded fact stopped holding.
 *
 * Nothing tells the player what changed. That is the whole point — the spec
 * sheet is the player's own work, so "is this a bug or a design choice" is a
 * question they answer with their notes instead of guessing.
 */
export function Workbench({ onExit }: { onExit: () => void }) {
  const { t, tp } = useI18n();
  const base = stage02Scene;
  const pool = useMemo(() => generateMutations(base), [base]);

  const [build, setBuild] = useState(1);
  const [mutation, setMutation] = useState<Mutation | null>(null);
  const [entries, setEntries] = useState<SpecEntry[]>([]);
  const [budget, setBudget] = useState(BUDGET);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"world" | "spec">("world");
  const [verdict, setVerdict] = useState<null | { ok: boolean; objectId: string }>(null);
  /** one report per build: guessing until it lands is not verification */
  const [reportedThisBuild, setReportedThisBuild] = useState(false);
  const [log, setLog] = useState<Outcome[]>([]);
  const [shipped, setShipped] = useState(false);

  const live = useMemo(
    () => (mutation ? applyMutation(base, mutation) : base),
    [base, mutation]
  );

  const nextBuild = () => {
    sfx.play("click");
    // whatever was not caught in this build ships with it
    if (mutation) {
      setLog((l) =>
        l.some((o) => o.build === build)
          ? l
          : [
              ...l,
              {
                build,
                bugId: mutation.bug.id,
                descKey: mutation.bug.descKey,
                descParams: mutation.bug.descParams,
                caught: false,
                falseReport: reportedThisBuild,
              },
            ]
      );
    }
    if (build >= BUILDS) {
      setShipped(true);
      setVerdict(null);
      return;
    }
    setReportedThisBuild(false);
    setMutation(pickMutation(pool));
    setBuild((b) => b + 1);
    setBudget(BUDGET);
    setSelected(null);
    setVerdict(null);
    setEntries((es) => es.map((e) => ({ ...e, checkedBuild: undefined, checkedOk: undefined })));
    setView("world");
  };

  const record = (objectId: string, factKey: string) => {
    const o = live.objects.find((x) => x.id === objectId);
    if (!o) return;
    const fact = factsFor(live, o).find((f) => f.key === factKey);
    if (!fact) return;
    sfx.play("pick");
    setEntries((es) => [
      ...es.filter((e) => !(e.objectId === objectId && e.factKey === factKey)),
      {
        objectId,
        factKey,
        labelKey: fact.labelKey,
        params: fact.params,
        value: fact.value,
        build,
      },
    ]);
  };

  const check = (entry: SpecEntry) => {
    if (budget <= 0) return;
    const now = currentValue(live, entry.objectId, entry.factKey);
    const ok = now === entry.value;
    sfx.play(ok ? "click" : "fail");
    setBudget((b) => b - 1);
    setEntries((es) =>
      es.map((e) =>
        e.objectId === entry.objectId && e.factKey === entry.factKey
          ? { ...e, checkedBuild: build, checkedOk: ok }
          : e
      )
    );
  };

  const report = (objectId: string) => {
    if (!mutation || reportedThisBuild) return;
    const answers = mutation.mutator.answerIds(base, mutation.target);
    const ok = answers.includes(objectId);
    sfx.play(ok ? "success" : "fail");
    setReportedThisBuild(true);
    setLog((l) => [
      ...l.filter((o) => o.build !== build),
      {
        build,
        bugId: mutation.bug.id,
        descKey: mutation.bug.descKey,
        descParams: mutation.bug.descParams,
        caught: ok,
        falseReport: !ok,
      },
    ]);
    setVerdict({ ok, objectId });
  };

  const name = (id: string) =>
    t(live.objects.find((o) => o.id === id)?.nameKey ?? id);
  const factValue = (v: string) => {
    const key = `factval.${v}`;
    const translated = t(key);
    return translated === key ? v : translated;
  };

  const selectedObject = selected ? live.objects.find((o) => o.id === selected) : undefined;
  const recorded = (objectId: string, factKey: string) =>
    entries.some((e) => e.objectId === objectId && e.factKey === factKey);

  const header = (
    <div className="wb-header">
      <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
        ←
      </button>
      <span className="wb-build">{tp("wb.build", { n: String(build) })}</span>
      <span className="wb-deadline">{tp("wb.deadline", { n: String(BUILDS - build) })}</span>
      {PLAYTEST && mutation && (
        <span className="wb-answer">{mutation.bug.id}</span>
      )}
      <span className="wb-budget">
        {t("wb.budget")} {budget}/{BUDGET}
      </span>
      <button className="btn-ghost small" onClick={() => setView(view === "world" ? "spec" : "world")}>
        {view === "world" ? `${t("wb.spec")} ${entries.length}` : t("wb.world")}
      </button>
    </div>
  );

  // fact and bug params carry i18n keys (an object or counter name), not text
  const xp = (params?: Record<string, string>) =>
    Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, t(v)]));

  const caught = log.filter((o) => o.caught).length;
  const missed = log.filter((o) => !o.caught);
  const falseReports = log.filter((o) => o.falseReport).length;
  // every shipped defect costs half a star, every false report a fifth
  const rating = Math.max(
    1,
    Math.round((5 - missed.length * 0.5 - falseReports * 0.2) * 10) / 10
  );

  if (shipped) {
    return (
      <div className="wb-root wb-ship">
        <h1>{t("wb.shipTitle")}</h1>
        <div className="wb-rating">
          <span className="wb-stars">
            {"★".repeat(Math.round(rating))}
            {"☆".repeat(5 - Math.round(rating))}
          </span>
          <b>{rating.toFixed(1)}</b>
        </div>
        <p className="wb-tally">
          {tp("wb.tally", {
            caught: String(caught),
            total: String(log.length),
            wrong: String(falseReports),
          })}
        </p>
        <div className="wb-reviews">
          {missed.length === 0 ? (
            <p className="wb-review good">{t("wb.reviewClean")}</p>
          ) : (
            missed.map((o) => (
              <p key={o.build} className="wb-review">
                {"★☆☆☆☆ “"}
                {tp(o.descKey, xp(o.descParams))}
                {"”"}
                <small>{tp("wb.fromBuild", { n: String(o.build) })}</small>
              </p>
            ))
          )}
        </div>
        <button className="btn-primary" onClick={onExit}>
          {t("wb.backToTitle")}
        </button>
      </div>
    );
  }

  return (
    <div className="wb-root">
      {view === "world" ? (
        <EngineStage
          key={`b${build}`}
          scene={live}
          mode="observe"
          header={header}
          onObserve={(id) => setSelected(id)}
          onClear={() => {}}
          onExit={onExit}
        />
      ) : (
        <div className="wb-panel-full">
          {header}
          <div className="wb-notes">
            <p className="wb-patch">
              <b>{t("wb.patchNotes")}</b>
              <br />
              {build === 1 ? t("wb.patchBaseline") : t("wb.patchNone")}
            </p>
            {entries.length === 0 && <p className="wb-empty">{t("wb.specEmpty")}</p>}
            {entries.map((e) => (
              <div
                key={`${e.objectId}.${e.factKey}`}
                className={`wb-entry ${
                  e.checkedBuild === build ? (e.checkedOk ? "ok" : "bad") : ""
                }`}
              >
                <div className="wb-entry-main">
                  <b>{name(e.objectId)}</b>
                  <span>{tp(e.labelKey, xp(e.params))}</span>
                  <code>{factValue(e.value)}</code>
                  <small>{tp("wb.recordedIn", { n: String(e.build) })}</small>
                </div>
                <div className="wb-entry-actions">
                  {e.checkedBuild === build ? (
                    e.checkedOk ? (
                      <span className="wb-ok">{t("wb.match")}</span>
                    ) : (
                      <>
                        <span className="wb-bad">
                          {t("wb.mismatch")}{" "}
                          <code>{factValue(currentValue(live, e.objectId, e.factKey) ?? "-")}</code>
                        </span>
                        <button
                          className="btn-primary small"
                          disabled={reportedThisBuild}
                          onClick={() => report(e.objectId)}
                        >
                          {t("wb.report")}
                        </button>
                      </>
                    )
                  ) : (
                    <button
                      className="btn-ghost small"
                      disabled={budget <= 0}
                      onClick={() => check(e)}
                    >
                      {t("wb.check")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary wb-next" onClick={nextBuild}>
            {t("wb.nextBuild")}
          </button>
        </div>
      )}

      {selectedObject && view === "world" && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal wb-observe" onClick={(ev) => ev.stopPropagation()}>
            <h2>{t(selectedObject.nameKey)}</h2>
            <div className="wb-facts">
              {factsFor(live, selectedObject).map((f) => (
                <button
                  key={f.key}
                  className={`wb-fact ${recorded(selectedObject.id, f.key) ? "on" : ""}`}
                  onClick={() => record(selectedObject.id, f.key)}
                >
                  <span>{tp(f.labelKey, xp(f.params))}</span>
                  <code>{factValue(f.value)}</code>
                  <em>{recorded(selectedObject.id, f.key) ? t("wb.recorded") : t("wb.recordIt")}</em>
                </button>
              ))}
            </div>
            <button className="btn-ghost" onClick={() => setSelected(null)}>
              {t("wb.close")}
            </button>
          </div>
        </div>
      )}

      {verdict && (
        <div className="modal-backdrop">
          <div className={`modal result ${verdict.ok ? "success" : "fail"}`}>
            <h2>{verdict.ok ? t("wb.correct") : t("wb.wrong")}</h2>
            <p>
              {verdict.ok
                ? tp("wb.correctBody", { obj: name(verdict.objectId) })
                : t("wb.wrongBody")}
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setVerdict(null)}>
                {t("wb.close")}
              </button>
              <button className="btn-primary" onClick={nextBuild}>
                {t("wb.nextBuild")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
