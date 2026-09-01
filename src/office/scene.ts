import type { ActorSpec, SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/** the wall band along the top; everything below it is walkable floor */
const WALL_H = 110;

/**
 * The three machines stand in a row down the left-hand wall.
 *
 * A station reads left to right: screen, desk, seat. Against the top wall
 * that put the worker below the desk with their back to us, which needs a
 * chair drawn from behind — the one view the packs here do not have. Along
 * the left wall the whole row turns side-on instead: you see the flank of
 * each monitor, the seat is pulled up on its right, and the person in it
 * faces left into the screen.
 */
/** the bench runs down the left wall; x is its left edge, not a centre */
const BENCH_X = 12;
const BENCH_W = 42;
const BENCH_TOP = 196;
const BENCH_H = 330;
/** where each machine stands along it, and where its seat is pulled up */
const STATION_Y = [252, 362, 472];
const SCREEN_X = BENCH_X + 8;
const SEAT_X = BENCH_X + BENCH_W + 10;

const DEV_X = 266;
const DEV_TOP = 448;
const DEV_H = 104;
const DEV_Y = 512;

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

    /* one bench for the three of them, running the length of the wall */
    {
      id: "bench",
      nameKey: "object.desk",
      kind: "decor",
      x: BENCH_X,
      y: BENCH_TOP,
      render: { className: "office-bench", bar: { width: BENCH_W, height: BENCH_H } },
      behaviors: [],
    },
    ...[
      { id: "machineA", y: STATION_Y[0], labelKey: "office.runA" },
      { id: "machineB", y: STATION_Y[1], labelKey: "office.runB" },
      { id: "machineC", y: STATION_Y[2], labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: SCREEN_X,
      // standing on the bench top, foot on the line the seat is level with
      y: m.y - 26,
      z: 2,
      render: { className: "office-crt-side", bar: { width: 22, height: 26 } },
      behaviors: [
        { t: "blocker" as const, radius: 24 },
        { t: "station" as const, radius: 54, labelKey: m.labelKey },
      ],
    })),
    /* the seats, pulled up on the room side of the bench, facing the screens */
    ...STATION_Y.map((y, i) => ({
      id: `chair${i}`,
      nameKey: "object.chair",
      kind: "decor" as const,
      x: SEAT_X,
      y: y + 12,
      render: { prop: { id: "chairSide" as const, scale: 1.4 } },
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
      y: DEV_TOP,
      render: { className: "office-bench", bar: { width: BENCH_W, height: DEV_H } },
      behaviors: [],
    },
    {
      /* dressing only: no station behaviour, so it offers nothing to activate */
      id: "devCrt",
      nameKey: "object.devCrt",
      kind: "decor",
      x: DEV_X + 8,
      y: DEV_Y - 26,
      z: 3,
      render: { className: "office-crt-side", bar: { width: 22, height: 26 } },
      behaviors: [],
    },
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: DEV_X + BENCH_W + 10,
      y: DEV_Y + 12,
      z: 1,
      facing: "left",
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
      x: 150,
      y: 158,
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
      x: 238,
      y: 182,
      render: { prop: { id: "bookshelf" as const, scale: 1.4 } },
      behaviors: [{ t: "blocker", radius: 24 }],
    },
    {
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 300,
      y: 300,
      render: { prop: { id: "crate" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 300,
      y: 352,
      render: { prop: { id: "barrel" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 210,
      y: 392,
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
