import type { ObjectSpec, SceneSpec } from "../engine/types";

/**
 * A single measurable claim about an object.
 *
 * This is what the spec sheet is built out of. The player records facts while
 * a build is known-good, and a later build is buggy exactly where a recorded
 * fact no longer holds. Nothing here decides what is a defect — it only makes
 * the world measurable, so the player can decide.
 *
 * `value` is compared as a string: two builds agree when their values render
 * identically. That keeps comparison honest (what you see is what is checked)
 * and avoids float noise.
 */
export interface Fact {
  /** stable within an object, e.g. "patrol.speed" */
  key: string;
  labelKey: string;
  /** substituted into the label */
  params?: Record<string, string>;
  value: string;
}

const round = (n: number) => (Math.round(n * 100) / 100).toString();

/** every fact currently observable on this object */
export function factsFor(scene: SceneSpec, o: ObjectSpec): Fact[] {
  const f: Fact[] = [];
  const counterName = (id: string) =>
    scene.counters.find((c) => c.id === id)?.nameKey ?? id;

  for (const b of o.behaviors) {
    switch (b.t) {
      case "clickable": {
        const actions = b.action === null ? [] : Array.isArray(b.action) ? b.action : [b.action];
        const inc = actions.find((a) => a.a === "increment");
        if (inc && inc.a === "increment") {
          f.push({
            key: "click.delta",
            labelKey: "fact.clickDelta",
            params: { counter: counterName(inc.counter) },
            value: inc.by >= 0 ? `+${inc.by}` : `${inc.by}`,
          });
        } else {
          // a null action still looks pressable, which is the whole point of
          // recording this: "nothing happens" is a fact you can pin down
          f.push({
            key: "click.delta",
            labelKey: "fact.clickNone",
            value: "-",
          });
        }
        break;
      }
      case "patrol":
        f.push({
          key: "patrol.range",
          labelKey: "fact.patrolRange",
          value: `${b.min}~${b.max}`,
        });
        f.push({
          key: "patrol.speed",
          labelKey: "fact.patrolSpeed",
          value: round(b.speed),
        });
        f.push({
          key: "patrol.end",
          labelKey: "fact.patrolEnd",
          value: b.endMode ?? "turn",
        });
        break;
      case "drift":
        f.push({ key: "drift.speed", labelKey: "fact.driftSpeed", value: round(b.speed) });
        break;
      case "animate":
        f.push({
          key: "anim.period",
          labelKey: "fact.animPeriod",
          value: b.period === 0 ? "stopped" : round(b.period),
        });
        break;
      case "spin":
        f.push({ key: "spin.rpm", labelKey: "fact.spinRpm", value: round(b.rpm) });
        f.push({ key: "spin.dir", labelKey: "fact.spinDir", value: b.dir > 0 ? "cw" : "ccw" });
        break;
      case "blocker":
        f.push({ key: "blocker", labelKey: "fact.blocker", value: round(b.radius) });
        break;
      case "killable":
        f.push({ key: "kill.respawn", labelKey: "fact.respawn", value: round(b.respawn) });
        break;
      case "pickup":
        f.push({ key: "pickup.respawn", labelKey: "fact.respawn", value: round(b.respawn) });
        break;
      case "meter":
        f.push({ key: "meter.dir", labelKey: "fact.meterDir", value: b.invert ? "inverted" : "normal" });
        break;
    }
  }

  if (o.render.shadow) {
    f.push({
      key: "shadow.side",
      labelKey: "fact.shadowSide",
      value: o.render.shadow.offsetX >= 0 ? "right" : "left",
    });
  }
  if (o.render.glow) {
    f.push({
      key: "glow.offset",
      labelKey: "fact.glowOffset",
      value: `${o.render.glow.offsetX},${o.render.glow.offsetY}`,
    });
  }
  f.push({
    key: "ground",
    labelKey: "fact.ground",
    value: o.render.liftY ? "lifted" : "grounded",
  });
  if (o.render.orientable) {
    f.push({
      key: "orient",
      labelKey: "fact.orient",
      value: o.render.upsideDown ? "flipped" : "upright",
    });
  }
  if (o.overlaps) {
    f.push({
      key: "depth",
      labelKey: "fact.depth",
      value: (o.z ?? 1) > 1 ? "front" : "behind",
    });
  }

  return f;
}

/** the object's current value for one recorded fact, or null if it is gone */
export function currentValue(
  scene: SceneSpec,
  objectId: string,
  factKey: string
): string | null {
  const o = scene.objects.find((x) => x.id === objectId);
  if (!o) return null;
  return factsFor(scene, o).find((f) => f.key === factKey)?.value ?? null;
}

/** one line of the player's spec sheet */
export interface SpecEntry {
  objectId: string;
  factKey: string;
  labelKey: string;
  params?: Record<string, string>;
  /** the value that was true when it was recorded */
  value: string;
  /** which build it was recorded in */
  build: number;
  /** last build this entry was re-measured in, and how it came out */
  checkedBuild?: number;
  checkedOk?: boolean;
}
