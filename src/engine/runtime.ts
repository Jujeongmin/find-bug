import type { Action, Facing, ObjectSpec, SceneSpec } from "./types";

export interface ObjectState {
  id: string;
  x: number;
  y: number;
  /** vertical velocity, side-view scenes only */
  vy: number;
  facing: 1 | -1;
  /** which way the object is pointed, for directional sheets */
  dir4: Facing;
  /** true while it actually travelled this frame */
  moving: boolean;
  dir: 1 | -1;
  alive: boolean;
  respawnAt: number;
  /** accumulated rotation in degrees */
  angle: number;
  /** where a wanderer is currently headed, and when it may set off again */
  goal?: { x: number; y: number };
  waitUntil?: number;
  /** what it is saying to nobody, and until when */
  says?: string;
  saysUntil?: number;
  nextSayAt?: number;
}

export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  bornAt: number;
}

export interface RuntimeState {
  now: number;
  objects: Record<string, ObjectState>;
  counters: Record<string, number>;
  flags: Record<string, boolean>;
  /** link id -> time it was fired (drives door-open windows) */
  firedAt: Record<string, number>;
  /** timer id -> time it started, or null when idle */
  timerStart: Record<string, number | null>;
  /** how many times each timer has completed */
  timerRuns: Record<string, number>;
  selected: string | null;
  popups: Popup[];
  invulnUntil: number;
  attackUntil: number;
  grounded: boolean;
  /** set once a health counter reaches zero — the run is over */
  dead: boolean;
}

/**
 * Eight facings, one per 45 degrees, so walking diagonally shows the diagonal
 * art rather than snapping to a cardinal.
 */
const OCTANTS: Facing[] = [
  "right",
  "downRight",
  "down",
  "downLeft",
  "left",
  "upLeft",
  "up",
  "upRight",
];

export const octant = (dx: number, dy: number): Facing =>
  OCTANTS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];

const ATTACK_ANIM = 0.25;
const INVULN = 1.2;

/**
 * Where an object actually sits, for collision and for standing next to it.
 *
 * Sprites are drawn from their bottom centre, so their position is already the
 * middle of their footprint. Bars are drawn from their top-left corner, so
 * taking their position as a centre put the circle up and to the left of the
 * thing on screen — an invisible wall above the supply form, and a machine you
 * could activate from empty floor beside it.
 */
/** is this point inside what the blocker covers? */
export function insideBlocker(
  b: { radius: number; box?: { w: number; h: number; dx?: number; dy?: number } },
  centre: { x: number; y: number },
  x: number,
  y: number
): boolean {
  if (b.box) {
    const cx = centre.x + (b.box.dx ?? 0);
    const cy = centre.y + (b.box.dy ?? 0);
    return Math.abs(x - cx) < b.box.w / 2 && Math.abs(y - cy) < b.box.h / 2;
  }
  return Math.hypot(x - centre.x, y - centre.y) < b.radius;
}

/**
 * How much room a person takes up, for anything else that is walking.
 *
 * Smaller than the sixteen a passer-by blocks with, on purpose: two people
 * edging past each other on a pavement should brush, not bounce, and the
 * point of this is only that nobody ends up standing in the same place.
 */
const BODY_RADIUS = 13;

export function hitCentre(
  o: ObjectSpec,
  s: { x: number; y: number }
): { x: number; y: number } {
  const bar = o.render.bar;
  return bar ? { x: s.x + bar.width / 2, y: s.y + bar.height / 2 } : s;
}

export class SceneRuntime {
  scene: SceneSpec;
  state: RuntimeState;
  keys = new Set<string>();
  /**
   * Analogue movement from the touch stick, -1..1 on each axis. It takes
   * precedence over the keys when set, so a finger and a keyboard never fight.
   */
  stick: { x: number; y: number } | null = null;
  private popupSeq = 0;

  constructor(scene: SceneSpec) {
    this.scene = scene;
    this.state = this.initState();
  }

