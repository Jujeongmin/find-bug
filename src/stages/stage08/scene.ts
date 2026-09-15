import type { ObjectSpec, SceneSpec } from "../../engine/types";

/**
 * Stage 8: the mine, the build that arrives in a player's second year.
 *
 * Three gates in the back wall, and a lever in front of each. Everybody knows
 * what a lever is for: you pull it and the thing in front of you opens. That
 * is the promise the crossed-wires fault breaks, the same way the drinks
 * machine's buttons do — and here the thing that answers is a gate you can
 * see lift, not a can you have to wait for.
 *
 * Everything else is the forage loop moved underground, because a second
 * year should not have to teach its verbs again: walk onto a chest for gold,
 * keep off the spiders. The two ore barrels on the rails are the moving parts,
 * so the floor is never safe to cross on memory.
 *
 * The art is the dungeon sheet, which the game had loaded since the start and
 * never used. It has no lever and no mine cart: the levers are the platformer
 * pack's, drawn with the same outline weight, and the carts are the barrel
 * prop — the sheet's cells that look like carts at a glance are control
 * consoles.
 */

/** the three gates along the back wall, each with the lever that lifts it */
const BAYS = [
  { id: "A", x: 70 },
  { id: "B", x: 180 },
  { id: "C", x: 290 },
];

/** the two rails the ore barrels ride, and where each barrel starts */
const RAILS = [
  { id: "1", y: 392, start: 70 },
  { id: "2", y: 486, start: 290 },
];

const RAIL_TILES = 8;
const RAIL_SCALE = 2.5;
const RAIL_W = 16 * RAIL_SCALE;

const CHESTS = [
  { id: "chest1", x: 64, y: 588 },
  { id: "chest2", x: 180, y: 560 },
  { id: "chest3", x: 296, y: 588 },
];

const SPIDERS = [
  { id: "spider1", x: 40, y: 318 },
  { id: "spider2", x: 320, y: 318 },
];

export const stage08Scene: SceneSpec = {
  id: "stage08",
  nameKey: "stage.stage08.name",
  introKey: "intro.stage08.line",
  goalKey: "goal.stage08",
  backgroundClass: "s8-mine",
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 3, max: 3, display: "hearts" },
    { id: "gold", nameKey: "counter.gold", initial: 0, display: "number" },
  ],
  /* one wire per lever: the lever you pull is a promise about which gate lifts */
  links: BAYS.map((b) => ({
    id: `wire${b.id}`,
    from: `lever${b.id}`,
    to: `gate${b.id}`,
    duration: 2.5,
  })),
  objects: [
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "goldHud", nameKey: "object.goldHud", kind: "hud", x: 0, y: 0, counter: "gold", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 430,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars", col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 330, maxY: 610 }],
    },

    /* the gates, set into the back wall */
    ...BAYS.map(
      (b): ObjectSpec => ({
        id: `gate${b.id}`,
        nameKey: `object.mineGate${b.id}`,
        kind: "decor",
        x: b.x,
        y: 214,
        z: 1,
        peerGroup: "gate",
        render: {
          className: "s8-gate",
          sprite: { sheet: "dungeon", col: 7, row: 5, scale: 3 },
        },
        behaviors: [],
      })
    ),

    /* and the lever under each one */
    ...BAYS.map(
      (b): ObjectSpec => ({
        id: `lever${b.id}`,
        nameKey: `object.mineLever${b.id}`,
        kind: "sprite",
        x: b.x,
        y: 282,
        z: 2,
        peerGroup: "lever",
        render: {
          className: "s8-lever",
          sprite: { sheet: "platformer", col: 4, row: 3, scale: 2.4 },
        },
        behaviors: [
          { t: "clickable", action: [{ a: "trigger", target: `lever${b.id}` }] },
        ],
      })
    ),

    /* two lamps on the wall between the gates */
    ...[
      { id: "lamp1", x: 125 },
      { id: "lamp2", x: 235 },
    ].map(
      (l): ObjectSpec => ({
        id: l.id,
        nameKey: `object.mineLamp${l.id.slice(-1)}`,
        kind: "decor",
        x: l.x,
        y: 170,
        z: 1,
        peerGroup: "lamp",
        render: {
          sprite: { sheet: "roguelike", col: 54, row: 7, scale: 2.2 },
          glow: { radius: 110, offsetX: 0, offsetY: -12 },
        },
        // not essential: a lamp that stops flickering is still a lamp, so this
        // is not offered to the frozen-animation fault
        behaviors: [{ t: "animate", name: "flicker", period: 0.6 }],
      })
    ),

    /* the rails, laid flat */
    ...RAILS.flatMap((r) =>
      Array.from(
        { length: RAIL_TILES },
        (_, i): ObjectSpec => ({
          id: `rail${r.id}_${i}`,
          nameKey: "object.rail",
          kind: "decor",
          x: 20 + RAIL_W * i + RAIL_W / 2,
          y: r.y,
          z: 0,
          render: {
            sprite: { sheet: "dungeon", col: 7, row: 6, scale: RAIL_SCALE },
          },
          behaviors: [],
        })
      )
    ),

    /* an ore barrel on each rail: the same run and the same speed */
    ...RAILS.map(
      (r): ObjectSpec => ({
        id: `barrel${r.id}`,
        nameKey: `object.barrel${r.id}`,
        kind: "sprite",
        x: r.start,
        y: r.y - 4,
        z: 2,
        peerGroup: "barrel",
        render: { prop: { id: "barrel", scale: 2 } },
        behaviors: [
          { t: "patrol", axis: "x", min: 50, max: 310, speed: 60, flipSprite: false },
        ],
      })
    ),

    /* what you came for */
    ...CHESTS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: c.y,
        peerGroup: "chest",
        render: {
          sprite: { sheet: "dungeon", col: 5, row: 7, scale: 2.5 },
        },
        behaviors: [
          {
            t: "pickup",
            radius: 30,
            respawn: 6,
            onPickup: [{ a: "increment", counter: "gold", by: 10 }],
          },
        ],
      })
    ),

    /* what hurts: the same spider twice, so one that does not is a fault */
    ...SPIDERS.map(
      (s): ObjectSpec => ({
        id: s.id,
        nameKey: `object.${s.id}`,
        kind: "sprite",
        x: s.x,
        y: s.y,
        peerGroup: "spider",
        render: {
          sprite: { sheet: "dungeon", col: 2, row: 10, scale: 2.4 },
        },
        behaviors: [{ t: "damage", counter: "hp", amount: 1, radius: 26 }],
      })
    ),

    {
      id: "pickaxe",
      nameKey: "object.pickaxe",
      kind: "decor",
      x: 330,
      y: 440,
      z: 1,
      render: { sprite: { sheet: "dungeon", col: 11, row: 10, scale: 2.4 } },
      behaviors: [],
    },
  ],
};
