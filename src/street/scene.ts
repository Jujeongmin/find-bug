import type { ActorSpec, SceneSpec } from "../engine/types";
import type { SheetId } from "../engine/sheets";
import { front } from "./build";

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
  introKey: "street.intro",
  backgroundClass: "street-ground",
  objects: [
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 540,
      z: 3,
      render: { actor: streetActor() },
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
      x: 134,
      y: 62,
      z: 1,
      render: { className: "street-sign", bar: { width: 92, height: 26 } },
      behaviors: [],
    },
    {
      id: "officeDoor",
      nameKey: "object.officeDoor",
      kind: "sprite",
      x: 180,
      y: 164,
      z: 2,
      // the game's own door, here as everywhere: the sheet's is a window with
      // taller panes
      render: { prop: { id: "door", scale: 1.9 } },
      behaviors: [{ t: "station", radius: 58, labelKey: "street.enter" }],
    },

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
      { id: "passer0", sheet: "personA" as const, x: 152, y: 300, facing: "left" as const },
      { id: "passer1", sheet: "personB" as const, x: 262, y: 300, facing: "down" as const },
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
      render: {
        className: "street-vending",
        bar: { width: 48, height: 68 },
        glow: { radius: 74, offsetX: 24, offsetY: 30 },
      },
      behaviors: [
        { t: "blocker", radius: 34 },
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

    /* street furniture, so the walk has something in it */
    ...[24, 326].map((x, i) => ({
      id: `lamp${i}`,
      nameKey: "object.lamp",
      kind: "decor" as const,
      x,
      y: i === 0 ? 470 : 300,
      render: {
        className: "street-lamp",
        bar: { width: 8, height: 46 },
        glow: { radius: 80, offsetX: 4, offsetY: 2 },
      },
      behaviors: [{ t: "blocker" as const, radius: 14 }],
    })),
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
