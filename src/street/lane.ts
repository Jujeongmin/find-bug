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

/**
 * The line the whole house sorts on, and why it is not the bottom of the wall.
 *
 * The wall is drawn down to 360 and a player pressed against it stops at 361,
 * because that is where the blocker ends. But a player is forty-eight pixels
 * tall and the wall is ninety, so standing at its foot their body covers more
 * than half of it — and sorted in front, that does not read as standing at a
 * front door. It reads as standing on the brick, which is how it was reported.
 *
 * So the sort line goes a body's height below the art. Anyone whose feet are
 * in the band between the wall and this is drawn behind the house, which is
 * what someone at their own front door looks like. The stall in this same file
 * has done it this way since it was written, and so has the vending machine on
 * the street; the house simply never got it.
 */
const BODY = 48;
const HOUSE_SORT = 360 + BODY;

/** the same, for the terrace along the top */
const NEIGHBOUR_SORT = 112 + BODY;

export const laneScene: SceneSpec = {
  id: "lane",
  nameKey: "lane.name",
  backgroundClass: "lane-ground",
  // the four rooms you walk around in: what covers what is decided by where
  // people are standing, not by the order the scene was written
  ySort: true,
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
    ...front("neighbour", { left: 5, mid: 6, right: 7 }, 5, 2, 0, 112, 6, 2.46).map(
      (o) => ({ ...o, sortY: NEIGHBOUR_SORT })
    ),
    ...front("neighbourEave", { left: 9, mid: 10, right: 11 }, 2, 1, 0, 33, 6, 2.46).map(
      (o) => ({ ...o, sortY: NEIGHBOUR_SORT })
    ),
    ...solid("neighbourWall", 0, 34, 236, 78),
    ...[46, 164].map((x, i) => ({
      id: `neighbourWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 96,
      sortY: NEIGHBOUR_SORT,
      z: 2,
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
    /*
     * Sorted a body below the wall's foot, both halves of it.
     *
     * front() draws flat scenery by default — z: 0, out of the y-sort — which
     * is right for every other run in this game, because they are all the far
     * wall of a room and nobody stands behind those. This one is a building in
     * the middle of the block: the strip between it and the trees is walkable,
     * the player goes up there, and on the flat layer they were drawn on top
     * of their own house.
     *
     * The roof takes the wall's line rather than its own. A roof sorted where
     * it is drawn would let somebody standing at the side of the house pass in
     * front of it, and a roof is the one part of a building nothing gets in
     * front of.
     */
    ...front("houseWall", { left: 1, mid: 2, right: 3 }, 5, 2, 90, 360, 4, 2.8).map(
      (o) => ({ ...o, sortY: HOUSE_SORT })
    ),
    ...front("houseRoof", { left: 0, mid: 2, right: 1 }, 0, 2, 90, 270, 4, 2.8).map(
      (o) => ({ ...o, sortY: HOUSE_SORT })
    ),
    /*
     * Stopped a body short of the wall, not at it.
     *
     * The wall is drawn ninety pixels tall and a player is forty-eight, so a
     * player standing at its foot has their whole body inside its height.
     * Sorted in front they are standing on the brick; sorted behind they are
     * gone altogether. Neither is somebody at their own front door, and no
     * sort line fixes it, because the problem is that they are there at all.
     *
     * So the block runs a body further down than the art. The pavement it
     * takes is the pavement a person would be standing on if they were
     * against the wall, and with it gone there is nowhere to stand that
     * overlaps the house. The door still answers from here: its station
     * reaches sixty-two and the threshold is forty-nine away.
     */
    ...solid("house", 91, 272, 178, 88 + BODY),
    ...[135, 225].map((x, i) => ({
      id: `houseWindow${i}`,
      nameKey: "object.window",
      kind: "decor" as const,
      x,
      y: 330,
      // set into the wall, so they take the wall's line: they are in it, not
      // standing in front of it half way up
      sortY: HOUSE_SORT,
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
      // on the wall's line, not its own: a door set into a wall is drawn
      // with it, and a player at the threshold is behind both
      sortY: HOUSE_SORT,
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
      // a body's height below the parasols: anyone standing at the counter is
      // standing in front of them, and drawn behind
      sortY: 644,
      z: 1,
      render: {
        // two of the sheet's parasols over their table: a tent that goes up
        // in the evening and comes down again, which is what it is
        sprite: { sheet: "city", col: 34, row: 14, spanX: 2, spanY: 2, scale: 2.6 },
        // the entity box is the sprite: the light hangs in the middle of it
        glow: { radius: 96, offsetX: 42, offsetY: 56 },
      },
      behaviors: [
        /*
         * What the tent actually covers, which is not its cell.
         *
         * The two-by-two block it is drawn from has seven transparent rows
         * along the top — the parasols do not reach the ceiling of their own
         * tiles — so a box the size of the cell walled off eighteen pixels of
         * empty pavement above the canopy. Measured off the sheet: eighty-three
         * across and sixty-five down.
         *
         * It runs ten further down than that, to the bottom of where anyone
         * can walk. The tent stands eight pixels off the end of the block, and
         * eight pixels is a gap somebody will squeeze through — behind the
         * canopy, because that is how it sorts, so the walk reads as going
         * straight through the stall.
         */
        { t: "blocker", radius: 34, box: { w: 83, h: 75, dy: -27.5 } },
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
      // the post is what you walk into; the arms at the top are over your head
      sortY: l.y + 48,
      render: {
        className: "street-lamp",
        sprite: { sheet: "city" as const, col: 5, row: 16, spanY: 2, scale: 2.2 },
        glow: { radius: 80, offsetX: 18, offsetY: 12 },
      },
      behaviors: [
        { t: "blocker" as const, radius: 12, box: { w: 10, h: 70, dy: -35 } },
      ],
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

