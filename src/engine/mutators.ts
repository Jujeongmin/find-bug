import type { BugCategory } from "../core/types";
import type { Action, Behavior, ObjectSpec, SceneSpec } from "./types";

export interface Target {
  objectId: string;
  /** extra identification for mutators that need it (e.g. which behavior) */
  note?: string;
}

export interface Mutator {
  id: string;
  category: BugCategory;
  /** other readings of the same observation the report should accept */
  alsoCategories?: BugCategory[];
  descKey: string;
  /** base difficulty: 1 easy … 4 hardest */
  subtlety: 1 | 2 | 3 | 4;
  /** when true, only objects with a visible same-kind peer qualify */
  requiresPeer: boolean;
  /**
   * True when spotting the bug means comparing against a peer (a missing
   * animation, an odd colour). False when the bug is self-evident on its own
   * (a dead button, walking through a wall) — those get no distance penalty.
   */
  comparative: boolean;
  candidates(scene: SceneSpec): Target[];
  apply(scene: SceneSpec, target: Target): SceneSpec;
  /** picks accepted as correct */
  answerIds(scene: SceneSpec, target: Target): string[];
  /** template params besides `obj` */
  descParams?(scene: SceneSpec, target: Target): Record<string, string>;
}

/* ---------- helpers ---------- */

function clone(scene: SceneSpec): SceneSpec {
  return JSON.parse(JSON.stringify(scene)) as SceneSpec;
}

function mapObject(
  scene: SceneSpec,
  id: string,
  fn: (o: ObjectSpec) => void
): SceneSpec {
  const next = clone(scene);
  const obj = next.objects.find((o) => o.id === id);
  if (obj) fn(obj);
  return next;
}

function hasBehavior(o: ObjectSpec, t: Behavior["t"]): boolean {
  return o.behaviors.some((b) => b.t === t);
}

/** objects that share a peerGroup with at least one sibling */
function withPeers(scene: SceneSpec, pool: ObjectSpec[]): ObjectSpec[] {
  return pool.filter(
    (o) =>
      o.peerGroup !== undefined &&
      scene.objects.some((p) => p.id !== o.id && p.peerGroup === o.peerGroup)
  );
}

function byBehavior(scene: SceneSpec, t: Behavior["t"]): ObjectSpec[] {
  return scene.objects.filter((o) => hasBehavior(o, t));
}

/* ---------- mutator catalog ---------- */

export const noAction: Mutator = {
  id: "noAction",
  category: "no-action",
  descKey: "bugdesc.noAction",
  subtlety: 2,
  requiresPeer: false,
  comparative: false,
  candidates: (s) =>
    byBehavior(s, "clickable")
      .filter((o) =>
        o.behaviors.some((b) => b.t === "clickable" && b.action !== null)
      )
      .map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "clickable" ? { t: "clickable", action: null } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const noCollision: Mutator = {
  id: "noCollision",
  category: "physics",
  descKey: "bugdesc.noCollision",
  subtlety: 2,
  requiresPeer: true,
  comparative: false,
  candidates: (s) =>
    withPeers(s, byBehavior(s, "blocker")).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "blocker");
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const floating: Mutator = {
  id: "floating",
  category: "physics",
  descKey: "bugdesc.floating",
  subtlety: 2,
  requiresPeer: false,
  comparative: false,
  candidates: (s) =>
    s.objects
      .filter((o) => o.render.shadow && o.kind !== "player")
      .map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.render.liftY = 28;
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const freezeAnimation: Mutator = {
  id: "freezeAnimation",
  category: "weird-movement",
  descKey: "bugdesc.freezeAnimation",
  subtlety: 2,
  requiresPeer: true,
  comparative: true,
  // only animations the scene marks essential: a bat that glides instead of
  // flapping looks intentional, not broken
  candidates: (s) =>
    withPeers(
      s,
      s.objects.filter((o) =>
        o.behaviors.some((b) => b.t === "animate" && b.essential)
      )
    ).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "animate");
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const reverseDirection: Mutator = {
  id: "reverseDirection",
  category: "weird-movement",
  descKey: "bugdesc.reverseDirection",
  subtlety: 2,
  requiresPeer: true,
  comparative: true,
  // a left/right flip is invisible on a symmetrical sprite, so scenes opt in
  candidates: (s) =>
    withPeers(
      s,
      byBehavior(s, "patrol").filter((o) => o.render.directional)
    ).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "patrol" ? { ...b, flipSprite: !b.flipSprite } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const mirrorShadow: Mutator = {
  id: "mirrorShadow",
  category: "graphic",
  descKey: "bugdesc.mirrorShadow",
  subtlety: 3,
  // shadows are compared against every other shadow on screen, not against a
  // same-kind sibling — so peerGroup is the wrong fairness test here
  requiresPeer: false,
  comparative: true,
  candidates: (s) => {
    if (!s.light) return [];
    const shadowed = s.objects.filter((o) => o.render.shadow);
    if (shadowed.length < 2) return [];
    return shadowed.map((o) => ({ objectId: o.id }));
  },
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      if (o.render.shadow) o.render.shadow.offsetX *= -1;
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const counterSkew: Mutator = {
  id: "counterSkew",
  category: "logic",
  descKey: "bugdesc.counterSkew",
  subtlety: 3,
  requiresPeer: false,
  comparative: false,
  candidates: (s) => {
    const out: Target[] = [];
    // a skewed counter is only findable if the player can see it
    const visible = new Set(
      s.objects.filter((o) => o.counter).map((o) => o.counter as string)
    );
    for (const o of s.objects) {
      for (const b of o.behaviors) {
        const actions =
          b.t === "killable"
            ? b.onKill
            : b.t === "pickup"
              ? b.onPickup
              : b.t === "clickable" && b.action
                ? Array.isArray(b.action)
                  ? b.action
                  : [b.action]
                : [];
        for (const a of actions) {
          if (a.a === "increment" && visible.has(a.counter)) {
            out.push({ objectId: o.id, note: a.counter });
          }
        }
      }
    }
    return out;
  },
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) => {
        const skew = (a: Action): Action =>
          a.a === "increment" && a.counter === t.note
            ? { ...a, popupBy: a.popupBy ?? a.by, by: a.by * 2 }
            : a;
        if (b.t === "killable") return { ...b, onKill: b.onKill.map(skew) };
        if (b.t === "pickup") return { ...b, onPickup: b.onPickup.map(skew) };
        if (b.t === "clickable" && b.action) {
          return {
            ...b,
            action: Array.isArray(b.action)
              ? b.action.map(skew)
              : skew(b.action),
          };
        }
        return b;
      });
    }),
  /** the counter widget is the visible offender; the source object counts too */
  answerIds: (s, t) => {
    const widget = s.objects.find((o) => o.counter === t.note);
    return widget ? [widget.id, t.objectId] : [t.objectId];
  },
  descParams: (s, t) => {
    const widget = s.objects.find((o) => o.counter === t.note);
    return { counter: widget ? widget.nameKey : t.note ?? "" };
  },
};

