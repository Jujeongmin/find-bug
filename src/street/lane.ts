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

/**
 * A box the player cannot walk into, out of overlapping circles.
 *
 * Blocking is round — one radius per object — and buildings are not. A row of
 * circles whose ends land exactly on the box's edges blocks the whole face
 * without the invisible wall a single fat circle leaves sticking out of it.
 * The objects are transparent: what the player sees is the sprite drawn over
 * them.
 */
const solid = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): ObjectSpec[] => {
  const r = h / 2;
  const n = Math.max(2, Math.ceil((w - 2 * r) / r) + 1);
  return Array.from({ length: n }, (_, i) => {
    const cx = x + r + ((w - 2 * r) * i) / (n - 1);
    return {
      id: `${id}${i}`,
      nameKey: `object.${id}`,
      kind: "decor" as const,
      x: cx - 4,
      y,
      render: { className: "edge-zone", bar: { width: 8, height: h } },
      behaviors: [{ t: "blocker" as const, radius: r }],
    };
  });
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
      render: { className: "lane-road", bar: { width: 360, height: 30 } },
      behaviors: [],
    },
    {
      /* the gap in the terrace, and the only way through to the road. Walked
         into rather than pressed — see the station's `auto` */
      id: "toStreet",
      nameKey: "object.crossing",
      kind: "sprite",
      x: 240,
      y: 30,
      render: { className: "lane-crossing", bar: { width: 120, height: 46 } },
      behaviors: [
        { t: "station", radius: 84, labelKey: "lane.toStreet", auto: true },
      ],
    },

    /*
     * The neighbours, who are the reason the road is only reachable one way.
     *
     * Two units of the sheet's grey front, side by side, which is what a
     * terrace is. No roof over them: the road is drawn beyond, and a roof deep
     * enough to read would cover it.
     */
    ...[59, 177].map((x, i) => ({
      id: `neighbour${i}`,
      nameKey: "object.neighbour",
      kind: "decor" as const,
      x,
      y: 112,
      render: {
        sprite: { sheet: "city" as const, col: 4, row: 5, spanX: 3, spanY: 2, scale: 2.46 },
      },
      behaviors: [],
    })),
    ...solid("neighbourWall", 0, 34, 236, 78),
    ...[46, 164].map((x, i) => ({
      id: `neighbourWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 96,
      z: 1,
      render: { sprite: { sheet: "city" as const, col: 25, row: 19, scale: 1.9 } },
      behaviors: [],
    })),

    /*
     * And your own, in the middle of the block.
     *
     * Drawn rather than built out of coloured bars: the roof is the sheet's
     * four-by-three corner block and the front is its brick, both taken in one
     * span each, so the tiling and the corners are the artist's rather than a
     * gradient's. Sprites hang from the bottom edge of where they are put,
     * which is why the roof sits at the top of the wall and not over it.
     */
    {
      id: "houseRoof",
      nameKey: "object.house",
      kind: "decor",
      x: 180,
      y: 270,
      render: {
        sprite: { sheet: "city", col: 0, row: 0, spanX: 3, spanY: 2, scale: 2.8 },
      },
      behaviors: [],
    },
    {
      id: "houseWall",
      nameKey: "object.house",
      kind: "decor",
      x: 180,
      y: 360,
      z: 1,
      render: {
        sprite: { sheet: "city", col: 1, row: 5, spanX: 3, spanY: 2, scale: 2.8 },
      },
      behaviors: [],
    },
    ...solid("house", 113, 282, 134, 78),
    ...[140, 220].map((x, i) => ({
      id: `houseWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 326,
      z: 2,
      render: {
        sprite: { sheet: "city" as const, col: 25, row: 16, scale: 2 },
      },
      behaviors: [],
    })),
    {
      /* your own door still takes the space bar: a door you can fall through
         is a door you leave by accident */
      id: "frontDoor",
      nameKey: "object.frontDoor",
      kind: "sprite",
      x: 180,
      y: 360,
      z: 2,
      render: { sprite: { sheet: "city", col: 25, row: 17, scale: 2.2 } },
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

