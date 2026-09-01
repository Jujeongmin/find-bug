import type { ActorSpec, SceneSpec } from "../engine/types";

const actor = (sheet: "worker" | "worker2" = "worker"): ActorSpec => ({
  sheet,
  rows: {
    down: 0,
    downRight: 1,
    right: 2,
    upRight: 3,
    up: 4,
    upLeft: 5,
    left: 6,
    downLeft: 7,
  },
  idle: 0,
  walk: [1, 2, 3, 4],
  fps: 8,
  scale: 1.5,
});

/**
 * The walk to work.
 *
 * Sleeping used to put you at your desk. The commute is where the night before
 * gets paid for: the office clock is already running, so a late start and a
 * slow walk are the same currency, and the coffee stand sells alertness for
 * minutes you may not have.
 */
export const streetScene: SceneSpec = {
  id: "street",
  nameKey: "street.name",
  introKey: "street.intro",
  backgroundClass: "street-ground",
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 540,
      z: 3,
      render: { actor: actor() },
      behaviors: [{ t: "playerTopDown", speed: 150, minY: 186, maxY: 566 }],
    },

    /* the office block across the top, with the way in */
    {
      id: "block",
      nameKey: "object.block",
      kind: "decor",
      x: 0,
      y: 0,
      render: { className: "street-block", bar: { width: 360, height: 150 } },
      behaviors: [],
    },
    ...[70, 290].map((x, i) => ({
      id: `blockWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 34,
      render: { className: "office-window", bar: { width: 48, height: 40 } },
      behaviors: [],
    })),
    {
      /* the sign over the door: a grub and a name, which is all a small studio
         ever has on the front of its building */
      id: "sign",
      nameKey: "object.sign",
      kind: "decor",
      x: 134,
      y: 56,
      z: 1,
      render: { className: "street-sign", bar: { width: 92, height: 26 } },
      behaviors: [],
    },
    {
      id: "officeDoor",
      nameKey: "object.officeDoor",
      kind: "sprite",
      x: 180,
      y: 148,
      z: 1,
      render: { prop: { id: "door", scale: 1.6 } },
      behaviors: [{ t: "station", radius: 58, labelKey: "street.enter" }],
    },

    /*
     * Other people on the same walk, standing where they stopped.
     *
     * The pack has two characters in it and both are spoken for — one is the
     * player, the other is the developer — so these are the same sprites with
     * the colour turned round on each. A stranger in a blue coat is not you
     * and is not him, which is all a passer-by has to say for itself before
     * it opens its mouth.
     */
    ...[
      { id: "passer0", sheet: "worker2" as const, x: 98, y: 330, facing: "left" as const, tint: "p0" },
      { id: "passer1", sheet: "worker" as const, x: 262, y: 300, facing: "down" as const, tint: "p1" },
      { id: "passer2", sheet: "worker2" as const, x: 140, y: 482, facing: "up" as const, tint: "p2" },
    ].map((c) => ({
      id: c.id,
      nameKey: `object.${c.id}`,
      kind: "sprite" as const,
      x: c.x,
      y: c.y,
      z: 2,
      facing: c.facing,
      render: { actor: actor(c.sheet), className: `street-passer ${c.tint}` },
      behaviors: [
        { t: "blocker" as const, radius: 16 },
        { t: "station" as const, radius: 46, labelKey: "street.talk" },
      ],
    })),

    /* the vending machine: alertness, paid for in minutes */
    {
      id: "coffee",
      nameKey: "object.coffeeStand",
      kind: "sprite",
      x: 6,
      y: 300,
      z: 1,
      render: {
        className: "street-vending",
        bar: { width: 48, height: 68 },
        glow: { radius: 74, offsetX: 24, offsetY: 30 },
      },
      behaviors: [
        { t: "blocker", radius: 34 },
        { t: "station", radius: 62, labelKey: "street.coffee" },
      ],
    },

    /* home at the other end, so the street runs between two doors */
    {
      id: "homeBlock",
      nameKey: "object.block",
      kind: "decor",
      x: 0,
      y: 578,
      render: { className: "street-home", bar: { width: 360, height: 62 } },
      behaviors: [],
    },
    {
      id: "homeDoor",
      nameKey: "object.frontDoor",
      kind: "sprite",
      x: 180,
      y: 600,
      z: 1,
      render: { prop: { id: "door", scale: 1.6 } },
      behaviors: [{ t: "station", radius: 58, labelKey: "street.home" }],
    },

    /* street furniture, so the walk has something in it */
    ...[24, 326].map((x, i) => ({
      id: `lamp${i}`,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x,
      y: i === 0 ? 470 : 300,
      render: {
        className: "street-lamp",
        bar: { width: 8, height: 46 },
        glow: { radius: 80, offsetX: 4, offsetY: 2 },
      },
      behaviors: [{ t: "blocker" as const, radius: 14 }],
    })),
    {
      id: "crateStreet",
      nameKey: "object.crate",
      kind: "decor",
      x: 332,
      y: 440,
      render: { prop: { id: "crate", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrelStreet",
      nameKey: "object.barrel",
      kind: "decor",
      x: 332,
      y: 486,
      render: { prop: { id: "barrel", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
  ],
  counters: [],
};
