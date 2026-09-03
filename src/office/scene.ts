import type { ActorSpec, SceneSpec } from "../engine/types";
import { front, glassDoor } from "../street/build";
import { DEV_MUTTERS } from "./devlines";

/** the three machines today's builds are queued on */
export const MACHINES = [
  "machineA",
  "machineB",
  "machineC",
  "machineD",
] as const;
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
/*
 * Four desks, and three points of condition to spend on them.
 *
 * Three machines and three points meant there was never a choice: look at
 * all of them, every day, and the coffee and the chair and the half hour
 * were things nobody had a reason to buy. A fourth build is the reason.
 * Either something ships unlooked-at or the day costs money and minutes.
 */
const DESKS = [44, 129, 214, 299];
/**
 * The screen stands in the middle of the slab.
 *
 * It used to be fifteen pixels left of the desk's centre, which was the middle
 * of the old one: the desk is drawn now rather than borrowed, and it is wider
 * than the prop it replaced, so the same offset hung the monitor over the edge.
 */
const SCREEN_DX = 0;
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
  // the four rooms you walk around in: what covers what is decided by where
  // people are standing, not by the order the scene was written
  ySort: true,
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
        { t: "playerTopDown", speed: 150, minY: WALL_H + 26, maxY: 618 },
      ],
    },

    /*
     * The wall the machines stand against, drawn from the city sheet — the
     * same plaster and the same windows the building has outside, so walking
     * in is one building rather than two.
     *
     * Three rows of it hung from the wall's foot, so the top row runs off the
     * screen rather than leaving a strip of floor above it.
     */
    ...front("wall", { left: 9, mid: 10, right: 11 }, 5, 3, 0, WALL_H, 9, 2.5),
    ...[112, 220].map((x, i) => ({
      id: `window${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 74,
      z: 1,
      render: { sprite: { sheet: "city" as const, col: 26, row: 18, scale: 2.6 } },
      behaviors: [],
    })),

    /* three test machines, each on its own desk against the wall */
    ...[
      { id: "machineA", x: DESKS[0], labelKey: "office.runA" },
      { id: "machineB", x: DESKS[1], labelKey: "office.runB" },
      { id: "machineC", x: DESKS[2], labelKey: "office.runC" },
      { id: "machineD", x: DESKS[3], labelKey: "office.runD" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x + SCREEN_DX,
      // standing on the slab, not among the legs below it
      y: WALL_H + 12 - SLAB - 17,
      // and sorting on the desk's own foot, a pixel in front of it: its screen
      // stands at the back of the slab, which is behind the desk it is on
      sortY: WALL_H + 13,
      z: 2,
      render: { sprite: { sheet: "office" as const, col: 2, row: 0, scale: 1.7 } },
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
      render: {
        sprite: { sheet: "office" as const, col: 0, row: 0, spanX: 2, spanY: 2, scale: 1.7 },
      },
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
      x,
      y: WALL_H + SEAT_DY + 24,
      render: { sprite: { sheet: "office" as const, col: 3, row: 1, scale: 1.8 } },
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
      render: {
        sprite: { sheet: "office" as const, col: 0, row: 0, spanX: 2, spanY: 2, scale: 1.7 },
      },
      behaviors: [],
    },
    {
      /* dressing only: no station behaviour, so it offers nothing to activate */
      id: "devCrt",
      nameKey: "object.devCrt",
      kind: "decor",
      x: DEV_X + SCREEN_DX,
      y: DEV_Y - SLAB - 17,
      sortY: DEV_Y + 1,
      z: 3,
      render: { sprite: { sheet: "office" as const, col: 3, row: 0, scale: 1.7 } },
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
        // they do not wander — they are working — but a room with one other
        // person in it should not be silent for eight hours
        { t: "mutter", keys: DEV_MUTTERS, every: 21, dwell: 4 },
      ],
    },
    /* the supply form on the wall: where pay turns into equipment */
    {
      id: "supplyForm",
      nameKey: "object.supplyForm",
      kind: "sprite" as const,
      x: 36,
      y: 250,
      // the foot of the bar it is drawn as
      sortY: 282,
      z: 2,
      render: { className: "office-form", bar: { width: 26, height: 32 } },
      behaviors: [
        { t: "blocker" as const, radius: 20 },
        { t: "station" as const, radius: 52, labelKey: "office.supply" },
      ],
    },

    /* dressing, and something to walk around */
    {
      // it is called a filing cabinet in every language the game speaks, and
      // was drawn as a bookcase full of paperbacks
      id: "bookshelf",
      nameKey: "object.cabinet",
      kind: "decor",
      x: 36,
      y: 340,
      render: {
        sprite: { sheet: "office" as const, col: 1, row: 2, spanY: 2, scale: 1.7 },
      },
      behaviors: [{ t: "blocker", radius: 24 }],
    },
    {
      // boxes and the office bin, rather than the crate and barrel a tavern
      // would have
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 322,
      y: 262,
      render: { sprite: { sheet: "city" as const, col: 13, row: 16, scale: 2.2 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 322,
      y: 312,
      render: { sprite: { sheet: "city" as const, col: 12, row: 15, scale: 2.2 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      // inside the door, where a mat goes: in the middle of the floor it was
      // something to walk round rather than something walked over
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 240,
      y: 574,
      z: 0,
      render: { prop: { id: "rug" as const, scale: 1.2 } },
      behaviors: [],
    },

    /* the door home, clear of the touch pad in the bottom-left: the same
       pair of leaves seen from the pavement outside */
    ...glassDoor("exitDoor", 240, 640, 1.4, [
      { t: "station", radius: 50, labelKey: "office.goHome" },
    ]),
  ],
};
