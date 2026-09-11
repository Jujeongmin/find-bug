import type { ActorSpec, SceneSpec } from "../engine/types";
import { footPadPx, type SheetId } from "../engine/sheets";
import { MUTTERS } from "./passers";
import { front, glassDoor } from "./build";

/**
 * The walk's character sheet, shared with the block at the other end of it:
 * one commute, two screens, and a player who should not change shoes between
 * them.
 */
export const streetActor = (sheet: SheetId = "worker"): ActorSpec => ({
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
 * How far the player's art has to come down to stand where it stands.
 *
 * Read off the sheet rather than typed in, so changing the character or its
 * scale carries it. Every screen the player walks around on uses this one
 * number: it is the player who gets walked into walls, and the player whose
 * feet the wall has to meet.
 */
export const PLAYER_FOOT_PAD = footPadPx(
  streetActor().sheet,
  streetActor().scale
);

/**
 * The office street.
 *
 * Sleeping used to put you at your desk. The commute is where the night before
 * gets paid for: the office clock is already running, so a late start and a
 * slow walk are the same currency, and the coffee stand sells alertness for
 * minutes you may not have.
 *
 * The house used to be a strip of brick along the bottom of this same screen,
 * which made the walk to work a second and a half. Home is its own block now,
 * one screen back down the road — this end has the office on it, and what
 * belongs outside an office: the machine, the sign, and everyone else who is
 * already late.
 */
export const streetScene: SceneSpec = {
  id: "street",
  nameKey: "street.name",
  backgroundClass: "street-ground",
  // the four rooms you walk around in: what covers what is decided by where
  // people are standing, not by the order the scene was written
  ySort: true,
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 540,
      z: 3,
      render: { actor: streetActor(), footPad: PLAYER_FOOT_PAD },
      behaviors: [{ t: "playerTopDown", speed: 150, minY: 186, maxY: 566 }],
    },

    /*
     * The office block across the top, with the way in.
     *
     * Three units of the sheet's glass curtain wall over its shopfront band —
     * what the studio rents two floors of. Drawn rather than tinted: the block
     * used to be a repeating brick texture with two pale rectangles on it for
     * windows, which is a wall, not an office.
     */
    ...front("blockEave", { left: 9, mid: 10, right: 11 }, 2, 1, 0, 40, 9, 2.5),
    ...front("blockGlass", { left: 13, mid: 14, right: 15 }, 6, 2, 0, 120, 9, 2.5),
    ...front("blockFront", { left: 13, mid: 14, right: 15 }, 4, 1, 0, 160, 9, 2.5),
    {
      /* the sign over the door: a grub and a name, which is all a small studio
         ever has on the front of its building */
      id: "sign",
      nameKey: "object.sign",
      kind: "decor",
      x: 20,
      y: 126,
      z: 1,
      render: { className: "street-sign", bar: { width: 92, height: 26 } },
      behaviors: [],
    },
    /*
     * The way in.
     *
     * A cottage door on a glass front, hung a few pixels below the building it
     * was cut into. The sheet has the door this building is drawn for: two
     * glass leaves, three tiles tall, standing on the shopfront band.
     */
    ...glassDoor("officeDoor", 180, 160, 2.2, [
      { t: "station", radius: 58, labelKey: "street.enter" },
    ]),

    /*
     * Other people on the same walk, standing where they stopped.
     *
     * The pack has two characters in it and both are spoken for — one is the
     * player, the other is the developer — so the rest of the street is drawn
     * from palette-swapped sheets of the first (scripts/recolor.ts). A shirt,
     * a pair of trousers and a head of hair each, which is all a passer-by has
     * to say for itself before it opens its mouth.
     */
    ...[
      // clear of the vending machine: standing beside it, this one took the
      // prompt that machine is the only reason to walk over there for
      {
        id: "passer0",
        sheet: "personA" as const,
        x: 152,
        y: 300,
        facing: "left" as const,
        who: "a",
        box: { minX: 96, maxX: 200, minY: 236, maxY: 430 },
      },
      {
        id: "passer1",
        sheet: "personB" as const,
        x: 262,
        y: 300,
        facing: "down" as const,
        who: "b",
        // their own stretch of pavement: two people wandering the same box
        // spend the morning walking through each other
        box: { minX: 224, maxX: 316, minY: 236, maxY: 430 },
      },
    ].map((c) => ({
      id: c.id,
      nameKey: `object.${c.id}`,
      kind: "sprite" as const,
      x: c.x,
      y: c.y,
      z: 2,
      facing: c.facing,
      render: { actor: streetActor(c.sheet) },
      behaviors: [
        { t: "blocker" as const, radius: 16 },
        { t: "station" as const, radius: 46, labelKey: "street.talk" },
        // slower than the player, and standing still more of the time than
        // walking: they are waiting for the day to start, not going anywhere
        { t: "wander" as const, speed: 44, ...c.box, pause: 3 },
        { t: "mutter" as const, keys: MUTTERS[c.who], every: 17, dwell: 3.5 },
      ],
    })),

    /* the vending machine: alertness, paid for in minutes */
    {
      id: "coffee",
      nameKey: "object.coffeeStand",
      kind: "sprite",
      x: 6,
      y: 300,
      z: 1,
      /*
       * Its foot, and then some.
       *
       * A bar's own foot is its top-left plus its height — 368 here, the line
       * the art stops on. Sorting on that line puts a player standing one
       * pixel below it in front of the machine, and a player is forty-eight
       * pixels tall: their body covers the lower half of a machine they are
       * standing beside, which reads as standing in it.
       *
       * So the line it sorts on is a body's height below the art. Anyone whose
       * feet are inside that band is drawn behind the machine, which is where
       * somebody at a vending machine is.
       */
      sortY: 412,
      render: {
        className: "street-vending",
        bar: { width: 48, height: 68 },
        glow: { radius: 74, offsetX: 24, offsetY: 30 },
      },
      behaviors: [
        /*
         * The machine is a rectangle and blocks like one: a disc over the
         * middle of it let the player walk up the outside and stand in the
         * art. The box is the whole of what is drawn — the body, and the cup
         * sign standing on top of it, which is why it reaches above the bar:
         * the box is measured from the bar's middle, so covering fourteen
         * pixels of sign above costs the same below, where the machine's own
         * drop shadow is anyway.
         */
        { t: "blocker", radius: 34, box: { w: 48, h: 94 } },
        { t: "station", radius: 62, labelKey: "street.coffee" },
      ],
    },

    /*
     * The way back down the road, where the flat is. Walked into rather than
     * pressed: the map's edges are corners, not doors.
     *
     * In slices, because a station is a circle and this is three hundred and
     * sixty pixels of kerb — one circle over the middle of it leaves both
     * corners walkable and the way home missable by hugging a wall.
     */
    {
      /* the kerb itself, drawn in one piece: five painted ones leave five
         hairlines wherever the field is scaled to a fraction of a pixel */
      id: "kerb",
      nameKey: "object.alley",
      kind: "decor" as const,
      x: 0,
      y: 596,
      render: { className: "street-alley", bar: { width: 360, height: 44 } },
      behaviors: [],
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      id: i === 2 ? "toLane" : `toLane${i}`,
      nameKey: "object.alley",
      kind: "sprite" as const,
      x: i * 72,
      y: 596,
      render: { className: "edge-zone", bar: { width: 72, height: 44 } },
      behaviors: [
        { t: "station" as const, radius: 70, labelKey: "street.toLane", auto: true },
      ],
    })),

    /*
     * Street furniture, so the walk has something in it.
     *
     * The sheet's own lamp: a head with two arms on it and the post under it,
     * one tile by two. It was a grey rectangle with a rounded lozenge stuck on
     * top, which is what a lamp looks like to someone who has not looked at
     * one.
     */
    ...[
      { x: 28, y: 516 },
      { x: 330, y: 346 },
    ].map((p, i) => ({
      id: `lamp${i}`,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x: p.x,
      y: p.y,
      // the post is what you walk into; the arms at the top are over your head
      sortY: p.y + 48,
      render: {
        // the class is only the dimmer now: what it draws is the sprite
        className: "street-lamp",
        sprite: { sheet: "city" as const, col: 5, row: 16, spanY: 2, scale: 2.2 },
        // the light hangs off the head, which is at the top of the post
        glow: { radius: 80, offsetX: 18, offsetY: 12 },
      },
      behaviors: [
        { t: "blocker" as const, radius: 12, box: { w: 10, h: 70, dy: -35 } },
      ],
    })),
    /*
     * The stop nobody catches a bus from.
     *
     * The screen had an office on it and a vending machine, and everything
     * between the two was empty pavement — which reads as a corridor with a
     * door at the end rather than as the front of a building somebody works
     * in. What says "office street" is the furniture nobody looks at: a stop
     * with a bench, two trees in the pavement, a post box, a bin.
     *
     * It is scenery and stays scenery. The stop has no timetable and no bus,
     * because the commute is the walk — a way to skip it would be a way to
     * skip the part of the day the coffee is a decision about.
     *
     * All of it sits below y=440. The passers wander down to 430 and the five
     * kerb slices reach up to about 526 with the corner that takes you home,
     * so this is the one band of the pavement that is neither.
     */
    {
      id: "busStop",
      nameKey: "object.busStop",
      kind: "decor",
      x: 140,
      y: 470,
      render: {
        sprite: { sheet: "city", col: 9, row: 14, spanY: 2, scale: 2.2 },
      },
      // only the post is in the way; the sign boards are at head height
      behaviors: [{ t: "blocker", radius: 8, box: { w: 10, h: 18, dy: -9 } }],
    },
    {
      id: "busBench",
      nameKey: "object.bench",
      kind: "decor",
      x: 84,
      y: 478,
      render: {
        sprite: { sheet: "city", col: 17, row: 15, spanX: 2, scale: 2.2 },
      },
      behaviors: [{ t: "blocker", radius: 20, box: { w: 62, h: 20, dy: -10 } }],
    },
    /*
     * Two trees, and two different greens: a pavement planted with one colour
     * twice reads as the same object copied, which is what the office block
     * looked like before it was drawn properly.
     */
    ...[
      // The left of the pavement is spoken for — the machine stands from
      // 300 to 368 and the lamp post from 446 to 516 — so both go to the
      // right of the stop, where there was nothing at all.
      { id: "streetTree0", x: 205, y: 462, col: 31 },
      { id: "streetTree1", x: 292, y: 462, col: 33 },
    ].map((t) => ({
      id: t.id,
      nameKey: "object.streetTree",
      kind: "decor" as const,
      x: t.x,
      y: t.y,
      render: {
        sprite: {
          sheet: "city" as const,
          col: t.col,
          row: 10,
          spanY: 2,
          scale: 2.2,
        },
      },
      // the trunk, not the crown: walking under a tree is walking under it
      behaviors: [
        { t: "blocker" as const, radius: 9, box: { w: 12, h: 22, dy: -11 } },
      ],
    })),
    {
      id: "postBox",
      nameKey: "object.postBox",
      kind: "decor",
      x: 326,
      y: 508,
      render: {
        sprite: { sheet: "city", col: 12, row: 15, scale: 2.6 },
      },
      behaviors: [{ t: "blocker", radius: 14, box: { w: 26, h: 26, dy: -13 } }],
    },
    {
      id: "streetBin",
      nameKey: "object.bin",
      kind: "decor",
      x: 46,
      y: 430,
      render: { sprite: { sheet: "city", col: 15, row: 13, scale: 2.2 } },
      behaviors: [{ t: "blocker", radius: 13 }],
    },

      /* moved up the wall: a crate at the kerb is dressing, a crate in the
         doorway is a mistake */
    {
      id: "crateStreet",
      nameKey: "object.crate",
      kind: "decor",
      x: 332,
      y: 232,
      render: { prop: { id: "crate", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
    {
      id: "barrelStreet",
      nameKey: "object.barrel",
      kind: "decor",
      x: 332,
      y: 278,
      render: { prop: { id: "barrel", scale: 1.3 } },
      behaviors: [{ t: "blocker", radius: 18 }],
    },
  ],
  counters: [],
};
