import type { ActorSpec, SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/** the wall band along the top; everything below it is walkable floor */
const WALL_H = 110;

/**
 * A workstation is read left to right: screen, desk, seat. The desk centre is
 * the anchor, and everything else is an offset from it — the screen's foot
 * lands on the desk slab rather than among its legs, and the seat comes up to
 * the right-hand edge instead of standing off it.
 *
 * The three of them sit left of centre in their own third of the room, because
 * the seat hangs off the right and the pair has to look centred, not the desk.
 */
const DESKS = [52, 170, 288];
const SCREEN_DX = -24;
const SEAT_DX = 34;

/** the developer's desk, a tile lower than it used to sit */
const DEV_X = 280;
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

    /*
     * Three test machines, each turned side-on.
     *
     * The screen used to sit square against the wall, which puts whoever uses
     * it below the desk facing away from us — and the one chair drawn from
     * behind reads as a ladder. Turning the station sideways asks nothing of
     * the art that the art cannot do: monitor on the left of the desk, chair
     * pulled up on the right facing left, and the side view of a chair is the
     * one this pack draws well.
     */
    ...[
      { id: "machineA", x: DESKS[0], labelKey: "office.runA" },
      { id: "machineB", x: DESKS[1], labelKey: "office.runB" },
      { id: "machineC", x: DESKS[2], labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      // the desk slab runs from y 81 to about 105 and its legs below that, so
      // the screen sits with its foot on 105 — any lower and it reads as a set
      // pushed off the desk onto the floor beside it
      x: m.x + SCREEN_DX,
      y: WALL_H - 31,
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
    /* the seat, pulled up on the right of the desk and facing the screen */
    ...DESKS.map((x, i) => ({
      id: `chair${i}`,
      nameKey: "object.chair",
      kind: "decor" as const,
      x: x + SEAT_DX,
      y: WALL_H + 18,
      render: { prop: { id: "chairSide" as const, scale: 1.4 } },
      behaviors: [],
    })),

    /*
     * The developer, at a station laid out like the other three: screen on the
     * left of the desk, and the person in the seat's place on the right,
     * turned towards it. Standing above their own monitor facing the camera
     * made them the one person in the room not looking at any work.
     */
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: DEV_X + SEAT_DX,
      y: DEV_Y - 8,
      z: 1,
      facing: "left",
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
      x: DEV_X + SCREEN_DX,
      y: DEV_Y - 41 + 25 - 26,
      z: 3,
      render: { className: "office-crt-back", bar: { width: 30, height: 26 } },
      behaviors: [],
    },
    {
      id: "devDesk",
      nameKey: "object.desk",
      kind: "decor",
      x: DEV_X,
      y: DEV_Y,
      render: { prop: { id: "desk" as const, scale: 1.4 } },
      behaviors: [],
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
      y: 330,
      render: { prop: { id: "bookshelf" as const, scale: 1.4 } },
      behaviors: [{ t: "blocker", radius: 24 }],
    },
    {
      id: "crate",
      nameKey: "object.crate",
      kind: "decor",
      x: 44,
      y: 566,
      render: { prop: { id: "crate" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrel",
      nameKey: "object.barrel",
      kind: "decor",
      x: 84,
      y: 572,
      render: { prop: { id: "barrel" as const, scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "rug",
      nameKey: "object.rug",
      kind: "decor",
      x: 180,
      y: 430,
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
