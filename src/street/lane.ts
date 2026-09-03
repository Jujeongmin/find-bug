import type { SceneSpec } from "../engine/types";
import { streetActor } from "./scene";
import { front, solid } from "./build";
import { MUTTERS } from "./passers";

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
    ...front("neighbour", { left: 5, mid: 6, right: 7 }, 5, 2, 0, 112, 6, 2.46),
    ...front("neighbourEave", { left: 9, mid: 10, right: 11 }, 2, 1, 0, 33, 6, 2.46),
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
    ...front("houseWall", { left: 1, mid: 2, right: 3 }, 5, 2, 90, 360, 4, 2.8, 1),
    ...front("houseRoof", { left: 0, mid: 2, right: 1 }, 0, 2, 90, 270, 4, 2.8),
    ...solid("house", 91, 272, 178, 88),
    ...[135, 225].map((x, i) => ({
      id: `houseWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 330,
      z: 2,
      render: {
        sprite: { sheet: "city" as const, col: 25, row: 16, scale: 1.8 },
      },
      behaviors: [],
    })),
    {
      /*
       * Your own door, and the game's own door art rather than the sheet's.
       *
       * The pack's doors and its windows are the same panel in two sizes, so a
       * door drawn from it read as a third window — and every other door in
       * this game is this one. It still takes the space bar: a door you can
       * fall through is a door you leave by accident.
       */
      id: "frontDoor",
      nameKey: "object.frontDoor",
      kind: "sprite",
      x: 180,
      y: 360,
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
      x: 286,
      y: 596,
      z: 1,
      render: {
        // two of the sheet's parasols over their table: a tent that goes up
        // in the evening and comes down again, which is what it is
        sprite: { sheet: "city", col: 34, row: 14, spanX: 2, spanY: 2, scale: 2.6 },
        // the entity box is the sprite: the light hangs in the middle of it
        glow: { radius: 96, offsetX: 42, offsetY: 56 },
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
      render: { actor: streetActor("personC") },
      behaviors: [
        { t: "blocker", radius: 16 },
        { t: "station", radius: 46, labelKey: "street.talk" },
        // the strip between the house and the trees, which is as far as
        // somebody who is not going anywhere goes
        { t: "wander", speed: 40, minX: 44, maxX: 150, minY: 380, maxY: 556, pause: 4 },
        { t: "mutter", keys: MUTTERS.c, every: 19, dwell: 3.5 },
      ],
    },

    /* what a street of houses has that a street of offices does not */
    /*
     * The block's trees, in full.
     *
     * The sheet draws a tree in two pieces — the crown on one row, the leaves
     * and trunk on the next — and taking only the lower tile left a bush on a
     * stick with its top cut off. Both rows, so what stands there is a tree.
     */
    ...[
      { id: "tree1", x: 36, y: 190 },
      { id: "tree2", x: 36, y: 574 },
    ].map((t) => ({
      id: t.id,
      nameKey: `object.${t.id}`,
      kind: "decor" as const,
      x: t.x,
      y: t.y,
      render: {
        sprite: { sheet: "city" as const, col: 33, row: 10, spanY: 2, scale: 2.6 },
        shadow: { offsetX: 10, width: 30 },
      },
      behaviors: [{ t: "blocker" as const, radius: 22 }],
    })),
    ...[
      // clear of the gap, so the way to the road is never the thing you are
      // walking round
      { id: "lane0", x: 218, y: 178 },
      { id: "lane1", x: 26, y: 346 },
    ].map((l) => ({
      id: l.id,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x: l.x,
      y: l.y,
      render: {
        className: "street-lamp",
        sprite: { sheet: "city" as const, col: 5, row: 16, spanY: 2, scale: 2.2 },
        glow: { radius: 80, offsetX: 18, offsetY: 12 },
      },
      behaviors: [{ t: "blocker" as const, radius: 12 }],
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

