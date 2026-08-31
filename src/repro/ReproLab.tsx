import { useRef, useState } from "react";
import { useI18n } from "../i18n";
import { EngineStage } from "../engine/EngineStage";
import { stage02Scene } from "../stages/stage02/scene";
import type { Action } from "../engine/types";
import { holds, idOf, labelOf, type Condition, type Context } from "./conditions";
import { sfx } from "../audio/sfx";

/** ?playtest=1 reveals the real trigger */
const PLAYTEST = new URLSearchParams(location.search).has("playtest");

/** shop stock — the defect can fire on any of these */
const ITEMS = ["book", "potion", "scroll", "meat", "bread"];

/**
 * The real trigger. Two conditions, so neither alone reproduces it, which is
 * what makes single-variable experiments necessary instead of optional.
 */
const TRIGGER: Condition[] = [
  { t: "repeatSame", n: 2 },
  { t: "near", objectId: "cat", radius: 70 },
];

/** everything the player can propose; the trigger is a subset of this */
const VOCAB: Condition[] = [
  { t: "repeatSame", n: 2 },
  { t: "near", objectId: "cat", radius: 70 },
  { t: "counterAtLeast", counter: "items", n: 5 },
  { t: "counterBelow", counter: "gold", n: 20 },
  { t: "withinSeconds", s: 2 },
];

const MAX_SUBMITS = 3;

interface Row {
  n: number;
  objectId: string;
  delta: number;
  buggy: boolean;
}

/**
 * Reproduction slice.
 *
 * A user reports that buying sometimes gives two items. It does — but only
 * when the trigger holds, so the player has to make it happen on demand and
 * then say exactly which conditions were required. Naming too few conditions
 * is an unstable repro; naming too many is noise. Both are rejected.
 */
export function ReproLab({ onExit }: { onExit: () => void }) {
  const { t, tp } = useI18n();
  const [log, setLog] = useState<Row[]>([]);
  const [view, setView] = useState<"world" | "note">("world");
  const [picked, setPicked] = useState<string[]>([]);
  const [submits, setSubmits] = useState(0);
  const [result, setResult] = useState<null | "ok" | "unstable" | "noisy">(null);

  // tap history lives in a ref: it feeds the next condition check, and
  // re-rendering on every tap would restart the scene
  const prev = useRef<{ objectId: string | null; at: number | null; streak: number }>({
    objectId: null,
    at: null,
    streak: 0,
  });
  const seq = useRef(0);

  const onAction = (
    objectId: string,
    ctx: { counters: Record<string, number>; objects: Record<string, { x: number; y: number }>; now: number }
  ): Action[] | null => {
    if (!ITEMS.includes(objectId)) return null;

    const streak = prev.current.objectId === objectId ? prev.current.streak + 1 : 1;
    const full: Context = {
      ...ctx,
      objectId,
      prevObjectId: prev.current.objectId,
      prevAt: prev.current.at,
      sameStreak: streak,
    };
    const buggy = TRIGGER.every((c) => holds(c, full));
    prev.current = { objectId, at: ctx.now, streak };

    seq.current += 1;
    const delta = buggy ? 2 : 1;
    setLog((l) => [{ n: seq.current, objectId, delta, buggy }, ...l].slice(0, 40));
    if (buggy) sfx.play("fail");

    return [{ a: "increment", counter: "items", by: delta }];
  };

  const toggle = (id: string) => {
    sfx.play("click");
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const submit = () => {
    const truth = TRIGGER.map(idOf);
    const missing = truth.filter((x) => !picked.includes(x));
    const extra = picked.filter((x) => !truth.includes(x));
    setSubmits((n) => n + 1);
    if (missing.length === 0 && extra.length === 0) {
      sfx.play("success");
      setResult("ok");
    } else if (missing.length > 0) {
      sfx.play("fail");
      setResult("unstable");
    } else {
      sfx.play("fail");
      setResult("noisy");
    }
  };

  const name = (id: string) =>
    t(stage02Scene.objects.find((o) => o.id === id)?.nameKey ?? id);
  const condLabel = (c: Condition) => {
    const { key, params } = labelOf(c);
    return tp(key, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.includes(".") ? t(v) : v])));
  };

  const header = (
    <div className="wb-header rp-header">
      <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
        ←
      </button>
      <span className="wb-build">{t("rp.title")}</span>
      {PLAYTEST && <span className="wb-answer">{TRIGGER.map(idOf).join(" + ")}</span>}
      <button
        className="btn-ghost small"
        onClick={() => setView(view === "world" ? "note" : "world")}
      >
        {view === "world" ? `${t("rp.note")} ${picked.length}` : t("rp.build")}
      </button>
    </div>
  );

  const ticket = (
    <div className="rp-ticket">
      <b>{t("rp.ticketFrom")}</b>
      <p>“{t("rp.ticketBody")}”</p>
    </div>
  );

  return (
    <div className="wb-root">
      {view === "world" ? (
        <>
          <EngineStage
            scene={stage02Scene}
            mode="play"
            header={header}
            onAction={onAction}
            onClear={() => {}}
            onExit={onExit}
          />
          <div className="rp-log">
            {log.length === 0 ? (
              <p className="rp-hint">{t("rp.logEmpty")}</p>
            ) : (
              log.map((r) => (
                <div key={r.n} className={`rp-row ${r.buggy ? "bad" : ""}`}>
                  <span className="rp-n">{r.n}</span>
                  <span className="rp-obj">{name(r.objectId)}</span>
                  <code>
                    {t("counter.items")} +{r.delta}
                  </code>
                  {r.buggy && <em>{t("rp.here")}</em>}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="wb-panel-full">
          {header}
          <div className="wb-notes">
            {ticket}
            <p className="rp-instruct">{t("rp.instruct")}</p>
            {VOCAB.map((c) => {
              const id = idOf(c);
              return (
                <button
                  key={id}
                  className={`rp-cond ${picked.includes(id) ? "on" : ""}`}
                  onClick={() => toggle(id)}
                >
                  <span>{condLabel(c)}</span>
                  <em>{picked.includes(id) ? "✓" : ""}</em>
                </button>
              );
            })}
          </div>
          <button
            className="btn-primary wb-next"
            disabled={picked.length === 0 || submits >= MAX_SUBMITS || result === "ok"}
            onClick={submit}
          >
            {tp("rp.submit", { n: String(MAX_SUBMITS - submits) })}
          </button>
        </div>
      )}

      {result && (
        <div className="modal-backdrop">
          <div className={`modal result ${result === "ok" ? "success" : "fail"}`}>
            <h2>{t(`rp.${result}`)}</h2>
            <p>{t(`rp.${result}Body`)}</p>
            <div className="modal-actions">
              {result !== "ok" && submits < MAX_SUBMITS && (
                <button className="btn-ghost" onClick={() => setResult(null)}>
                  {t("rp.keepTesting")}
                </button>
              )}
              <button className="btn-primary" onClick={onExit}>
                {t("wb.backToTitle")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
