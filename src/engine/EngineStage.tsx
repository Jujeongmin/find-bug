import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BugCategory } from "../core/types";
import type { Action } from "./types";
import { useI18n } from "../i18n";
import { CategorySelect } from "../components/CategorySelect";
import { ResultModal } from "../components/ResultModal";
import { FieldScaler, FIELD_W, FIELD_H } from "../components/FieldScaler";
import { TouchControls } from "../components/TouchControls";
import { PlaytestBar } from "../components/PlaytestBar";
import { propStyle, spriteStyle } from "./spriteStyle";
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
  /**
   * "observe" drops the judging flow and routes every tap to onObserve — the
   * player is measuring the world, not accusing it. "play" also drops the
   * judging chrome but leaves taps working normally, which is what the repro
   * lab needs: the scene has to be playable for a fault to be reproduced.
   */
  mode?: "judge" | "observe" | "play";
  onObserve?: (objectId: string) => void;
  /**
   * Intercepts a tap before the object's own actions run. Returning actions
   * runs those instead, which is how the repro lab makes a defect fire only
   * under its trigger conditions; returning null falls through to normal play.
   */
  /** fired when the player activates a station they are standing next to */
  onStation?: (objectId: string) => void;
  onAction?: (
    objectId: string,
    ctx: {
      counters: Record<string, number>;
      objects: Record<string, { x: number; y: number }>;
      now: number;
    }
  ) => Action[] | null;
  /** replaces the stage header in observe mode */
  header?: ReactNode;
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
  mode = "judge",
  onObserve,
  onAction,
  onStation,
  header,
}: Props) {
  const observing = mode === "observe";
  const bare = mode !== "judge";
  const { t, tp } = useI18n();
  const [phase, setPhase] = useState<Phase>(mode === "judge" ? "intro" : "play");
  const [, setFrame] = useState(0);
  const [pickedObject, setPickedObject] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [showHint, setShowHint] = useState(
    () => tutorial && !localStorage.getItem("fb_seen_tutorial")
  );

  // Only the judging flow plants a defect. The office is driven through the
  // same component, and it has no fair bug candidates at all, so generating a
  // pool there produced an empty list and picked undefined out of it.
  const judging = mode === "judge";
  const mutations = useMemo(() => {
    if (!judging) return [];
    const banded = poolFor(scene, minBand, maxBand);
    // never leave a stage with nothing to show
    return banded.length >= 1 ? banded : generateMutations(scene);
  }, [scene, minBand, maxBand]);
  const [mutation, setMutation] = useState<Mutation | null>(() =>
    mutations.length ? pickMutation(mutations) : null
  );

  const runtimeRef = useRef<SceneRuntime>(
    new SceneRuntime(mutation ? applyMutation(scene, mutation) : scene)
  );
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const sceneRef = useRef<SceneSpec>(scene);
  sceneRef.current = scene;

  const runtime = runtimeRef.current;
  const picking = phase === "picking";
  // in observe mode every object is tappable, the same affordance picking uses
  // the pickable outline belongs to the report step. Observe mode wants it too,
  // since tapping is how you measure there — but ordinary play does not, and it
  // was outlining every prop the cursor passed over.
  const tappable = picking || observing;
  /** TouchControls writes into the same key set the keyboard uses */
  const keysRef = useRef(runtime.keys);
  const fieldRef = useRef<HTMLDivElement>(null);
  /** where the finger went down and how far it has been dragged, in field units */
  const [stick, setStick] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(
    null
  );
  const stickId = useRef<number | null>(null);

  /** drag distance, in field units, that means "full speed" */
  const STICK_R = 46;

  const fieldPoint = (e: { clientX: number; clientY: number }) => {
    const el = fieldRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const k = r.width / FIELD_W;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };

  /**
   * Drag-to-move is a touch control. On a desktop the arrow keys already move
   * the player, and dragging the mouse to walk fights with clicking things.
   */
  const isTouch = (e: React.PointerEvent) => e.pointerType !== "mouse";

  const stickDown = (e: React.PointerEvent) => {
    if (!isTouch(e)) return;
    if (stickId.current !== null) return;
    const p = fieldPoint(e);
    if (!p) return;
    stickId.current = e.pointerId;
    setStick({ ox: p.x, oy: p.y, dx: 0, dy: 0 });
  };

  const stickMove = (e: React.PointerEvent) => {
    if (!isTouch(e)) return;
    if (stickId.current !== e.pointerId) return;
    const p = fieldPoint(e);
    setStick((s) => {
      if (!s || !p) return s;
      const dx = p.x - s.ox;
      const dy = p.y - s.oy;
      const len = Math.hypot(dx, dy);
      // a small dead zone, so tapping an object does not also nudge the player
      const k = len < 6 ? 0 : Math.min(1, len / STICK_R) / (len || 1);
      runtimeRef.current.stick = k ? { x: dx * k, y: dy * k } : null;
      const clamp = len > STICK_R ? STICK_R / len : 1;
      return { ...s, dx: dx * clamp, dy: dy * clamp };
    });
  };

  const stickUp = (e: React.PointerEvent) => {
    if (!isTouch(e)) return;
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    runtimeRef.current.stick = null;
    setStick(null);
  };

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
      if (observing) {
        sfx.play("pick");
        onObserve?.(objectId);
        return;
      }
      if (picking) {
        sfx.play("pick");
        setPickedObject(objectId);
        setPhase("category");
        return;
      }
      const rt = runtimeRef.current;
      if (onAction) {
        const o = rt.scene.objects.find((x) => x.id === objectId);
        const os = rt.state.objects[objectId];
        const acts = onAction(objectId, {
          counters: rt.state.counters,
          objects: rt.state.objects,
          now: rt.state.now,
        });
        if (acts && o) {
          sfx.play("click");
          rt.runActions(acts, { x: os?.x ?? o.x, y: os?.y ?? o.y });
          return;
        }
      }
      sfx.play("click");
      rt.click(objectId);
    },
    [picking, observing, onObserve, onAction]
  );

  const onSubmitCategory = (category: BugCategory) => {
    if (!mutation) return;
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
    if (!mutation) return;
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
  // the one station the player is standing next to, if any
  const nearStation = (() => {
    if (!onStation) return null;
    const p = live.objects.find((o) => o.kind === "player");
    if (!p) return null;
    const ps = runtime.state.objects[p.id];
    for (const o of live.objects) {
      const b = o.behaviors.find((x) => x.t === "station");
      if (!b || b.t !== "station") continue;
      const os = runtime.state.objects[o.id];
      if (Math.hypot(os.x - ps.x, os.y - ps.y) <= b.radius) {
        return { id: o.id, labelKey: b.labelKey };
      }
    }
    return null;
  })();
  const st = runtime.state;
  // drag-to-move, for top-down scenes only: side view needs a jump button and
  // reads better with left/right keys
  const stickable = hasPlayer && !picking && !scene.sideView;

  // camera: centred on the player, clamped so the room never shows past its
  // own edges. Scenes without a world are exactly the viewport, so it is 0,0.
  const world = live.world ?? { w: FIELD_W, h: FIELD_H };
  const cam = (() => {
    const p = live.objects.find((o) => o.kind === "player");
    if (!p || !live.world) return { x: 0, y: 0 };
    const ps = st.objects[p.id];
    return {
      x: Math.max(0, Math.min(world.w - FIELD_W, ps.x - FIELD_W / 2)),
      y: Math.max(0, Math.min(world.h - FIELD_H, ps.y - FIELD_H / 2)),
    };
  })();

  return (
    <div className="stage-frame">
      {bare ? (
        header
      ) : (
        <>
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
  
        {playtest && mutation && (
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
  
  
        </>
      )}
      <FieldScaler>
        <div
          ref={fieldRef}
          className={`field ${tappable ? "picking" : ""}`}
          onPointerDown={stickable ? stickDown : undefined}
          onPointerMove={stickable ? stickMove : undefined}
          onPointerUp={stickable ? stickUp : undefined}
          onPointerCancel={stickable ? stickUp : undefined}
          style={{ width: FIELD_W, height: FIELD_H }}
        >
          {live.goalKey && !picking && (
            <div className="goal-banner">{t(live.goalKey)}</div>
          )}
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
                    } ${tappable ? "pickable" : ""}`}
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

          <div
            className={`world-layer ${live.backgroundClass}`}
            style={{
              width: world.w,
              height: world.h,
              transform: `translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
            }}
          >
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
                      tappable ? "pickable" : ""
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
                    tappable ? "pickable" : ""
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
                        transform: `translate(${o.render.shadow.offsetX}px, ${
                          o.render.shadow.offsetY ?? 0
                        }px)`,
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
                      ...(o.render.actor
                        ? spriteStyle({
                            sheet: o.render.actor.sheet,
                            row: o.render.actor.rows[os.dir4],
                            col: os.moving
                              ? o.render.actor.walk[
                                  Math.floor(st.now * o.render.actor.fps) %
                                    o.render.actor.walk.length
                                ]
                              : o.render.actor.idle,
                            scale: o.render.actor.scale,
                          })
                        : o.render.prop
                          ? propStyle(o.render.prop)
                          : o.render.sprite
                            ? spriteStyle(o.render.sprite)
                            : null),
                      ...(anim && anim.t === "animate"
                        ? ({ "--anim-period": `${anim.period}s` } as CSSProperties)
                        : null),
                      fontSize: o.render.fontSize,
                      bottom: o.render.liftY ?? 0,
                      transform: `scaleX(${
                        o.render.actor ? 1 : os.facing
                      }) scaleY(${
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
                  tappable ? "pickable" : ""
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
          </div>


          {nearStation && (
            <button
              className="eng-station-btn"
              onPointerDown={() => {
                sfx.play("click");
                onStation?.(nearStation.id);
              }}
            >
              {t(nearStation.labelKey)}
            </button>
          )}
          {!picking && hasPlayer && (
            <>
              {scene.sideView && <TouchControls keys={keysRef} mode="lr" />}
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

          {stick && (
            <div
              className="stick-base"
              style={{ left: stick.ox, top: stick.oy }}
            >
              <div
                className="stick-knob"
                style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }}
              />
            </div>
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

      {phase === "intro" && !bare && (
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

      {phase === "result" && mutation && (
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
