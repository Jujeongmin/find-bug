import type { ActorSpec, SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/** the wall band along the top; everything below it is walkable floor */
const WALL_H = 110;

/**
 * A workstation reads left to right: screen, desk, seat.
 *
 * The row is back against the top wall, where the desk art is drawn to be —
 * every interior pack in here draws furniture facing the camera, and the one
 * that ran down the left wall had to be drawn by hand rather than found.
 *
 * The seat still sits on the right of its desk, so whoever uses it faces left
 * into the screen rather than away from it.
 */
const DESKS = [52, 170, 288];
/** the screen stands in the middle of the slab */
const SCREEN_DX = -15;
/** the seat is tucked in at the front of the desk, its back to us */
const SEAT_DY = 2;
/** the desk slab ends this far above the desk's foot; the screen stands on it */
const SLAB = 16;

/** the developer, across the room, at a desk laid out the same way */
const DEV_X = 282;
const DEV_Y = 520;

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
 * The QA floor.
 *
 * It is a scene like any other, which is the point: the same engine that runs
 * the builds under test runs the room you walk around in, so a desk blocks you
 * the way a tree does.
 *
 * The room fits one screen on purpose. It was briefly twice that with a
 * scrolling camera, which made distance cost more of the day but left the
 * player looking at empty floor and unable to see where anything was.
 */
export const officeScene: SceneSpec = {
  id: "office",
  nameKey: "office.name",
  introKey: "office.intro",
  backgroundClass: "office-floor",
  counters: [],
  objects: [
    {
      // a step in from the door, because that is the way in — and far enough
      // off it that the first thing the room offers is not "go home again"
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 200,
      y: 556,
      z: 3,
      render: { actor: actor("worker") },
      behaviors: [
        { t: "playerTopDown", speed: 115, minY: WALL_H + 26, maxY: 618 },
      ],
    },

    /* the wall the machines stand against */
    {
      id: "wall",
      nameKey: "object.wall",
      kind: "decor",
      x: 0,
      y: 0,
      render: { className: "office-wall", bar: { width: 360, height: WALL_H } },
      behaviors: [],
    },
    ...[112, 220].map((x, i) => ({
      id: `window${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 26,
      render: { className: "office-window", bar: { width: 52, height: 44 } },
      behaviors: [],
    })),

    /* three test machines, each on its own desk against the wall */
    ...[
      { id: "machineA", x: DESKS[0], labelKey: "office.runA" },
      { id: "machineB", x: DESKS[1], labelKey: "office.runB" },
      { id: "machineC", x: DESKS[2], labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x + SCREEN_DX,
      // standing on the slab, not among the legs below it
      y: WALL_H + 12 - SLAB - 26,
      z: 2,
      render: { className: "office-crt", bar: { width: 30, height: 26 } },
      behaviors: [
        { t: "blocker" as const, radius: 26 },
        { t: "station" as const, radius: 54, labelKey: m.labelKey },
      ],
    })),
    ...DESKS.map((x, i) => ({
      id: `desk${i}`,
      nameKey: "object.desk",
      kind: "decor" as const,
      x,
      y: WALL_H + 12,
      render: { prop: { id: "desk" as const, scale: 1.4 } },
      behaviors: [],
    })),
    /*
     * The seats, pushed in at the front of each desk.
     *
 * Drawn for this, because no sheet in here has one: what faces the camera
     * at a desk against the wall is the back of the chair. The backrest laps
     * over the desk edge, the seat and legs stand below it.
     *
     * The front view puts the backrest between the seat and the desk, sitting
     * the worker down looking away from the screen. The one chair drawn from
     * behind in any pack here, roguelike (38,8), reads as a ladder at this size
     * — posts and rungs are all it has to show.
     */
    ...DESKS.map((x, i) => ({
      id: `chair${i}`,
      nameKey: "object.chair",
      kind: "decor" as const,
      // a bar, so it is anchored top-left: x is shifted half its width to
      // centre it on the desk
      x: x - 11,
      y: WALL_H + SEAT_DY,
      render: { className: "office-chair-back", bar: { width: 22, height: 30 } },
      behaviors: [],
    })),

    /*
     * The developer, at a bench of their own built the same way: screen on it,
     * seat side to the right, and the developer standing in that place turned
     * towards the screen. They used to stand above their own monitor facing
     * the camera — the one person in the room not looking at any work.
     */
    {
      id: "devDesk",
      nameKey: "object.desk",
      kind: "decor",
      x: DEV_X,
      y: DEV_Y,
      render: { prop: { id: "desk" as const, scale: 1.4 } },
      behaviors: [],
    },
    {
      /* dressing only: no station behaviour, so it offers nothing to activate */
      id: "devCrt",
      nameKey: "object.devCrt",
      kind: "decor",
      x: DEV_X + SCREEN_DX,
      y: DEV_Y - SLAB - 26,
      z: 3,
      render: { className: "office-crt-back", bar: { width: 30, height: 26 } },
      behaviors: [],
    },
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: DEV_X,
      y: DEV_Y + 20,
      z: 1,
      facing: "up",
      render: { actor: actor("worker2") },
      behaviors: [
        { t: "blocker", radius: 22 },
        { t: "station", radius: 52, labelKey: "office.talkDev" },
      ],
    },
    /* the supply form on the wall: where pay turns into equipment */
    {
      id: "supplyForm",
      nameKey: "object.supplyForm",
      kind: "sprite" as const,
      x: 36,
      y: 250,
      z: 2,
      render: { className: "office-form", bar: { width: 26, height: 32 } },
      behaviors: [
        { t: "blocker" as const, radius: 20 },
        { t: "station" as const, radius: 52, labelKey: "office.supply" },
      ],
    },

    /* dressing, and something to walk around */
    {
      id: "bookshelf",
      nameKey: "object.cabinet",
      kind: "decor",
      x: 36,
      y: 340,
      render: { prop: { id: "bookshelf" as const, scale: 1.4 } },
      behaviors: [{ t: "blocker", radius: 24 }],
    },
    {
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 322,
      y: 250,
      render: { prop: { id: "crate" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 322,
      y: 300,
      render: { prop: { id: "barrel" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 180,
      y: 420,
      z: 0,
      render: { prop: { id: "rug" as const, scale: 1.2 } },
      behaviors: [],
    },

    /* the door home, clear of the touch pad in the bottom-left */
    {
      id: "exitDoor",
      nameKey: "object.exitDoor",
      kind: "sprite",
      x: 240,
      y: 626,
      z: 1,
      render: { prop: { id: "door" as const, scale: 1.4 } },
      behaviors: [{ t: "station", radius: 50, labelKey: "office.goHome" }],
    },
  ],
};
