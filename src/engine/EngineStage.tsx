import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BugCategory } from "../core/types";
import type { Action, Facing, ObjectSpec, RenderSpec } from "./types";
import { judge } from "../core/judge";
import { useI18n } from "../i18n";
import { CategorySelect } from "../components/CategorySelect";
import { ResultModal } from "../components/ResultModal";
import { FieldScaler, FIELD_W, FIELD_H } from "../components/FieldScaler";
import { TouchControls } from "../components/TouchControls";
import { SHEETS } from "./sheets";
import { PlaytestBar } from "../components/PlaytestBar";
import {
  AlertIcon,
  BugIcon,
  MagnifierIcon,
  SkullIcon,
} from "../components/icons";
import { propStyle, spriteStyle } from "./spriteStyle";
import { sfx } from "../audio/sfx";
import type { SceneSpec } from "./types";
import { SceneRuntime, hitCentre } from "./runtime";
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

/**
 * The finger that is on the screen right now, if any.
 *
 * Walking into the kerb takes the player to the next room, and a room is a
 * whole new EngineStage — different scene, different key, so React throws this
 * component away and builds another. The finger is still down. Nothing sends a
 * pointerdown for a press that already happened, so the new field had no idea
 * it was being dragged: the player arrived, stopped dead, and had to lift their
 * thumb and put it back down to carry on walking.
 *
 * Module scope rather than a ref, because the two components never overlap in a
 * way a ref could be handed across. Cleared when the finger lifts.
 */