export const speedScale: Mutator = {
  id: "speedScale",
  category: "weird-movement",
  descKey: "bugdesc.speedScale",
  subtlety: 4,
  requiresPeer: false,
  comparative: true,
  // only `spin` is actually slowed by apply() — including other behaviours here
  // would generate bugs that change nothing on screen
  candidates: (s) => byBehavior(s, "spin").map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "spin" ? { ...b, rpm: b.rpm * 0.5 } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const teleportOnEnd: Mutator = {
  id: "teleportOnEnd",
  category: "weird-movement",
  descKey: "bugdesc.teleportOnEnd",
  subtlety: 2,
  requiresPeer: false,
  comparative: false,
  candidates: (s) =>
    byBehavior(s, "patrol").map((o) => ({ objectId: o.id, note: "teleport" })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "patrol" ? { ...b, endMode: "teleport" as const } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const bounceOnEnd: Mutator = {
  id: "bounceOnEnd",
  category: "weird-movement",
  descKey: "bugdesc.bounceOnEnd",
  subtlety: 3,
  requiresPeer: false,
  comparative: false,
  candidates: (s) =>
    byBehavior(s, "patrol").map((o) => ({ objectId: o.id, note: "bounce" })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "patrol" ? { ...b, endMode: "bounce" as const } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const offsetGlow: Mutator = {
  id: "offsetGlow",
  category: "graphic",
  descKey: "bugdesc.offsetGlow",
  subtlety: 3,
  requiresPeer: false,
  comparative: true,
  candidates: (s) => {
    const glowing = s.objects.filter((o) => o.render.glow);
    if (glowing.length < 2) return [];
    return glowing.map((o) => ({ objectId: o.id }));
  },
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      if (o.render.glow) {
        o.render.glow.offsetX = 46;
        o.render.glow.offsetY = 38;
      }
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const flipSprite: Mutator = {
  id: "flipSprite",
  category: "graphic",
  descKey: "bugdesc.flipSprite",
  subtlety: 2,
  requiresPeer: true,
  comparative: true,
  // flipping a symmetrical sprite (a flat platform, a ball) changes nothing on
  // screen, so scenes opt in per object with render.orientable
  candidates: (s) =>
    withPeers(
      s,
      s.objects.filter((o) => o.render.orientable && o.kind !== "player")
    ).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.render.upsideDown = true;
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const zSwap: Mutator = {
  id: "zSwap",
  category: "graphic",
  descKey: "bugdesc.zSwap",
  subtlety: 3,
  requiresPeer: false,
  comparative: false,
  candidates: (s) =>
    s.objects
      .filter((o) => o.overlaps !== undefined)
      .map((o) => ({ objectId: o.id, note: o.overlaps })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      const other = s.objects.find((x) => x.id === t.note);
      o.z = (other?.z ?? 1) + 5;
    }),
  answerIds: (_s, t) => [t.objectId],
};


export const wiringSwap: Mutator = {
  id: "wiringSwap",
  category: "logic",
  descKey: "bugdesc.wiringSwap",
  subtlety: 4,
  requiresPeer: false,
  comparative: false,
  candidates: (s) => {
    const links = s.links ?? [];
    if (links.length < 2) return [];
    // swap the first two links; one target is enough since both are accepted
    return [{ objectId: links[0].from, note: links[1].from }];
  },
  apply: (s, t) => {
    const next = clone(s);
    const links = next.links ?? [];
    const a = links.find((l) => l.from === t.objectId);
    const b = links.find((l) => l.from === t.note);
    if (a && b) {
      const tmp = a.to;
      a.to = b.to;
      b.to = tmp;
    }
    return next;
  },
  answerIds: (_s, t) => [t.objectId, t.note as string],
};

export const noBounce: Mutator = {
  id: "noBounce",
  category: "no-action",
  alsoCategories: ["physics"],
  descKey: "bugdesc.noBounce",
  subtlety: 2,
  requiresPeer: true,
  comparative: false,
  candidates: (s) =>
    withPeers(s, byBehavior(s, "jumpPad")).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "jumpPad");
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const noPlatform: Mutator = {
  id: "noPlatform",
  category: "physics",
  alsoCategories: ["no-action"],
  descKey: "bugdesc.noPlatform",
  subtlety: 2,
  requiresPeer: true,
  comparative: false,
  candidates: (s) =>
    withPeers(s, byBehavior(s, "platform")).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "platform");
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const invertMeter: Mutator = {
  id: "invertMeter",
  category: "logic",
  descKey: "bugdesc.invertMeter",
  subtlety: 3,
  requiresPeer: false,
  comparative: false,
  candidates: (s) => byBehavior(s, "meter").map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "meter" ? { ...b, invert: !b.invert } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const noHit: Mutator = {
  id: "noHit",
  category: "no-action",
  descKey: "bugdesc.noHit",
  subtlety: 2,
  requiresPeer: true,
  comparative: false,
  candidates: (s) =>
    withPeers(
      s,
      byBehavior(s, "killable").filter((o) =>
        o.behaviors.some((b) => b.t === "killable" && b.tappable)
      )
    ).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        b.t === "killable" ? { ...b, ignoreTaps: true } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

/**
 * A collectible that will not be collected.
 *
 * Walking onto it is the whole verb of a forage stage, so this is the first
 * thing anyone would report — and it needs a peer, because "nothing happened"
 * only means something when the identical shoot beside it did work.
 */
export const noPickup: Mutator = {
  id: "noPickup",
  category: "no-action",
  descKey: "bugdesc.noPickup",
  subtlety: 2,
  requiresPeer: true,
  comparative: false,
  candidates: (s) =>
    withPeers(s, byBehavior(s, "pickup")).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "pickup");
    }),
  answerIds: (_s, t) => [t.objectId],
};

/**
 * Taken once and never seen again.
 *
 * Slower to notice than a dead pickup — you have to have taken it, kept
 * playing, and come back — which is why it is rated a step subtler.
 */
export const noRespawn: Mutator = {
  id: "noRespawn",
  category: "logic",
  descKey: "bugdesc.noRespawn",
  subtlety: 3,
  requiresPeer: true,
  comparative: true,
  candidates: (s) =>
    withPeers(
      s,
      byBehavior(s, "pickup").filter((o) =>
        o.behaviors.some((b) => b.t === "pickup" && b.respawn > 0)
      )
    ).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.map((b) =>
        // far beyond any run, so it is gone for good without a special case
        b.t === "pickup" ? { ...b, respawn: 9999 } : b
      );
    }),
  answerIds: (_s, t) => [t.objectId],
};

/** a hazard that turns out to be harmless — found by walking into it */
export const noDamage: Mutator = {
  id: "noDamage",
  category: "no-action",
  alsoCategories: ["physics"],
  descKey: "bugdesc.noDamage",
  subtlety: 3,
  requiresPeer: true,
  comparative: true,
  candidates: (s) =>
    withPeers(s, byBehavior(s, "damage")).map((o) => ({ objectId: o.id })),
  apply: (s, t) =>
    mapObject(s, t.objectId, (o) => {
      o.behaviors = o.behaviors.filter((b) => b.t !== "damage");
    }),
  answerIds: (_s, t) => [t.objectId],
};

export const MUTATORS: Mutator[] = [
  noPickup,
  noRespawn,
  noDamage,
  noHit,
  invertMeter,
  noBounce,
  noPlatform,
  noAction,
  noCollision,
  floating,
  freezeAnimation,
  reverseDirection,
  speedScale,
  teleportOnEnd,
  bounceOnEnd,
  mirrorShadow,
  offsetGlow,
  flipSprite,
  zSwap,
  counterSkew,
  wiringSwap,
];
