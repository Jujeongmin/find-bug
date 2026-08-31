import type { Action, ObjectSpec, SceneSpec } from "./types";

export interface ObjectState {
  id: string;
  x: number;
  y: number;
  /** vertical velocity, side-view scenes only */
  vy: number;
  facing: 1 | -1;
  /** which way the object is pointed, for directional sheets */
  dir4: "down" | "up" | "left" | "right";
  /** true while it actually travelled this frame */
  moving: boolean;
  dir: 1 | -1;
  alive: boolean;
  respawnAt: number;
  /** accumulated rotation in degrees */
  angle: number;
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

const ATTACK_ANIM = 0.25;
const INVULN = 1.2;

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
        dir4: "down",
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

  private addPopup(x: number, y: number, text: string) {
    this.state.popups.push({
      id: this.popupSeq++,
      x,
      y,
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
          const shown = a.popupBy ?? a.by;
          this.addPopup(at.x, at.y - 26, shown >= 0 ? `+${shown}` : `${shown}`);
          break;
        }
        case "heal": {
          const spec = this.scene.counters.find((c) => c.id === a.counter);
          const cur = this.state.counters[a.counter] ?? 0;
          const cap = spec?.max ?? Infinity;
          this.state.counters[a.counter] = Math.min(cap, cur + a.by);
          this.addPopup(at.x, at.y - 26, `❤️+${a.by}`);
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
            os.moving = true;
            // vertical wins ties, which reads better than flickering between
            // two facings while walking diagonally
            os.dir4 =
              Math.abs(dy) >= Math.abs(dx)
                ? dy < 0
                  ? "up"
                  : "down"
                : dx < 0
                  ? "left"
                  : "right";
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
            let blocked = false;
            for (const other of this.scene.objects) {
              const bl = other.behaviors.find((x) => x.t === "blocker");
              if (!bl || bl.t !== "blocker") continue;
              const bs = st.objects[other.id];
              if (Math.hypot(nx - bs.x, ny - bs.y) < bl.radius) {
                blocked = true;
                break;
              }
            }
            if (!blocked) {
              os.x = nx;
              os.y = ny;
            }
            if (dx !== 0) os.facing = dx > 0 ? 1 : -1;
            break;
          }

          case "patrol": {
            if (!os.alive) break;
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
