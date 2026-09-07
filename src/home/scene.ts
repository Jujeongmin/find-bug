import type { ActorSpec, SceneSpec } from "../engine/types";

const WALL_H = 96;

const actor = (sheet: "worker" | "worker2"): ActorSpec => ({
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
 * Home. One room, and the only place the day can actually end.
 *
 * Clocking out used to roll straight into tomorrow, which made leaving the
 * office free. Now the evening is a place with one thing worth doing in it:
 * rest, or go to bed and carry the day's tiredness into the next one.
 */
export const homeScene: SceneSpec = {
  id: "home",
  nameKey: "home.name",
  backgroundClass: "home-floor",
  // the four rooms you walk around in: what covers what is decided by where
  // people are standing, not by the order the scene was written
  ySort: true,
  counters: [],
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 460,
      z: 3,
      render: { actor: actor("worker") },
      behaviors: [
        { t: "playerTopDown", speed: 150, minY: WALL_H + 26, maxY: 610 },
      ],
    },

    {
      id: "wall",
      nameKey: "object.wall",
      kind: "decor",
      x: 0,
      y: 0,
      render: { className: "home-wall", bar: { width: 360, height: WALL_H } },
      behaviors: [],
    },
    {
      id: "window",
      nameKey: "object.window",
      kind: "decor",
      x: 148,
      y: 22,
      render: { className: "office-window", bar: { width: 60, height: 48 } },
      behaviors: [],
    },

    /* bed: the only way into tomorrow */
    {
      id: "bed",
      nameKey: "object.bed",
      kind: "sprite",
      x: 62,
      y: 220,
      z: 1,
      render: {
        sprite: { sheet: "furniture", col: 8, row: 2, spanY: 2, scale: 1.7 },
      },
      behaviors: [
        { t: "blocker", radius: 46 },
        { t: "station", radius: 74, labelKey: "home.sleep" },
      ],
    },

    /* sofa: rest, and lose the tiredness the long day left */
    {
      id: "sofa",
      nameKey: "object.sofa",
      kind: "sprite",
      x: 270,
      y: 430,
      z: 1,
      render: {
        sprite: { sheet: "furniture", col: 0, row: 0, spanX: 2, spanY: 2, scale: 1.5 },
      },
      behaviors: [
        { t: "blocker", radius: 40 },
        { t: "station", radius: 66, labelKey: "home.rest" },
      ],
    },

    /* the desk you keep a journal at */
    {
      id: "homeDesk",
      nameKey: "object.desk",
      kind: "decor",
      x: 300,
      y: 178,
      render: {
        sprite: { sheet: "office", col: 0, row: 0, spanX: 2, spanY: 2, scale: 1.5 },
      },
      behaviors: [],
    },
    {
      id: "homeScreen",
      nameKey: "object.homeScreen",
      kind: "sprite",
      x: 288,
      y: 152,
      // the desk it is on, plus a pixel
      sortY: 179,
      z: 2,
      // the same machine as the office's, turned away: this is the one you
      // chose to sit at
      render: { sprite: { sheet: "office", col: 3, row: 0, scale: 1.5 } },
      behaviors: [
        { t: "blocker", radius: 24 },
      ],
    },

    {
      /* the same chair the office desks have, pushed in, back to us */
      id: "homeChair",
      nameKey: "object.chair",
      kind: "decor",
      x: 300,
      y: 202,
      render: { sprite: { sheet: "office", col: 3, row: 1, scale: 1.6 } },
      behaviors: [],
    },
    {
      /* the journal lives on the shelf, where a journal would */
      id: "journal",
      nameKey: "object.journal",
      kind: "sprite" as const,
      x: 44,
      y: 400,
      render: {
        sprite: { sheet: "office", col: 0, row: 2, spanY: 2, scale: 1.6 },
      },
      behaviors: [
        { t: "blocker" as const, radius: 24 },
        { t: "station" as const, radius: 56, labelKey: "home.journal" },
      ],
    },
    {
      // inside your own front door, for the same reason
      id: "homeRug",
      nameKey: "object.rug",
      kind: "decor",
      x: 296,
      y: 580,
      z: 0,
      render: { prop: { id: "rug", scale: 1.3 } },
      behaviors: [],
    },

    /* the parcel box: home things are ordered, not requisitioned */
    {
      id: "parcel",
      nameKey: "object.parcel",
      kind: "sprite" as const,
      x: 238,
      y: 604,
      z: 1,
      render: { prop: { id: "crate", scale: 1.5 } },
      behaviors: [
        { t: "blocker" as const, radius: 22 },
        { t: "station" as const, radius: 52, labelKey: "home.order" },
      ],
    },

    /* out to work */
    {
      id: "frontDoor",
      nameKey: "object.exitDoor",
      kind: "sprite",
      x: 300,
      y: 620,
      z: 1,
      render: { prop: { id: "door", scale: 1.4 } },
      behaviors: [{ t: "station", radius: 50, labelKey: "home.goWork" }],
    },
  ],
};
