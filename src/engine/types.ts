import type { BugCategory } from "../core/types";
import type { SpriteSpec } from "./sheets";

/* ---------- actions ---------- */

export type Action =
  | {
      a: "increment";
      counter: string;
      /** what actually gets added */
      by: number;
      /** what the floating popup claims was added (defaults to `by`) */
      popupBy?: number;
    }
  | { a: "heal"; counter: string; by: number }
  | { a: "attack"; range: number }
  /** fires the link whose `from` is this object */
  | { a: "trigger"; target: string }
  /** flips a boolean flag (light switch, valve) */
  | { a: "toggle"; flag: string }
  /** starts a timed process that runs `onDone` when it finishes */
  | { a: "startTimer"; timer: string }
  /** selects this object (shop item, card) */
  | { a: "select" }
  /** consumes the current selection */
  | { a: "commit"; timer?: string };

/* ---------- behaviors ---------- */

export type Behavior =
  /** 4-way keyboard/touch controlled actor */
  | { t: "playerTopDown"; speed: number; minY: number; maxY: number }
  /** back-and-forth patrol along one axis */
  | { t: "patrol"; axis: "x" | "y"; min: number; max: number; speed: number; flipSprite: boolean; endMode?: "turn" | "teleport" | "bounce" }
  /** one-way drift that wraps around the field */
  | { t: "drift"; axis: "x" | "y"; speed: number; wrapMin: number; wrapMax: number }
  /**
   * Looping sprite animation. `essential` marks animations whose absence is
   * obviously broken (a slime must squash to hop). Optional ones — a bat
   * gliding instead of flapping — read as intended behaviour, so they are not
   * fair targets for the freezeAnimation mutator.
   */
  | { t: "animate"; name: "hop" | "flicker" | "flap"; period: number; essential?: boolean }
  /** blocks the player */
  | { t: "blocker"; radius: number }
  /** hurts the player on contact */
  | { t: "damage"; counter: string; amount: number; radius: number }
  /** can be destroyed by an attack; respawns later */
  | {
      t: "killable";
      radius: number;
      respawn: number;
      onKill: Action[];
      /** set by the noHit mutator: the object shrugs off taps */
      ignoreTaps?: boolean;
    }
  /** consumed on touch */
  | { t: "pickup"; radius: number; respawn: number; onPickup: Action[]; popup?: string }
  /** responds to a tap; `action: null` means it looks pressable but does nothing */
  | { t: "clickable"; action: Action | Action[] | null }
  /** continuous rotation; dir -1 reverses it */
  | { t: "spin"; rpm: number; dir: 1 | -1 }
  /** figure-eight / sine flight path */
  | { t: "sineFly"; cx: number; cy: number; ampX: number; ampY: number; speed: number }
  /** side-view actor with gravity and jumping */
  | { t: "platformer"; speed: number; gravity: number; jumpV: number; fallScale: number }
  /** one-way platform the platformer lands on */
  | { t: "platform"; width: number }
  /** launches the platformer upward on contact */
  | { t: "jumpPad"; power: number }
  /** visual state driven by a flag (light on/off, water flowing) */
  | { t: "flagged"; flag: string; onClass: string; offClass?: string }
  /** needle/bar that reads a counter; `invert` makes it read backwards */
  | { t: "meter"; counter: string; max: number; invert: boolean }
  /** rises while a flag is set, falls otherwise */
  | { t: "pressure"; counter: string; flag: string; rise: number; fall: number };

/* ---------- objects ---------- */

export interface RenderSpec {
  /** pixel-art sprite; takes priority over emoji when both are set */
  sprite?: SpriteSpec;
  emoji?: string;
  fontSize?: number;
  /** ground shadow; offsetX sign encodes which side the light is on */
  shadow?: { offsetX: number; width: number };
  /** light halo, offset from the object's own position */
  glow?: { radius: number; offsetX: number; offsetY: number };
  /** lifts the sprite off the ground without moving its shadow */
  liftY?: number;
  /** extra CSS class for scene-specific looks */
  className?: string;
  /** i18n key for a button caption; falls back to the object name */
  labelKey?: string;
  /**
   * Draw as a sized bar instead of a sprite. Bars anchor at their LEFT edge,
   * the same convention platform collision uses, so what you see is what you
   * land on.
   */
  bar?: { width: number; height: number };
  /** rendered flipped vertically, used by the flipSprite mutator */
  upsideDown?: boolean;
  /** sprite has a visible up/down orientation — gates the flipSprite mutator */
  orientable?: boolean;
  /** sprite has a visible left/right facing — gates the reverseDirection mutator */
  directional?: boolean;
  /**
   * id of a timer whose progress is drawn as a bar over this object. Without
   * it a timed process is invisible: the player presses a button, nothing
   * happens for seconds, and a counter ticks up with no cause on screen.
   */
  timer?: string;
}

export interface ObjectSpec {
  id: string;
  nameKey: string;
  kind: "player" | "sprite" | "decor" | "button" | "hud";
  x: number;
  y: number;
  z?: number;
  render: RenderSpec;
  behaviors: Behavior[];
  /** objects sharing a peerGroup are visible comparison points for each other */
  peerGroup?: string;
  /** HUD widgets read this counter */
  counter?: string;
  /** id of an object this one visually overlaps — enables the zSwap mutator */
  overlaps?: string;
}

export interface CounterSpec {
  id: string;
  nameKey: string;
  initial: number;
  max?: number;
  /** rendered as hearts instead of a number */
  display: "number" | "hearts";
}

/** causal wiring: pressing `from` acts on `to` */
export interface LinkSpec {
  id: string;
  from: string;
  to: string;
  /** how long the effect lasts, in seconds */
  duration?: number;
}

export interface TimerSpec {
  id: string;
  duration: number;
  onDone: Action[];
}

export interface SceneSpec {
  id: string;
  nameKey: string;
  introKey: string;
  backgroundClass: string;
  objects: ObjectSpec[];
  counters: CounterSpec[];
  links?: LinkSpec[];
  timers?: TimerSpec[];
  flags?: string[];
  /**
   * The scene's single light source. Shadow-direction bugs are only fair when
   * the player can see where the light comes from, so mirrorShadow is limited
   * to scenes that declare one — a room lit from two sides has no right answer.
   */
  light?: { objectId: string; x: number };
  /** side-view scenes get gravity and a ground line */
  sideView?: { groundY: number };
}

/* ---------- generated bugs ---------- */

export interface GeneratedBug {
  id: string;
  /** any of these picks counts as correct */
  objectIds: string[];
  category: BugCategory;
  /** i18n template key, e.g. "bugdesc.noAction" */
  descKey: string;
  /** substituted into the template; `obj` is filled in automatically */
  descParams: Record<string, string>;
  subtlety: number;
}
