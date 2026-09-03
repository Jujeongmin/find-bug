import type { ObjectSpec, SceneSpec } from "../engine/types";
import { streetActor } from "./scene";

/**
 * The block the flat is on.
 *
 * The walk to work used to be one screen with the house pinned to the bottom
 * edge and the office to the top, which made "leaving home" and "arriving at
 * work" the same three seconds of held arrow key. It is two places now: this
 * one, where you live, and the office street at the other end of the main
 * road.
 *
 * The house stands in the middle of it rather than against an edge, because
 * that is what coming out of your own front door looks like — the building
 * behind you and the block around it. The way out is the gap at the top right,
 * where the neighbours' terrace ends and the main road begins, and it is taken
 * by walking into it: a street corner is not a thing you press.
 */

/** the drawn face of a building, in blocking slices */
const wall = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  slices: number,
  className: string
): ObjectSpec[] => {
  const sw = w / slices;
  return Array.from({ length: slices }, (_, i) => ({
    id: `${id}${i}`,
    nameKey: `object.${id}`,
    kind: "decor" as const,
    x: x + i * sw,
    y,
    render: { className, bar: { width: sw, height: h } },
    // the slices overlap, so the face blocks as one wall rather than as a row
    // of posts with the gaps between them walkable
    behaviors: [{ t: "blocker" as const, radius: h / 2 }],
  }));
};

export const laneScene: SceneSpec = {
  id: "lane",
  nameKey: "lane.name",
  introKey: "lane.intro",
  backgroundClass: "lane-ground",
  counters: [],
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 424,
      z: 3,
      render: { actor: streetActor() },
      behaviors: [{ t: "playerTopDown", speed: 150, minY: 116, maxY: 604 }],
    },

    /* the main road across the top: the way out of the block */
    {
      id: "mainRoad",
      nameKey: "object.road",
      kind: "decor",
      x: 0,
      y: 0,
      render: { className: "lane-road", bar: { width: 360, height: 44 } },
      behaviors: [],
    },
    {
      /* the gap in the terrace, and the only way through to the road. Walked
         into rather than pressed — see the station's `auto` */
      id: "toStreet",
      nameKey: "object.crossing",
      kind: "sprite",
      x: 240,
      y: 44,
      render: { className: "lane-crossing", bar: { width: 120, height: 40 } },
      behaviors: [
        { t: "station", radius: 84, labelKey: "lane.toStreet", auto: true },
      ],
    },

    /* the neighbours, who are the reason the road is only reachable one way */
    {
      id: "neighbourRoof",
      nameKey: "object.neighbour",
      kind: "decor",
      x: 0,
      y: 22,
      render: { className: "lane-roof", bar: { width: 236, height: 26 } },
      behaviors: [],
    },
    ...wall("neighbour", 0, 48, 236, 64, 4, "lane-house"),
    ...[26, 150].map((x, i) => ({
      id: `neighbourWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 62,
      z: 1,
      render: { className: "office-window", bar: { width: 34, height: 26 } },
      behaviors: [],
    })),

    /* and your own, in the middle of the block */
    {
      id: "houseRoof",
      nameKey: "object.house",
      kind: "decor",
      x: 84,
      y: 208,
      render: { className: "lane-roof", bar: { width: 192, height: 46 } },
      behaviors: [],
    },
    ...wall("house", 96, 252, 168, 96, 3, "lane-house"),
    ...[116, 212].map((x, i) => ({
      id: `houseWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 278,
      z: 1,
      render: { className: "office-window", bar: { width: 32, height: 26 } },
      behaviors: [],
    })),
    {
      /* your own door still takes the space bar: a door you can fall through
         is a door you leave by accident */
      id: "frontDoor",
      nameKey: "object.frontDoor",
      kind: "sprite",
      x: 180,
      y: 344,
      z: 2,
      render: { prop: { id: "door", scale: 1.7 } },
      behaviors: [{ t: "station", radius: 62, labelKey: "street.home" }],
    },

    /*
     * The stall, on the way home.
     *
     * It stands on this block rather than under the office windows: the last
     * thing before your own front door, which is where a tent that only opens
     * after dark belongs. It offers itself once the day is over — nobody sets
     * up at nine in the morning.
     */
    {
      id: "pocha",
      nameKey: "object.pocha",
      kind: "sprite",
      x: 274,
      y: 552,
      z: 1,
      render: {
        className: "street-pocha",
        bar: { width: 56, height: 62 },
        glow: { radius: 96, offsetX: 28, offsetY: 26 },
      },
      behaviors: [
        { t: "blocker", radius: 34 },
        { t: "station", radius: 62, labelKey: "street.pocha" },
      ],
    },

    /* a neighbour, standing where they stopped */
    {
      id: "passer2",
      nameKey: "object.passer2",
      kind: "sprite",
      x: 72,
      y: 424,
      z: 2,
      facing: "down",
      render: { actor: streetActor("worker2"), className: "street-passer p2" },
      behaviors: [
        { t: "blocker", radius: 16 },
        { t: "station", radius: 46, labelKey: "street.talk" },
      ],
    },

    /* what a street of houses has that a street of offices does not */
    ...[
      { id: "tree1", x: 36, y: 178 },
      { id: "tree2", x: 36, y: 566 },
    ].map((t) => ({
      id: t.id,
      nameKey: `object.${t.id}`,
      kind: "decor" as const,
      x: t.x,
      y: t.y,
      render: {
        sprite: { sheet: "tinytown" as const, col: 4, row: 2, scale: 3.2 },
        shadow: { offsetX: 10, width: 30 },
      },
      behaviors: [{ t: "blocker" as const, radius: 28 }],
    })),
    ...[
      // clear of the gap, so the way to the road is never the thing you are
      // walking round
      { id: "lane0", x: 214, y: 150 },
      { id: "lane1", x: 22, y: 300 },
    ].map((l) => ({
      id: l.id,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x: l.x,
      y: l.y,
      render: {
        className: "street-lamp",
        bar: { width: 8, height: 46 },
        glow: { radius: 80, offsetX: 4, offsetY: 2 },
      },
      behaviors: [{ t: "blocker" as const, radius: 14 }],
    })),
    {
      id: "binLane",
      nameKey: "object.barrel",
      kind: "decor",
      x: 58,
      y: 500,
      render: { prop: { id: "barrel", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "parcelLane",
      nameKey: "object.crate",
      kind: "decor",
      x: 116,
      y: 556,
      render: { prop: { id: "crate", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
  ],
};

