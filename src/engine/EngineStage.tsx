import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BugCategory } from "../core/types";
import { useI18n } from "../i18n";
import { CategorySelect } from "../components/CategorySelect";
import { ResultModal } from "../components/ResultModal";
import { FieldScaler, FIELD_W, FIELD_H } from "../components/FieldScaler";
import { TouchControls } from "../components/TouchControls";
import { PlaytestBar } from "../components/PlaytestBar";
import { spriteStyle } from "./spriteStyle";
import { sfx } from "../audio/sfx";
import type { SceneSpec } from "./types";
import { SceneRuntime } from "./runtime";
import {
  applyMutation,
  generateMutations,
  pickMutation,
  type Mutation,
} from "./generate";
import { poolFor } from "./curriculum";
import type { Band } from "./score";
import "../styles/shared.css";
import "./engine.css";

type Phase = "intro" | "play" | "picking" | "category" | "result" | "dead";

interface Props {
  scene: SceneSpec;
  onClear: () => void;
  onExit: () => void;
  /** difficulty window this stage draws bugs from */
  minBand?: Band;
  maxBand?: Band;
  /** stage number shown in the header */
  stageNo?: number;
  /** this slot's own name; falls back to the scene name */
  title?: string;
  /** first stage: show the one-shot hint over the report button */
  tutorial?: boolean;
  /** dev overlay that reveals the live answer */
  playtest?: boolean;
}