  private initState(): RuntimeState {
    const objects: Record<string, ObjectState> = {};
    for (const o of this.scene.objects) {
      objects[o.id] = {
        id: o.id,
        x: o.x,
        y: o.y,
        vy: 0,
        facing: 1,
        dir4: o.facing ?? "down",
        moving: false,
        dir: 1,
        alive: true,
        respawnAt: 0,
        angle: 0,
      };
    }
    const counters: Record<string, number> = {};
    for (const c of this.scene.counters) counters[c.id] = c.initial;
    const flags: Record<string, boolean> = {};
    for (const f of this.scene.flags ?? []) flags[f] = false;
    const firedAt: Record<string, number> = {};
    for (const l of this.scene.links ?? []) firedAt[l.id] = -999;
    const timerStart: Record<string, number | null> = {};
    const timerRuns: Record<string, number> = {};
    for (const tm of this.scene.timers ?? []) {
      timerStart[tm.id] = null;
      timerRuns[tm.id] = 0;
    }
    return {
      now: 0,
      objects,
      counters,
      flags,
      firedAt,
      timerStart,
      timerRuns,
      selected: null,
      popups: [],
      invulnUntil: 0,
      attackUntil: 0,
      grounded: true,
      dead: false,
    };
  }

  /** true while the link fired from `objectId` is still in effect */
  isTriggered(targetId: string): boolean {
    for (const l of this.scene.links ?? []) {
      if (l.to !== targetId) continue;
      const t = this.state.firedAt[l.id];
      if (this.state.now - t < (l.duration ?? 3)) return true;
    }
    return false;
  }

  timerProgress(timerId: string): number | null {
    const start = this.state.timerStart[timerId];
    if (start === null || start === undefined) return null;
    const spec = this.scene.timers?.find((t) => t.id === timerId);
    if (!spec) return null;
    return Math.min(1, (this.state.now - start) / spec.duration);
  }

  reset(scene: SceneSpec) {
    this.scene = scene;
    this.state = this.initState();
  }

  private player(): ObjectSpec | undefined {
    return this.scene.objects.find((o) => o.kind === "player");
  }

  /**
   * Is this point inside something solid?
   *
   * `self` is skipped, because everything that walks about is also something
   * to walk around, and an object standing inside its own blocker would never
   * take a step.
   */
  blockedAt(x: number, y: number, self?: string): boolean {
    for (const other of this.scene.objects) {
      if (other.id === self) continue;
      const bl = other.behaviors.find((b) => b.t === "blocker");
      if (!bl || bl.t !== "blocker") continue;
      const c = hitCentre(other, this.state.objects[other.id]);
      if (insideBlocker(bl, c, x, y)) return true;
    }
    return false;
  }

  /**
   * Would this step put a walker on top of the player?
   *
   * The player is the one thing that walks about and is not a blocker, which
   * for a long time only meant that people could be walked through. It also
   * meant they could be walked *onto*: a passer-by is a blocker as well as a
   * wanderer, and the wandering half stepped onto the player's own square with
   * nothing to say it should not. From inside a circle there is no way out
   * that the movement code recognises — the diagonal, each axis alone, and the
   * tangent past the edge are all still inside — so the player stood there
   * until the passer chose to walk off, which it does after pausing for up to
   * four and a half seconds.
   *
   * Making the player a blocker outright would be wrong: the whole street is
   * y-sorted around them and a station's radius is measured from where they
   * stand. What is needed is only this — the room a person takes up, for the
   * benefit of anything else that is walking.
   */
  stepsOntoPlayer(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    self?: string
  ): boolean {
    const p = this.player();
    if (!p || p.id === self) return false;
    const ps = this.state.objects[p.id];
    if (!ps) return false;
    const c = hitCentre(p, ps);
    const to = Math.hypot(toX - c.x, toY - c.y);
    if (to >= BODY_RADIUS) return false;
    // Already overlapping — a scene can open that way, and a walker with no
    // way out of it is a walker rooted to the spot. A step that puts daylight
    // between the two of them is the opposite of a collision, so it is taken.
    return to <= Math.hypot(fromX - c.x, fromY - c.y);
  }

