import type { ActorSpec, SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/** the wall band along the top; everything below it is walkable floor */
const WALL_H = 110;

const actor = (sheet: "worker" | "worker2"): ActorSpec => ({
  sheet,
  rows: { down: 0, right: 2, up: 4, left: 6 },
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
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 400,
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
    ...[126, 234].map((x, i) => ({
      id: `window${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 74,
      render: { prop: { id: "windowPane" as const, scale: 1.6 } },
      behaviors: [],
    })),

    /* three test machines on their desks */
    ...[
      { id: "machineA", x: 62, labelKey: "office.runA" },
      { id: "machineB", x: 180, labelKey: "office.runB" },
      { id: "machineC", x: 298, labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x - 15,
      y: WALL_H - 22,
      z: 2,
      render: { className: "office-crt", bar: { width: 30, height: 26 } },
      behaviors: [
        { t: "blocker" as const, radius: 26 },
        { t: "station" as const, radius: 54, labelKey: m.labelKey },
      ],
    })),
    ...[62, 180, 298].map((x, i) => ({
      id: `desk${i}`,
      nameKey: "object.desk",
      kind: "decor" as const,
      x,
      y: WALL_H + 12,
      render: { prop: { id: "desk" as const, scale: 1.4 } },
      behaviors: [],
    })),
    ...[62, 180, 298].map((x, i) => ({
      id: `chair${i}`,
      nameKey: "object.chair",
      kind: "decor" as const,
      x,
      y: WALL_H + 46,
      render: { prop: { id: "chair" as const, scale: 1.3 } },
      behaviors: [],
    })),

    /* the developer you hand confirmed defects to */
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: 300,
      y: 424,
      z: 1,
      render: { actor: actor("worker2") },
      behaviors: [
        { t: "blocker", radius: 22 },
        { t: "station", radius: 52, labelKey: "office.talkDev" },
      ],
    },
    {
      /* dressing only: no station behaviour, so it offers nothing to activate */
      id: "devCrt",
      nameKey: "object.devCrt",
      kind: "decor",
      x: 285,
      y: 432,
      z: 3,
      render: { className: "office-crt-back", bar: { width: 30, height: 26 } },
      behaviors: [],
    },
    {
      id: "devDesk",
      nameKey: "object.desk",
      kind: "decor",
      x: 300,
      y: 480,
      render: { prop: { id: "desk" as const, scale: 1.4 } },
      behaviors: [],
    },

    /* dressing, and something to walk around */
    {
      id: "bookshelf",
      nameKey: "object.cabinet",
      kind: "decor",
      x: 42,
      y: 300,
      render: { prop: { id: "bookshelf" as const, scale: 1.4 } },
      behaviors: [{ t: "blocker", radius: 24 }],
    },
    {
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 322,
      y: 268,
      render: { prop: { id: "crate" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 322,
      y: 316,
      render: { prop: { id: "barrel" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 168,
      y: 400,
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
