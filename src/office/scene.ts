import type { SceneSpec } from "../engine/types";

/** the three machines today's builds are queued on */
export const MACHINES = ["machineA", "machineB", "machineC"] as const;
export type MachineId = (typeof MACHINES)[number];

/**
 * The QA floor. It is a scene like any other, which is the point: the same
 * engine that runs the builds under test runs the room you walk around in, so
 * a desk blocks you the way a tree does and a machine is approached the way
 * anything else is.
 *
 * Walking is the budget. A build you can reach in two steps costs less of the
 * day than one across the room, so where things sit is a design decision
 * rather than decoration.
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
      y: 430,
      z: 3,
      render: {
        actor: {
          sheet: "worker",
          rows: { down: 0, right: 2, up: 4, left: 6 },
          idle: 0,
          walk: [1, 2, 3, 4],
          fps: 8,
          scale: 1.5}
      },
      behaviors: [{ t: "playerTopDown", speed: 120, minY: 190, maxY: 600 }]},

    /* the wall the desks stand against */
    {
      id: "wall",
      nameKey: "object.wall",
      kind: "decor",
      x: 0,
      y: 120,
      render: { className: "office-wall", bar: { width: 360, height: 70 } },
      behaviors: []},

    /* three test machines, each holding one build to verify */
    ...[
      { id: "machineA", x: 68, labelKey: "office.runA" },
      { id: "machineB", x: 180, labelKey: "office.runB" },
      { id: "machineC", x: 292, labelKey: "office.runC" },
    ].map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x - 17,
      y: 176,
      z: 2,
      render: { className: "office-crt", bar: { width: 34, height: 30 } },
      behaviors: [
        { t: "blocker" as const, radius: 26 },
        { t: "station" as const, radius: 62, labelKey: m.labelKey },
      ]})),

    /* desks under the machines */
    ...[68, 180, 292].map((x, i) => ({
      id: `desk${i}`,
      nameKey: "object.desk",
      kind: "decor" as const,
      x,
      y: 214,
      render: { prop: { id: "desk" as const, scale: 1.6 } },
      behaviors: []})),

    /* the developer you hand confirmed defects to */
    {
      id: "dev",
      nameKey: "object.dev",
      kind: "sprite",
      x: 316,
      y: 470,
      z: 2,
      render: {
        actor: {
          sheet: "worker2",
          rows: { down: 0, right: 2, up: 4, left: 6 },
          idle: 0,
          walk: [1, 2, 3, 4],
          fps: 8,
          scale: 1.5}
      },
      behaviors: [
        { t: "blocker", radius: 22 },
        { t: "station", radius: 58, labelKey: "office.talkDev" },
      ]},

    /* filing cabinet, purely to break up the room */
    {
      id: "cabinet",
      nameKey: "object.cabinet",
      kind: "decor",
      x: 44,
      y: 470,
      render: { prop: { id: "bookshelf" as const, scale: 1.5 } },
      behaviors: [{ t: "blocker", radius: 22 }]},

    /* the door home */
    {
      id: "exitDoor",
      nameKey: "object.exitDoor",
      kind: "sprite",
      x: 180,
      y: 604,
      z: 1,
      render: { prop: { id: "door" as const, scale: 1.5 } },
      behaviors: [{ t: "station", radius: 56, labelKey: "office.goHome" }]},
  ]};
