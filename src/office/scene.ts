import type { SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/** the room is wider and taller than the 360x640 viewport, so the camera moves */
export const OFFICE_W = 720;
export const OFFICE_H = 900;

/** the wall band along the top; everything below it is walkable floor */
const WALL_H = 140;

const actor = (sheet: "worker" | "worker2") =>
  ({
    sheet,
    rows: { down: 0, right: 2, up: 4, left: 6 },
    idle: 0,
    walk: [1, 2, 3, 4],
    fps: 8,
    scale: 1.5,
  }) as const;

/**
 * The QA floor. A scene like any other, which is the point: the same engine
 * that runs the builds under test runs the room you walk around in, so a desk
 * blocks you the way a tree does.
 *
 * The room is deliberately larger than one screen. Walking is the budget — the
 * clock runs while you cross the floor — so the machine in the far corner
 * genuinely costs more of the day than the one by the door.
 */
export const officeScene: SceneSpec = {
  id: "office",
  nameKey: "office.name",
  introKey: "office.intro",
  backgroundClass: "office-floor",
  world: { w: OFFICE_W, h: OFFICE_H },
  counters: [],
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 360,
      y: 620,
      z: 3,
      render: { actor: actor("worker") },
      behaviors: [
        { t: "playerTopDown", speed: 130, minY: WALL_H + 30, maxY: OFFICE_H - 30 },
      ],
    },

    /* the wall the desks stand against */
    {
      id: "wall",
      nameKey: "object.wall",
      kind: "decor",
      x: 0,
      y: 0,
      render: { className: "office-wall", bar: { width: OFFICE_W, height: WALL_H } },
      behaviors: [],
    },
    ...[150, 570].map((x, i) => ({
      id: `window${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 118,
      render: { prop: { id: "windowPane" as const, scale: 2 } },
      behaviors: [],
    })),

    /* test machines, spread far enough apart that the walk is felt */
    ...[
      { id: "machineA", x: 90, labelKey: "office.runA" },
      { id: "machineB", x: 300, labelKey: "office.runB" },
      { id: "machineC", x: 620, labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x - 17,
      y: WALL_H - 24,
      z: 2,
      render: { className: "office-crt", bar: { width: 34, height: 30 } },
      behaviors: [
        { t: "blocker" as const, radius: 30 },
        { t: "station" as const, radius: 62, labelKey: m.labelKey },
      ],
    })),

    /* desks under the machines */
    ...[90, 300, 620].map((x, i) => ({
      id: `desk${i}`,
      nameKey: "object.desk",
      kind: "decor" as const,
      x,
      y: WALL_H + 14,
      render: { prop: { id: "desk" as const, scale: 1.6 } },
      behaviors: [],
    })),

    /* the developer, across the room from the machines */
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: 640,
      y: 780,
      z: 2,
      render: { actor: actor("worker2") },
      behaviors: [
        { t: "blocker", radius: 24 },
        { t: "station", radius: 58, labelKey: "office.talkDev" },
      ],
    },
    {
      id: "devDesk",
      nameKey: "object.desk",
      kind: "decor",
      x: 640,
      y: 812,
      render: { prop: { id: "desk" as const, scale: 1.6 } },
      behaviors: [],
    },

    /* room dressing, and something to walk around */
    {
      id: "bookshelf",
      nameKey: "object.cabinet",
      kind: "decor",
      x: 60,
      y: 470,
      render: { prop: { id: "bookshelf" as const, scale: 1.6 } },
      behaviors: [{ t: "blocker", radius: 26 }],
    },
    {
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 470,
      y: 430,
      render: { prop: { id: "crate" as const, scale: 1.5 } },
      behaviors: [{ t: "blocker", radius: 20 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 512,
      y: 448,
      render: { prop: { id: "barrel" as const, scale: 1.5 } },
      behaviors: [{ t: "blocker", radius: 20 }],
    },
    {
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 250,
      y: 640,
      z: 0,
      render: { prop: { id: "rug" as const, scale: 1.4 } },
      behaviors: [],
    },
    {
      id: "chair",
      nameKey: "object.chair",
      kind: "decor",
      x: 300,
      y: 234,
      render: { prop: { id: "chair" as const, scale: 1.5 } },
      behaviors: [],
    },

    /* the door home, deliberately far from the machines */
    {
      id: "exitDoor",
      nameKey: "object.exitDoor",
      kind: "sprite",
      x: 360,
      y: OFFICE_H - 6,
      z: 1,
      render: { prop: { id: "door" as const, scale: 1.6 } },
      behaviors: [{ t: "station", radius: 56, labelKey: "office.goHome" }],
    },
  ],
};