let carried: number | null = null;

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
  /**
   * The defect to plant, if it has already been decided. A build queued on a
   * machine is one build: the player can walk away from it and come back, and
   * it has to be the same fault waiting there. Left out, one is picked at
   * random and reported back through onBugPicked.
   */
  bugId?: string | null;
  onBugPicked?: (bugId: string) => void;
  /**
   * What a wrong report means. The stage grid lets the player try again with a
   * fresh defect, which is right for practice. A build on the office floor is
   * told "보고는 빌드당 한 번뿐이다" in its own briefing, so it passes this and
   * the report stands.
   */
  onFail?: () => void;
  /** fired when the player activates a station they are standing next to */
  onStation?: (objectId: string) => void;
  /**
   * Where the player was standing when this scene came down. A room the player
   * walks in and out of should still have them where they left off — stepping
   * away from a machine and back used to put them in the middle of the floor.
   */
  onPlayerRest?: (at: { x: number; y: number }) => void;
  onAction?: (
    objectId: string,
    ctx: {
      counters: Record<string, number>;
      objects: Record<string, { x: number; y: number }>;
      now: number;
    }
  ) => Action[] | null;
  /** the magnifier is owned, so the build offers a hold-to-zoom button */
  canZoom?: boolean;
  /**
   * The thing the room is currently waiting on, marked where it stands.
   *
   * The line at the top says what to do; a player who does not already know
   * this office still has to find the door it means. The mark rides in the
   * world layer, so it pans and zooms with the object rather than floating
   * over a room it has lost track of.
   */
  markId?: string | null;
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
  bugId,
  onBugPicked,
  onFail,
  onPlayerRest,
  onStation,
  canZoom = false,
  markId,
  header,
}: Props) {
  const observing = mode === "observe";
  const bare = mode !== "judge";
  const { t, tp } = useI18n();
  const [phase, setPhase] = useState<Phase>(
    // a build you have already opened does not read you its briefing again
    mode === "judge" && !bugId ? "intro" : "play"
  );
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
  }, [judging, scene, minBand, maxBand]);
  const [mutation, setMutation] = useState<Mutation | null>(() => {
    if (!mutations.length) return null;
    return mutations.find((m) => m.bug.id === bugId) ?? pickMutation(mutations);
  });
  // tell the caller which one it got, so the same build is waiting on the same
  // machine when the player comes back to it
  useEffect(() => {
    if (mutation && !bugId) onBugPicked?.(mutation.bug.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const stickOrigin = useRef<{ x: number; y: number } | null>(null);
  /**
   * A drag that was already under way when this room replaced the last one.
   *
   * Held apart from stickId on purpose. stickId being set is what stops a
   * second stick from starting, so putting a guess in there would block the
   * controls outright in the one case the guess is wrong — the finger having
   * lifted during the handover, which sends no event either component is
   * still around to hear. This only becomes a real stick when a move for
   * that same finger actually arrives.
   */
  const adopting = useRef<number | null>(null);
  useEffect(() => {
    adopting.current = carried;
    carried = null;
  }, []);
  /** the station the player is standing next to, for the space bar */
  const nearStationRef = useRef<{ id: string; labelKey: string } | null>(null);
  const onStationRef = useRef(onStation);
  onStationRef.current = onStation;
  const onPlayerRestRef = useRef(onPlayerRest);
  onPlayerRestRef.current = onPlayerRest;
  useEffect(
    () => () => {
      const at = runtimeRef.current.state.objects.player;
      if (at) onPlayerRestRef.current?.({ x: at.x, y: at.y });
    },
    []
  );
  /**
   * The two lines that only matter at the start: how to move, and what the
   * build is for. Both sit over the field, and the goal line was covering the
   * wall clock in the shop and the sun in the meadow — objects that carry
   * bugs, hidden behind the text telling you to go find bugs. They step aside
   * after a few seconds; the goal is repeated in the briefing that opens the
   * build, where nothing is behind it.
   */
  const [showControls, setShowControls] = useState(true);
  /** held while the magnifier button is pressed */
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => setShowControls(true), [scene]);
  useEffect(() => {
    // count from the moment play starts, not from mount: the briefing sits in
    // front of the field, and the seconds spent reading it are not seconds
    // spent looking at the two lines behind it
    if (phase !== "play") return;
    const id = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(id);
  }, [scene, phase]);

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
    /*
     * A press on a control is not a press on the ground.
     *
     * The buttons drawn over the field — the station prompt, the
     * magnifier, the jump key, the in-world machines — are children of it,
     * so their pointerdown arrives here as well and starts a drag the
     * player never asked for. A thumb on a button rolls further than the
     * six units of dead zone, which is enough to set the walk going; and
     * because touch capture belongs to the element that was pressed, a
     * button that goes away before the finger lifts takes the matching
     * pointerup with it. That is what pressing "buy a coffee" did: the
     * prompt opened, the phantom drag walked the player out of the
     * machine's radius, the prompt button unmounted, and the release never
     * arrived — leaving the stick pushed over and stickId set, which
     * refuses every press made afterwards.
     *
     * Only `kind: "button"` objects are buttons; ordinary props are divs,
     * so the ground a drag can start on is unchanged.
     */
    if ((e.target as Element | null)?.closest?.("button")) return;
    const p = fieldPoint(e);
    if (!p) return;
    adopting.current = null;
    stickId.current = e.pointerId;
    carried = e.pointerId;
    stickOrigin.current = p;
    setStick({ ox: p.x, oy: p.y, dx: 0, dy: 0 });
  };

  const stickMove = (e: React.PointerEvent) => {
    if (!isTouch(e)) return;
    if (stickId.current !== e.pointerId) {
      /*
       * The finger that walked us through the door is still down and still
       * moving. Take it over, from where it is now rather than from where it
       * started — the room it started in is gone, and so is the meaning of a
       * point in it.
       */
      if (adopting.current !== e.pointerId) return;
      const at = fieldPoint(e);
      if (!at) return;
      adopting.current = null;
      stickId.current = e.pointerId;
      carried = e.pointerId;
      stickOrigin.current = at;
      setStick({ ox: at.x, oy: at.y, dx: 0, dy: 0 });
      return;
    }
    const p = fieldPoint(e);
    const o = stickOrigin.current;
    if (!p || !o) return;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const len = Math.hypot(dx, dy);
    // a small dead zone, so tapping an object does not also nudge the player
    const k = len < 6 ? 0 : Math.min(1, len / STICK_R) / (len || 1);
    // outside the state updater: React treats updaters as pure and may run or
    // discard them freely, which quietly dropped the vector on its way to the
    // runtime and left the player standing still
    runtimeRef.current.stick = k ? { x: dx * k, y: dy * k } : null;
    const clamp = len > STICK_R ? STICK_R / len : 1;
    setStick({ ox: o.x, oy: o.y, dx: dx * clamp, dy: dy * clamp });
  };

  const releaseStick = useCallback(() => {
    carried = null;
    adopting.current = null;
    stickId.current = null;
    stickOrigin.current = null;
    runtimeRef.current.stick = null;
    setStick(null);
  }, []);

  const stickUp = (e: React.PointerEvent) => {
    if (!isTouch(e)) return;
    if (stickId.current !== e.pointerId) return;
    releaseStick();
  };

  /*
   * The release that does not depend on the press still being there.
   *
   * A stick that is never released is worse than a stuck walk: stickDown
   * refuses to start another one while stickId is set, so the controls are
   * dead for the rest of the run. The field's own pointerup is the ordinary
   * path and this is the floor under it — the window hears the finger lift
   * wherever it happens, including on a modal that opened over the field.
   */
  useEffect(() => {
    const end = (e: PointerEvent) => {
      if (stickId.current === e.pointerId) releaseStick();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [releaseStick]);

  /* keyboard */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
        e.preventDefault();
      // space is "use what you are standing next to". It used to swing the
      // attack, which meant the one key a player reaches for first did
      // nothing in the three rooms that are mostly walking up to things.
      if (e.key === " ") {
        const ns = nearStationRef.current;
        if (ns && onStationRef.current) {
          sfx.play("click");
          onStationRef.current(ns.id);
        }
        return;
      }
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
        if (phaseRef.current !== "play") return;
        if (sceneRef.current.sideView) {
          if (!e.repeat) runtimeRef.current.jump();
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
    const correct = judge(mutation.bug, pickedObject!, category).correct;
    sfx.play(correct ? "success" : "fail");
    setResultSuccess(correct);
    setPhase("result");
  };

  /**
   * Start a fresh round with a different bug. Used by a failed report in the
   * stage grid and by the playtest re-roll; the answer stays hidden either way.
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
   * Run the same build again from the top. Dying is not a wrong answer — the
   * defect under test is still the one that was planted — so the fault stays
   * put and only the run restarts.
   */
  const restartRound = () => {
    if (!mutation) return;
    runtimeRef.current.reset(applyMutation(scene, mutation));
    setPickedObject(null);
    setPhase("play");
  };

  /**
   * Draw the scene the runtime is actually simulating. The `scene` prop is the
   * clean original; render-level mutations only exist on this mutated copy.
   */
  /**
   * Whether the scene has a button that attacks. The hint used to promise one
   * in every top-down scene, which read as a missing control in the ones that
   * have nothing to attack.
   */
  const hasAttackButton = scene.objects.some((o) =>
    o.behaviors.some(
      (b) =>
        b.t === "clickable" &&
        b.action !== null &&
        (Array.isArray(b.action) ? b.action : [b.action]).some(
          (x) => x.a === "attack"
        )
    )
  );

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
    /*
     * The nearest one, not the first one listed.
     *
     * It returned whichever object came first in the scene, which is the same
     * answer as long as no two stations reach the same floor. Put four desks
     * along a wall three hundred and sixty wide and they do, and then walking
     * up to the fourth machine opens the first.
     */
    let best: { id: string; labelKey: string; d: number } | null = null;
    for (const o of live.objects) {
      const b = o.behaviors.find((x) => x.t === "station");
      if (!b || b.t !== "station" || b.auto) continue;
      const c = hitCentre(o, runtime.state.objects[o.id]);
      const d = Math.hypot(c.x - ps.x, c.y - ps.y);
      if (d <= b.radius && (!best || d < best.d)) {
        best = { id: o.id, labelKey: b.labelKey, d };
      }
    }
    if (best) return { id: best.id, labelKey: best.labelKey };
    return null;
  })();
  nearStationRef.current = nearStation;

  /**
   * The way out that is taken by walking into it.
   *
   * Read during the frame and acted on after it, so the scene it belongs to is
   * never torn down in the middle of being drawn.
   */
  const autoStation = (() => {
    if (!onStation) return null;
    const p = live.objects.find((o) => o.kind === "player");
    if (!p) return null;
    const ps = runtime.state.objects[p.id];
    for (const o of live.objects) {
      const b = o.behaviors.find((x) => x.t === "station");
      if (!b || b.t !== "station" || !b.auto) continue;
      const c = hitCentre(o, runtime.state.objects[o.id]);
      if (Math.hypot(c.x - ps.x, c.y - ps.y) <= b.radius) return o.id;
    }
    return null;
  })();
  useEffect(() => {
    if (autoStation) onStationRef.current?.(autoStation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStation]);

  const st = runtime.state;

  /** the row for a facing, falling back to a cardinal the sheet does have */
  /**
   * How far the art rises above the point the object sits at.
   *
   * Sprites and characters hang from their bottom edge, so their top is that
   * much higher; bars are drawn downward from theirs, so their top is where
   * they are. It is what a bubble has to clear to sit over somebody's head
   * rather than across their face.
   */
  const artTop = (o: ObjectSpec) => {
    const r = o.render;
    if (r.bar) return 0;
    if (r.actor) return SHEETS[r.actor.sheet].tile * r.actor.scale;
    if (r.sprite) {
      return (
        SHEETS[r.sprite.sheet].tile * (r.sprite.spanY ?? 1) * (r.sprite.scale ?? 3)
      );
    }
    return 24;
  };

  /**
   * Which layer a drawn object belongs on.
   *
   * In a y-sorted scene, where something stands decides what it covers: a
   * sprite hangs from its own feet, so its foot line is the sort key, and
   * `z` becomes the tie-break for two things standing on the same line. The
   * hundred keeps the crowd above the flat scenery underneath it.
   *
   * Two things stay out of it. Bars are the flat scenery — roads, kerbs,
   * floors, the wall a window is cut into — and so is anything given `z: 0`,
   * which is how a scene says "this is the room, not something in it": a
   * wall's foot is at the bottom of the wall, so sorting it would hang it in
   * front of everything standing against it, monitors included.
   *
   * A bar that is a thing rather than the room says so by giving its own
   * `sortY` — the vending machine on the pavement and the form on the office
   * wall are drawn as bars and are stood behind like anything else.
   */
  const layerOf = (o: ObjectSpec, y: number) =>
    scene.ySort &&
    (o.sortY !== undefined || (!o.render.bar && (o.z ?? 1) > 0))
      ? 100 + Math.round(o.sortY ?? y) + (o.z ?? 0)
      : o.z ?? 1;

  const actorRow = (a: NonNullable<RenderSpec["actor"]>, dir: Facing) => {
    const FALLBACK: Record<Facing, Facing> = {
      down: "down",
      up: "up",
      left: "left",
      right: "right",
      downRight: "right",
      upRight: "right",
      downLeft: "left",
      upLeft: "left",
    };
    return a.rows[dir] ?? a.rows[FALLBACK[dir]] ?? a.rows.down;
  };
  // drag-to-move, for top-down scenes only: side view needs a jump button and
  // reads better with left/right keys
  const stickable = hasPlayer && !picking && !scene.sideView;

  // camera: centred on the player, clamped so the room never shows past its
  // own edges. Scenes without a world are exactly the viewport, so it is 0,0.
  const world = live.world ?? { w: FIELD_W, h: FIELD_H };
  // The magnifier scales the world layer and keeps the point of interest
  // centred, clamped so the view never runs past the room. At zoom 1 this is
  // the plain camera the larger scenes already used.
  const zoomLevel = zoomed ? 2 : 1;
  const cam = (() => {
    const p = live.objects.find((o) => o.kind === "player");
    if (!p || (!live.world && !zoomed)) return { x: 0, y: 0 };
    const ps = p ? st.objects[p.id] : { x: world.w / 2, y: world.h / 2 };
    const viewW = FIELD_W / zoomLevel;
    const viewH = FIELD_H / zoomLevel;
    return {
      x: Math.max(0, Math.min(world.w - viewW, ps.x - viewW / 2)),
      y: Math.max(0, Math.min(world.h - viewH, ps.y - viewH / 2)),
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
              <div className="tutorial-hint">⬆ {t("challenge.tutorial")}</div>
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
              <AlertIcon size={13} /> {t("challenge.button")}
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
          <div className="scene-top">
          {hasPlayer && showControls && !picking && !bare && (
            <div className="control-hint">
              {t(
                scene.sideView
                  ? "hint.sideView"
                  : matchMedia("(pointer: coarse)").matches
                    ? "hint.drag"
                    : hasAttackButton
                      ? "hint.keysAttack"
                      : "hint.keys"
              )}
            </div>
          )}
          {live.goalKey && !picking && showControls && (
            <div className="goal-banner">{t(live.goalKey)}</div>
          )}
          </div>
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
                      : // a max is shown only where one really binds — the basket stops
                        // accepting at eight, and hiding that would make a full basket
                        // look like a button that had stopped working
                        `${t(spec?.nameKey ?? o.nameKey)}: ${value}${
                          spec?.max !== undefined ? ` / ${spec.max}` : ""
                        }`}
                  </div>
                );
              })}
          </div>

          <div
            className={`world-layer ${live.backgroundClass}`}
            style={{
              width: world.w,
              height: world.h,
              transform: `scale(${zoomLevel}) translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
              transformOrigin: "0 0",
            }}
          >
          {(() => {
            if (!markId) return null;
            const target = live.objects.find((o) => o.id === markId);
            const ts = target && st.objects[target.id];
            if (!target || !ts) return null;
            const c = hitCentre(target, ts);
            const lift = target.render.bar
              ? target.render.bar.height / 2
              : (target.render.sprite
                  ? SHEETS[target.render.sprite.sheet].tile *
                    (target.render.sprite.scale ?? 3) * 0.5
                  : 24);
            return (
              <svg
                className="waypoint"
                viewBox="0 0 9 6"
                style={{ left: c.x, top: c.y - lift - 18, zIndex: 900 }}
                aria-hidden
              >
                {/*
                  Drawn on the same grid as everything else: nine pixels across,
                  a one-pixel outline the weight of the tile art's own, a lighter
                  row along the top where the light is. Four sheets were scanned
                  for a marker first and none of them has one — the shapes that
                  came back narrowing to a point were a pillar, a potion and a
                  key.
                */}
                <path
                  className="wp-line"
                  d="M0 0h9v1H0zM0 1h1v1H0zM8 1h1v1H8zM1 2h1v1H1zM7 2h1v1H7zM2 3h1v1H2zM6 3h1v1H6zM3 4h1v1H3zM5 4h1v1H5zM4 5h1v1H4z"
                />
                <path className="wp-fill" d="M1 1h7v1H1zM2 2h5v1H2zM3 3h3v1H3zM4 4h1v1H4z" />
                <path className="wp-top" d="M1 1h7v1H1z" />
              </svg>
            );
          })()}

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
                  } ${o.render.className ?? ""}`}
                  style={{ left: os.x, top: os.y, zIndex: layerOf(o, os.y) }}
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
                            row: actorRow(o.render.actor, os.dir4),
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
                        o.render.actor
                          ? 1
                          : os.facing * (o.render.facesLeft ? -1 : 1)
                      }) scaleY(${
                        o.render.upsideDown ? -1 : 1
                      }) rotate(${os.angle}deg)`,
                    }}
                  >
                    {o.render.sprite ? null : o.render.emoji}
                  </div>
                  {isPlayer && st.now < st.attackUntil && (
                    <div className="sword" />
                  )}
                </div>
              );
            })}

          {/*
            What people are saying to nobody.
            
            A layer of its own, after every object: a bubble inside the
            speaker's own element is inside their stacking context, so the
            developer's monitor — drawn later, and higher — was printing across
            the middle of what they said. It still rides in the world layer, so
            it pans and zooms with whoever said it.
          */}
          {live.objects.map((o) => {
            const os = st.objects[o.id];
            if (!os?.says) return null;
            return (
              <div
                key={`${o.id}-says`}
                className="eng-bubble"
                style={{ left: os.x, top: os.y - artTop(o) }}
              >
                {t(os.says)}
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
                /*
                 * On the press being finished, not on it starting.
                 *
                 * Acting on pointerdown looks faster and costs the whole
                 * interaction on a phone: what this opens is a prompt over the
                 * field, and the click the same tap goes on to produce is
                 * hit-tested against the screen as it is *then* — which is the
                 * prompt's backdrop, whose job is to close it. One tap opened
                 * and shut it in the same gesture. Holding the finger down
                 * worked, because Android suppresses that click after a long
                 * press, which is how this was reported: "it only opens if I
                 * press and hold".
                 */
                onClick={(e) => {
                  e.stopPropagation();
                  onObjectTap(o.id);
                }}
                title={picking ? t(o.nameKey) : undefined}
              >
                {o.render.emoji} {t(o.render.labelKey ?? o.nameKey)}
              </button>
            ))}
          </div>


          {canZoom && !picking && (
            <button
              className={`eng-zoom-btn ${zoomed ? "on" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                setZoomed(true);
              }}
              onPointerUp={() => setZoomed(false)}
              onPointerLeave={() => setZoomed(false)}
              onPointerCancel={() => setZoomed(false)}
              title={t("item.magnifier")}
            >
              <MagnifierIcon size={16} />
            </button>
          )}

          {nearStation && (
            <button
              className="eng-station-btn"
              /* on click, not pointerdown — see the object buttons above:
                 what this opens is a prompt, and the click that the same tap
                 produces afterwards lands on that prompt's backdrop */
              onClick={() => {
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
            <h2>
              <BugIcon size={16} /> {t(scene.introKey ?? scene.nameKey)}
            </h2>
            {scene.goalKey && (
              <p className="intro-goal">{t(scene.goalKey)}</p>
            )}
            <p>{t("intro.hint")}</p>
            <p className="once-warning">{t("challenge.once")}</p>
            <div className="modal-actions">
              <button data-space className="btn-primary" onClick={() => setPhase("play")}>
                {t("intro.go")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "dead" && (
        <div className="modal-backdrop">
          <div className="modal result fail">
            <div className="result-emoji"><SkullIcon /></div>
            <h2>{t("result.dead.title")}</h2>
            <p>{t("result.dead.body")}</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onExit}>
                {t("game.exit")}
              </button>
              <button data-space className="btn-primary" onClick={restartRound}>
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
          onRetry={onFail ?? nextRound}
          final={!!onFail}
          onDone={onClear}
        />
      )}
    </div>
  );
}