export function EngineStage({
  scene,
  onClear,
  onExit,
  minBand = 1,
  maxBand = 4,
  stageNo,
  title,
  tutorial = false,
  playtest = false,
}: Props) {
  const { t, tp } = useI18n();
  const [phase, setPhase] = useState<Phase>("intro");
  const [, setFrame] = useState(0);
  const [pickedObject, setPickedObject] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [showHint, setShowHint] = useState(
    () => tutorial && !localStorage.getItem("fb_seen_tutorial")
  );

  const mutations = useMemo(() => {
    const banded = poolFor(scene, minBand, maxBand);
    // never leave a stage with nothing to show
    return banded.length >= 1 ? banded : generateMutations(scene);
  }, [scene, minBand, maxBand]);
  const [mutation, setMutation] = useState<Mutation>(() =>
    pickMutation(mutations)
  );

  const runtimeRef = useRef<SceneRuntime>(
    new SceneRuntime(applyMutation(scene, mutation))
  );
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const sceneRef = useRef<SceneSpec>(scene);
  sceneRef.current = scene;

  const runtime = runtimeRef.current;
  const picking = phase === "picking";
  /** TouchControls writes into the same key set the keyboard uses */
  const keysRef = useRef(runtime.keys);

  /* keyboard */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
        e.preventDefault();
      if (e.key === " " || e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
        if (phaseRef.current !== "play") return;
        if (sceneRef.current.sideView) {
          if (!e.repeat) runtimeRef.current.jump();
        } else if (e.key === " ") {
          runtimeRef.current.doAttack(70);
        } else {
          runtimeRef.current.keys.add(e.key.toLowerCase());
        }
        return;
      }
      runtimeRef.current.keys.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) =>
      runtimeRef.current.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* game loop */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((nowMs - last) / 1000, 0.05);
      last = nowMs;
      if (phaseRef.current !== "play") return;
      runtimeRef.current.tick(dt);
      if (runtimeRef.current.state.dead) {
        sfx.play("death");
        setPhase("dead");
      }
      setFrame((f) => f + 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onObjectTap = useCallback(
    (objectId: string) => {
      if (picking) {
        sfx.play("pick");
        setPickedObject(objectId);
        setPhase("category");
        return;
      }
      sfx.play("click");
      runtimeRef.current.click(objectId);
    },
    [picking]
  );

  const onSubmitCategory = (category: BugCategory) => {
    const correct =
      mutation.bug.objectIds.includes(pickedObject!) &&
      mutation.bug.category === category;
    sfx.play(correct ? "success" : "fail");
    setResultSuccess(correct);
    setPhase("result");
  };

  /**
   * Start a fresh round with a different bug. Used by a failed report, by
   * dying, and by the playtest re-roll — in every case the answer stays hidden.
   */
  const nextRound = () => {
    const next = pickMutation(mutations, mutation.bug.id);
    setMutation(next);
    runtimeRef.current.reset(applyMutation(scene, next));
    setPickedObject(null);
    setPhase("play");
  };

  /**
   * Draw the scene the runtime is actually simulating. The `scene` prop is the
   * clean original; render-level mutations only exist on this mutated copy.
   */
  /** scenes without a controllable actor get no movement pad */
  const hasPlayer = scene.objects.some(
    (o) =>
      o.kind === "player" ||
      o.behaviors.some((b) => b.t === "playerTopDown" || b.t === "platformer")
  );
  const live = runtime.scene;
  const st = runtime.state;

  return (
    <div className="stage-frame">
      <div className="stage-header">
        <span className="stage-name">
          <button className="exit-btn" onClick={onExit} title={t("game.exit")}>
            ←
          </button>
          {stageNo ? stageNo + ". " : ""}
          {title ?? t(scene.nameKey)}
        </span>
        <div className="challenge-wrap">
          {phase === "play" && showHint && (
            <div className="tutorial-hint">⬇ {t("challenge.tutorial")}</div>
          )}
          <button
            className="challenge-btn"
            disabled={phase !== "play"}
            onClick={() => {
              if (showHint) {
                localStorage.setItem("fb_seen_tutorial", "1");
                setShowHint(false);
              }
              sfx.play("click");
              setPhase("picking");
            }}
          >
            {t("challenge.button")}
          </button>
        </div>
      </div>

      {playtest && (
        <PlaytestBar
          info={{
            sceneId: scene.id,
            stageNo,
            band: (mutation as { band?: number }).band,
            score: (mutation as { score?: number }).score,
            poolSize: mutations.length,
            bugId: mutation.bug.id,
            answers: mutation.bug.objectIds
              .map((id) => t(live.objects.find((o) => o.id === id)?.nameKey ?? id))
              .join(" / "),
            category: t(`category.${mutation.bug.category}`),
            desc: tp(mutation.bug.descKey, {
              ...mutation.bug.descParams,
              obj: t(mutation.bug.descParams.obj),
              counter: mutation.bug.descParams.counter
                ? t(mutation.bug.descParams.counter)
                : "",
            }),
          }}
          onReroll={nextRound}
        />
      )}

      <FieldScaler>
        <div
          className={`field ${live.backgroundClass} ${picking ? "picking" : ""}`}
          style={{ width: FIELD_W, height: FIELD_H }}
        >
          {/* HUD widgets */}
          <div className="hud">
            {live.objects
              .filter((o) => o.kind === "hud")
              .map((o) => {
                const spec = live.counters.find((c) => c.id === o.counter);
                const value = st.counters[o.counter ?? ""] ?? 0;
                return (
                  <div
                    key={o.id}
                    className={`${
                      spec?.display === "hearts" ? "hp-bar" : "score-box"
                    } ${picking ? "pickable" : ""}`}
                    onClick={
                      picking
                        ? (e) => {
                            e.stopPropagation();
                            onObjectTap(o.id);
                          }
                        : undefined
                    }
                    title={picking ? t(o.nameKey) : undefined}
                  >
                    {spec?.display === "hearts"
                      ? Array.from({ length: spec.max ?? value }, (_, i) => (
                          <span
                            key={i}
                            className="hud-heart"
                            style={spriteStyle({
                              sheet: "platformer",
                              col: i < value ? 4 : 6,
                              row: 2,
                              scale: 1.2,
                            })}
                          />
                        ))
                      : `${t(spec?.nameKey ?? o.nameKey)}: ${value}`}
                  </div>
                );
              })}
          </div>

          {/* world objects */}
          {live.objects
            .filter((o) => o.kind !== "hud" && o.kind !== "button")
            .map((o) => {
              const os = st.objects[o.id];
              if (!os.alive) return null;

              // a meter reads a counter: the needle turns with it, and a high
              // reading is flagged so alarms can light up. Computed before the
              // bar branch because gauges are drawn as bars.
              // anything a link points at shows an open state while fired
              const triggered = runtime.isTriggered(o.id);
              // flag-driven visuals apply to sprites and bars alike
              const flaggedB = o.behaviors.find((b) => b.t === "flagged");
              const flagClass =
                flaggedB && flaggedB.t === "flagged"
                  ? st.flags[flaggedB.flag]
                    ? flaggedB.onClass
                    : (flaggedB.offClass ?? "")
                  : "";
              const meterB = o.behaviors.find((b) => b.t === "meter");
              let needle: number | null = null;
              let high = false;
              if (meterB && meterB.t === "meter") {
                const raw = st.counters[meterB.counter] ?? 0;
                const ratio = Math.max(0, Math.min(1, raw / meterB.max));
                const shown = meterB.invert ? 1 - ratio : ratio;
                needle = -90 + shown * 180;
                high = shown >= 0.8;
              }

              // bars anchor at their left edge so the visual matches collision
              if (o.render.bar) {
                const barAnim = o.behaviors.find((b) => b.t === "animate");
                const barGlow = o.render.glow;
                return (
                  <div
                    key={o.id}
                    className={`eng-bar ${o.render.className ?? ""} ${
                      picking ? "pickable" : ""
                    } ${high ? "meter-high" : ""} ${
                      triggered ? "triggered" : ""
                    } ${flagClass} ${
                      barAnim && barAnim.t === "animate"
                        ? `anim-${barAnim.name}`
                        : ""
                    }`}
                    style={{
                      left: os.x,
                      top: os.y,
                      width: o.render.bar.width,
                      height: o.render.bar.height,
                      zIndex: o.z ?? 1,
                      transform:
                        [
                          o.render.upsideDown ? "scaleY(-1)" : "",
                          os.angle ? `rotate(${os.angle}deg)` : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined,
                      marginTop: -(o.render.liftY ?? 0),
                      ...(barAnim && barAnim.t === "animate"
                        ? ({
                            "--anim-period": `${barAnim.period}s`,
                          } as CSSProperties)
                        : null),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onObjectTap(o.id);
                    }}
                    title={picking ? t(o.nameKey) : undefined}
                  >
                    {barGlow && (
                      <div
                        className="eng-glow"
                        style={{
                          width: barGlow.radius,
                          height: barGlow.radius,
                          left: barGlow.offsetX,
                          top: barGlow.offsetY,
                        }}
                      />
                    )}
                    {needle !== null && (
                      <div
                        className="eng-needle"
                        style={{ transform: `rotate(${needle}deg)` }}
                      />
                    )}
                  </div>
                );
              }
              const anim = o.behaviors.find((b) => b.t === "animate");
              const isPlayer = o.kind === "player";
              const hurt = isPlayer && st.now < st.invulnUntil;
              const flagged = o.behaviors.find((b) => b.t === "flagged");
              const flagOn =
                flagged && flagged.t === "flagged"
                  ? st.flags[flagged.flag]
                  : false;
              const g = o.render.glow;
              return (
                <div
                  key={o.id}
                  className={`entity ${hurt ? "flash" : ""} ${
                    picking ? "pickable" : ""
                  } ${high ? "meter-high" : ""} ${
                    triggered ? "triggered" : ""
                  }`}
                  style={{ left: os.x, top: os.y, zIndex: o.z ?? 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onObjectTap(o.id);
                  }}
                  title={picking ? t(o.nameKey) : undefined}
                >
                  {g && (
                    <div
                      className="eng-glow"
                      style={{
                        width: g.radius,
                        height: g.radius,
                        left: g.offsetX,
                        top: g.offsetY,
                      }}
                    />
                  )}
                  {needle !== null && (
                    <div
                      className="eng-needle"
                      style={{ transform: `rotate(${needle}deg)` }}
                    />
                  )}
                  {o.render.timer &&
                    runtime.timerProgress(o.render.timer) !== null && (
                      <div className="eng-progress">
                        <i
                          style={{
                            width: `${Math.round(
                              (runtime.timerProgress(o.render.timer) ?? 0) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  {o.render.shadow && (
                    <div
                      className="shadow"
                      style={{
                        width: o.render.shadow.width,
                        marginLeft: -o.render.shadow.width / 2,
                        transform: `translateX(${o.render.shadow.offsetX}px)`,
                      }}
                    />
                  )}
                  <div
                    className={`sprite-emoji ${
                      anim && anim.t === "animate" ? `anim-${anim.name}` : ""
                    } ${o.render.className ?? ""} ${
                      flagged && flagged.t === "flagged" && flagOn
                        ? flagged.onClass
                        : ""
                    }`}
                    style={{
                      ...(o.render.sprite ? spriteStyle(o.render.sprite) : null),
                      ...(anim && anim.t === "animate"
                        ? ({ "--anim-period": `${anim.period}s` } as CSSProperties)
                        : null),
                      fontSize: o.render.fontSize,
                      bottom: o.render.liftY ?? 0,
                      transform: `scaleX(${os.facing}) scaleY(${
                        o.render.upsideDown ? -1 : 1
                      }) rotate(${os.angle}deg)`,
                    }}
                  >
                    {o.render.sprite ? null : o.render.emoji}
                  </div>
                  {isPlayer && st.now < st.attackUntil && (
                    <div className="sword">⚔️</div>
                  )}
                </div>
              );
            })}

          {/* popups */}
          {st.popups.map((p) => (
            <div key={p.id} className="popup" style={{ left: p.x, top: p.y }}>
              {p.text}
            </div>
          ))}

          {/* buttons */}
          {live.objects
            .filter((o) => o.kind === "button")
            .map((o) => (
              <button
                key={o.id}
                className={`engine-btn ${o.render.className ?? ""} ${
                  picking ? "pickable" : ""
                }`}
                style={{ left: o.x, top: o.y }}
                onPointerDown={picking ? undefined : () => onObjectTap(o.id)}
                onClick={
                  picking
                    ? (e) => {
                        e.stopPropagation();
                        onObjectTap(o.id);
                      }
                    : undefined
                }
                title={picking ? t(o.nameKey) : undefined}
              >
                {o.render.emoji} {t(o.render.labelKey ?? o.nameKey)}
              </button>
            ))}

          {!picking && hasPlayer && (
            <>
              <TouchControls
                keys={keysRef}
                mode={scene.sideView ? "lr" : "dpad"}
              />
              {scene.sideView && (
                <button
                  className="s3-jump-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    runtimeRef.current.jump();
                  }}
                >
                  ⤒
                </button>
              )}
            </>
          )}

          {picking && (
            <div className="picking-banner">
              {t("challenge.pickObject")}
              <button className="btn-ghost small" onClick={() => setPhase("play")}>
                {t("challenge.cancel")}
              </button>
            </div>
          )}
        </div>
      </FieldScaler>

      {phase === "intro" && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>🐛 {t(scene.introKey)}</h2>
            <p>{t("intro.hint")}</p>
            <p className="once-warning">{t("challenge.once")}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setPhase("play")}>
                {t("intro.go")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "dead" && (
        <div className="modal-backdrop">
          <div className="modal result fail">
            <div className="result-emoji">💀</div>
            <h2>{t("result.dead.title")}</h2>
            <p>{t("result.dead.body")}</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onExit}>
                {t("game.exit")}
              </button>
              <button className="btn-primary" onClick={nextRound}>
                {t("result.dead.retry")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "category" && pickedObject && (
        <CategorySelect
          targetObjectId={pickedObject}
          targetLabel={t(
            live.objects.find((o) => o.id === pickedObject)?.nameKey ?? ""
          )}
          onSubmit={onSubmitCategory}
          onCancel={() => setPhase("picking")}
        />
      )}

      {phase === "result" && (
        <ResultModal
          success={resultSuccess}
          bugText={
            resultSuccess
              ? tp(mutation.bug.descKey, {
                  ...mutation.bug.descParams,
                  obj: t(mutation.bug.descParams.obj),
                  counter: mutation.bug.descParams.counter
                    ? t(mutation.bug.descParams.counter)
                    : "",
                })
              : null
          }
          onRetry={nextRound}
          onDone={onClear}
        />
      )}
    </div>
  );
}
