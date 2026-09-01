import type { ActorSpec, SceneSpec } from "../engine/types";

const actor = (): ActorSpec => ({
  sheet: "worker",
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
      y: 600,
      z: 3,
      render: { actor: actor() },
      behaviors: [{ t: "playerTopDown", speed: 115, minY: 190, maxY: 616 }],
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
      id: "officeDoor",
      nameKey: "object.officeDoor",
      kind: "sprite",
      x: 180,
      y: 176,
      z: 1,
      render: { prop: { id: "door", scale: 1.6 } },
      behaviors: [{ t: "station", radius: 58, labelKey: "street.enter" }],
    },

    /* coffee: alertness, paid for in minutes */
    {
      id: "coffee",
      nameKey: "object.coffeeStand",
      kind: "sprite",
      x: 62,
      y: 360,
      z: 1,
      render: { className: "street-coffee", bar: { width: 58, height: 44 } },
      behaviors: [
        { t: "blocker", radius: 34 },
        { t: "station", radius: 62, labelKey: "street.coffee" },
      ],
    },

    /* street furniture, so the walk has something in it */
    ...[110, 250].map((x, i) => ({
      id: `lamp${i}`,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x,
      y: 260 + i * 150,
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
      x: 306,
      y: 470,
      render: { prop: { id: "crate", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrelStreet",
      nameKey: "object.barrel",
      kind: "decor",
      x: 306,
      y: 516,
      render: { prop: { id: "barrel", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
  ],
  counters: [],
};