  /**
   * Somewhere in the box worth walking to.
   *
   * A spot inside a wall is a walk that ends the moment it starts, so a few
   * are tried before one is taken; the last one is used either way, because a
   * person who cannot think of anywhere to go still has to stand somewhere.
   */
  private somewhereIn(b: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }, self?: string): { x: number; y: number } {
    let spot = { x: 0, y: 0 };
    for (let i = 0; i < 8; i++) {
      spot = {
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
      };
      if (!this.blockedAt(spot.x, spot.y, self)) return spot;
    }
    return spot;
  }

  /**
   * A floating number over the spot something happened.
   *
   * One tap can run several actions — knocking a target down pays score and
   * counts a hit — and their popups landed on the same pixel and printed over
   * each other. Anything spawned at the same place in the same instant is
   * stacked upward instead.
   */
  private addPopup(x: number, y: number, text: string) {
    const STACK = 15;
    let dy = 0;
    for (const p of this.state.popups) {
      if (p.bornAt !== this.state.now) continue;
      if (Math.abs(p.x - x) > 24) continue;
      dy = Math.min(dy, p.y - y - STACK);
    }
    this.state.popups.push({
      id: this.popupSeq++,
      x,
      y: y + dy,
      text,
      bornAt: this.state.now,
    });
  }

  runActions(actions: Action[], at: { x: number; y: number }) {
    for (const a of actions) {
      switch (a.a) {
        case "increment": {
          const cur = this.state.counters[a.counter] ?? 0;
          const spec = this.scene.counters.find((c) => c.id === a.counter);
          const next = spec?.max !== undefined ? Math.min(spec.max, cur + a.by) : cur + a.by;
          this.state.counters[a.counter] = next;
          if (!a.quiet) {
            const shown = a.popupBy ?? a.by;
            this.addPopup(at.x, at.y - 26, shown >= 0 ? `+${shown}` : `${shown}`);
          }
          break;
        }
        case "heal": {
          const spec = this.scene.counters.find((c) => c.id === a.counter);
          const cur = this.state.counters[a.counter] ?? 0;
          const cap = spec?.max ?? Infinity;
          this.state.counters[a.counter] = Math.min(cap, cur + a.by);
          // a text heart, not the emoji: the popup sits over pixel art and the
          // platform picture arrives glossy, rounded and the wrong red
          this.addPopup(at.x, at.y - 26, `♥+${a.by}`);
          break;
        }
        case "attack":
          this.doAttack(a.range);
          break;
        case "trigger": {
          // fire whichever link starts at this object
          for (const l of this.scene.links ?? []) {
            if (l.from === a.target) this.state.firedAt[l.id] = this.state.now;
          }
          break;
        }
        case "toggle":
          this.state.flags[a.flag] = !this.state.flags[a.flag];
          break;
        case "startTimer": {
          const req = a.requires;
          if (req && (this.state.counters[req.counter] ?? 0) < req.min) break;
          if (this.state.timerStart[a.timer] == null) {
            this.state.timerStart[a.timer] = this.state.now;
          }
          break;
        }
        case "select":
          break;
        case "commit":
          this.state.selected = null;
          break;
      }
    }
  }

  doAttack(range: number) {
    const p = this.player();
    if (!p) return;
    const ps = this.state.objects[p.id];
    this.state.attackUntil = this.state.now + ATTACK_ANIM;
    for (const o of this.scene.objects) {
      const k = o.behaviors.find((b) => b.t === "killable");
      if (!k || k.t !== "killable") continue;
      const os = this.state.objects[o.id];
      if (!os.alive) continue;
      if (Math.hypot(os.x - ps.x, os.y - ps.y) < range) {
        os.alive = false;
        os.respawnAt = this.state.now + k.respawn;
        this.runActions(k.onKill, { x: os.x, y: os.y });
      }
    }
  }

  /** invoked when the player taps an object with a `clickable` behavior */
  click(objectId: string) {
    const o = this.scene.objects.find((x) => x.id === objectId);
    if (!o) return;

    // a killable object can also be knocked down by tapping it, not only by an
    // attack — that is what makes a shooting-gallery target work
    const k = o.behaviors.find((b) => b.t === "killable");
    if (k && k.t === "killable" && k.tappable) {
      if (k.ignoreTaps) return;
      const os = this.state.objects[o.id];
      if (!os.alive) return;
      os.alive = false;
      os.respawnAt = this.state.now + k.respawn;
      this.runActions(k.onKill, { x: os.x, y: os.y });
      return;
    }

    const c = o.behaviors.find((b) => b.t === "clickable");
    if (!c || c.t !== "clickable") return;
    // a null action is the noAction bug: it still looks pressable
    if (c.action === null) return;
    const actions = Array.isArray(c.action) ? c.action : [c.action];
    if (actions.some((a) => a.a === "select")) {
      this.state.selected = objectId;
      return;
    }
    this.runActions(actions, { x: o.x, y: o.y });
  }

  tick(dt: number) {
    const st = this.state;
    st.now += dt;
    const p = this.player();
    const ps = p ? st.objects[p.id] : undefined;

    for (const o of this.scene.objects) {
      const os = st.objects[o.id];

      for (const b of o.behaviors) {
        switch (b.t) {
          case "playerTopDown": {
            let dx = 0;
            let dy = 0;
            if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
            if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
            if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
            if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
            if (this.stick) {
              dx = this.stick.x;
              dy = this.stick.y;
            }
            if (dx === 0 && dy === 0) {
              os.moving = false;
              break;
            }
            os.dir4 = octant(dx, dy);
            /*
             * Shift turns without walking.
             *
             * Facing comes from the direction of travel, which means the only
             * way to look at something was to walk at it — and in a room where
             * walking costs minutes, turning to face a desk should not. Held
             * shift takes the direction and leaves the feet where they are.
             */
            if (this.keys.has("shift")) {
              os.moving = false;
              break;
            }
            os.moving = true;
            const len = Math.hypot(dx, dy);
            // the horizontal bound follows the room, not the viewport. It was
            // hardcoded to 340 from when every scene was exactly one screen
            // wide, which walled off the right half of the office.
            const maxX = (this.scene.world?.w ?? 360) - 20;
            const nx = Math.max(
              20,
              Math.min(maxX, os.x + (dx / len) * b.speed * dt)
            );
            const ny = Math.max(
              b.minY,
              Math.min(b.maxY, os.y + (dy / len) * b.speed * dt)
            );
            /** the blocker this point is inside, if any */
            const blocking = (x: number, y: number) => {
              for (const other of this.scene.objects) {
                const bl = other.behaviors.find((b2) => b2.t === "blocker");
                if (!bl || bl.t !== "blocker") continue;
                const bc = hitCentre(other, st.objects[other.id]);
                if (insideBlocker(bl, bc, x, y)) return bc;
              }
              return null;
            };
            /*
             * The way out of something you are already inside.
             *
             * Every test below asks "is this clear?", and from inside a circle
             * the answer is no everywhere near you — so the player pressed
             * into one stood still with nothing on screen holding them. It is
             * reachable however careful the blockers are: somebody walks onto
             * you, a scene opens with the two of you overlapping, a mutation
             * moves a barrel onto where you were standing.
             *
             * So when there is already something holding you, the question
             * changes. It is no longer "is this clear" but "is this further
             * out than where I am", which is what pushing away from something
             * is, and which is always answerable.
             */
            const here = blocking(os.x, os.y);
            const out = here
              ? Math.hypot(os.x - here.x, os.y - here.y)
              : 0;
            const free = here
              ? (x: number, y: number) =>
                  Math.hypot(x - here.x, y - here.y) > out
              : (x: number, y: number) => !blocking(x, y);
            /*
             * Slide along what you are pressed against.
             *
             * The whole move used to be tested as one point, so a diagonal that
             * clipped a blocker cancelled both axes: standing next to someone on
             * the pavement and walking away at an angle held you still, with no
             * sign of what was holding you. Each axis is offered on its own
             * before the move is refused.
             *
             * Neither axis is enough against a circle. Walk up and to the left
             * into one sitting up and to the left of you and all three tests
             * fail at once — the diagonal, and each half of it — so the player
             * stops dead on open floor with a barrel a body's width away. It
             * reads as the furniture grabbing you, and it happens around every
             * round blocker in the game, not any one bad piece of scenery.
             *
             * So the last thing tried is the tangent: drop the part of the
             * movement pointing into the obstacle and keep the part going past
             * it, which is what walking around something is.
             */
            if (free(nx, ny)) {
              os.x = nx;
              os.y = ny;
            } else if (free(nx, os.y)) {
              os.x = nx;
            } else if (free(os.x, ny)) {
              os.y = ny;
            } else {
              const bc = blocking(nx, ny);
              if (bc) {
                const ox = os.x - bc.x;
                const oy = os.y - bc.y;
                const olen = Math.hypot(ox, oy) || 1;
                const ux = ox / olen;
                const uy = oy / olen;
                const mx = nx - os.x;
                const my = ny - os.y;
                // the component of the step heading straight at the centre
                const into = mx * ux + my * uy;
                const tx = os.x + mx - into * ux;
                const ty = os.y + my - into * uy;
                if (free(tx, ty)) {
                  os.x = Math.max(20, Math.min(maxX, tx));
                  os.y = Math.max(b.minY, Math.min(b.maxY, ty));
                }
              }
            }
            if (dx !== 0) os.facing = dx > 0 ? 1 : -1;
            break;
          }

          case "wander": {
            if (!os.alive) break;
            if ((os.waitUntil ?? 0) > st.now) {
              os.moving = false;
              break;
            }
            const goal = (os.goal ??= this.somewhereIn(b, o.id));
            const dx = goal.x - os.x;
            const dy = goal.y - os.y;
            const len = Math.hypot(dx, dy);
            // close enough is arrived: walking the last three pixels of a
            // random errand looks like a stutter
            if (len < 4) {
              os.goal = undefined;
              os.moving = false;
              os.waitUntil = st.now + b.pause * (0.5 + Math.random());
              break;
            }
            const nx = os.x + (dx / len) * b.speed * dt;
            const ny = os.y + (dy / len) * b.speed * dt;
            /*
             * Something in the way ends the errand rather than being walked
             * around. A person who gives up and goes somewhere else reads as a
             * person; one that slides along a wall towards a fixed point reads
             * as a bug, and the sliding is the part that is hard to get right.
             */
            if (
              this.blockedAt(nx, ny, o.id) ||
              this.stepsOntoPlayer(os.x, os.y, nx, ny, o.id)
            ) {
              os.goal = undefined;
              os.moving = false;
              os.waitUntil = st.now + b.pause * 0.5;
              break;
            }
            os.x = nx;
            os.y = ny;
            os.moving = true;
            os.dir4 = octant(dx, dy);
            break;
          }

          case "mutter": {
            if (!os.alive) break;
            if (os.nextSayAt === undefined) {
              // staggered, so three people on one pavement do not all speak on
              // the same frame and then fall silent together
              os.nextSayAt = st.now + Math.random() * b.every;
            }
            if (st.now >= os.nextSayAt) {
              let i = Math.floor(Math.random() * b.keys.length);
              // not the same line twice running, which is what makes a rotation
              // read as a loop
              if (b.keys.length > 1 && b.keys[i] === os.says) {
                i = (i + 1) % b.keys.length;
              }
              os.says = b.keys[i];
              os.saysUntil = st.now + b.dwell;
              os.nextSayAt = st.now + b.every * (0.7 + Math.random() * 0.6);
            } else if (os.saysUntil !== undefined && st.now >= os.saysUntil) {
              os.says = undefined;
            }
            break;
          }

          case "patrol": {
            if (!os.alive) break;
            // a patrolling actor is walking, and walking has a direction —
            // without this an eight-facing character slid down the street
            // frozen on its idle frame, facing whichever way it was placed
            os.moving = true;
            os.dir4 =
              b.axis === "x"
                ? os.dir > 0
                  ? "right"
                  : "left"
                : os.dir > 0
                  ? "down"
                  : "up";
            const v = b.speed * os.dir * dt;
            if (b.axis === "x") os.x += v;
            else os.y += v;
            const cur = b.axis === "x" ? os.x : os.y;
            const set = (n: number) => {
              if (b.axis === "x") os.x = n;
              else os.y = n;
            };
            const mode = b.endMode ?? "turn";
            if (cur > b.max) {
              if (mode === "teleport") set(b.min);
              else if (mode === "bounce") {
                set(b.max - 18);
                os.dir = -1;
              } else {
                set(b.max);
                os.dir = -1;
              }
            } else if (cur < b.min) {
              if (mode === "teleport") set(b.max);
              else if (mode === "bounce") {
                set(b.min + 18);
                os.dir = 1;
              } else {
                set(b.min);
                os.dir = 1;
              }
            }
            os.facing = b.flipSprite ? (os.dir as 1 | -1) : 1;
            break;
          }

          case "spin": {
            os.angle += b.rpm * 6 * b.dir * dt;
            break;
          }

          case "sineFly": {
            os.x = b.cx + Math.sin(st.now * b.speed) * b.ampX;
            os.y = b.cy + Math.sin(st.now * b.speed * 2.6) * b.ampY;
            os.facing = Math.cos(st.now * b.speed) >= 0 ? 1 : -1;
            break;
          }

          case "pressure": {
            const on = st.flags[b.flag];
            const cur = st.counters[b.counter] ?? 0;
            const spec = this.scene.counters.find((c) => c.id === b.counter);
            const cap = spec?.max ?? 100;
            st.counters[b.counter] = on
              ? Math.min(cap, cur + b.rise * dt)
              : Math.max(0, cur - b.fall * dt);
            break;
          }

          case "platformer": {
            const left = this.keys.has("arrowleft") || this.keys.has("a");
            const right = this.keys.has("arrowright") || this.keys.has("d");
            if (left) os.x -= b.speed * dt;
            if (right) os.x += b.speed * dt;
            if (left !== right) os.facing = right ? 1 : -1;
            os.x = Math.max(15, Math.min(345, os.x));

            const prevY = os.y;
            const g = os.vy > 0 ? b.gravity * b.fallScale : b.gravity;
            os.vy += g * dt;
            os.y += os.vy * dt;
            st.grounded = false;

            const groundY = this.scene.sideView?.groundY ?? 600;
            if (os.y >= groundY) {
              os.y = groundY;
              os.vy = 0;
              st.grounded = true;
            }
            // one-way platforms
            for (const other of this.scene.objects) {
              const pf = other.behaviors.find((x) => x.t === "platform");
              if (!pf || pf.t !== "platform") continue;
              const ps2 = st.objects[other.id];
              const top = ps2.y;
              if (
                os.vy >= 0 &&
                prevY <= top + 1 &&
                os.y >= top &&
                os.x > ps2.x - 10 &&
                os.x < ps2.x + pf.width + 10
              ) {
                os.y = top;
                os.vy = 0;
                st.grounded = true;
              }
            }
            // jump pads
            if (st.grounded) {
              for (const other of this.scene.objects) {
                const jp = other.behaviors.find((x) => x.t === "jumpPad");
                if (!jp || jp.t !== "jumpPad") continue;
                const js = st.objects[other.id];
                if (
                  Math.abs(os.x - js.x) < 24 &&
                  Math.abs(os.y - js.y) < 12
                ) {
                  os.vy = jp.power;
                  st.grounded = false;
                }
              }
            }
            break;
          }

          case "drift": {
            const v = b.speed * dt;
            if (b.axis === "x") {
              os.x += v;
              if (os.x > b.wrapMax) os.x = b.wrapMin;
            } else {
              os.y += v;
              if (os.y > b.wrapMax) os.y = b.wrapMin;
            }
            break;
          }

          case "damage": {
            if (!ps || !os.alive) break;
            if (st.now <= st.invulnUntil) break;
            if (Math.hypot(os.x - ps.x, os.y - ps.y) >= b.radius) break;
            const cur = st.counters[b.counter] ?? 0;
            const next = cur - b.amount;
            st.invulnUntil = st.now + INVULN;
            st.counters[b.counter] = Math.max(0, next);
            // running out of health ends the run before the bug can be reported
            if (next <= 0) st.dead = true;
            break;
          }

          case "killable": {
            if (!os.alive && st.now >= os.respawnAt) {
              os.alive = true;
              os.x = o.x;
              os.y = o.y;
            }
            break;
          }

          case "pickup": {
            if (!ps) break;
            if (!os.alive) {
              if (st.now >= os.respawnAt) os.alive = true;
              break;
            }
            if (Math.hypot(os.x - ps.x, os.y - ps.y) < b.radius) {
              os.alive = false;
              os.respawnAt = st.now + b.respawn;
              this.runActions(b.onPickup, { x: os.x, y: os.y });
            }
            break;
          }

          default:
            break;
        }
      }
    }

    /* timers */
    for (const tm of this.scene.timers ?? []) {
      const start = st.timerStart[tm.id];
      if (start === null || start === undefined) continue;
      if (st.now - start >= tm.duration) {
        st.timerStart[tm.id] = null;
        st.timerRuns[tm.id] += 1;
        this.runActions(tm.onDone, { x: 180, y: 200 });
      }
    }

    st.popups = st.popups.filter((pop) => st.now - pop.bornAt < 1);
  }

  jump() {
    const p = this.scene.objects.find((o) =>
      o.behaviors.some((b) => b.t === "platformer")
    );
    if (!p) return;
    const pf = p.behaviors.find((b) => b.t === "platformer");
    if (!pf || pf.t !== "platformer") return;
    if (!this.state.grounded) return;
    this.state.objects[p.id].vy = pf.jumpV;
    this.state.grounded = false;
  }
}
