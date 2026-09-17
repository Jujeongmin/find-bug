import type { ObjectSpec, SceneSpec } from "../../engine/types";

/**
 * Stage 10: the car park, the build that arrives in a player's fourth year.
 *
 * Two exit barriers at the top, each with its own pay station in front. You
 * pay at a station and the barrier over that lane lifts — the same promise
 * the mine's levers make, so the crossed-wires fault reads the same way.
 *
 * Two cars drive the side lanes up and down and hurt if they reach you; three
 * are parked in the middle and are in the way. Coins dropped on the tarmac
 * are the thing to pick up.
 *
 * All of it is the city sheet the street already uses: the striped barrier,
 * the grey post, the lamp post and the top-down cars. The cars are not laid
 * out on the sheet's grid — each sits across two cells with half a cell of
 * space round it — so they are cut as two by two.
 */

const LANES = [
  { id: "A", x: 110 },
  { id: "B", x: 250 },
];

const PARKED = [
  { id: "parked1", x: 115, col: 31, row: 18 },
  { id: "parked2", x: 180, col: 31, row: 22 },
  { id: "parked3", x: 245, col: 31, row: 26 },
];

const CARS = [
  { id: "car1", x: 40, y: 290 },
  { id: "car2", x: 320, y: 590 },
];

const COINS = [
  { id: "coin1", x: 180, y: 340 },
  { id: "coin2", x: 120, y: 600 },
  { id: "coin3", x: 240, y: 600 },
];

export const stage10Scene: SceneSpec = {
  id: "stage10",
  nameKey: "stage.stage10.name",
  introKey: "intro.stage10.line",
  goalKey: "goal.stage10",
  backgroundClass: "s10-lot",
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 3, max: 3, display: "hearts" },
    { id: "coins", nameKey: "counter.coins", initial: 0, display: "number" },
  ],
  /* one wire per pay station: paying at a lane is a promise about that lane's barrier */
  links: LANES.map((l) => ({
    id: `wire${l.id}`,
    from: `pay${l.id}`,
    to: `barrier${l.id}`,
    duration: 2.5,
  })),
  objects: [
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "coinHud", nameKey: "object.coinHud", kind: "hud", x: 0, y: 0, counter: "coins", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 300,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars", col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 262, maxY: 610 }],
    },

    /* the exit barriers, across the top of each lane */
    ...LANES.map(
      (l): ObjectSpec => ({
        id: `barrier${l.id}`,
        nameKey: `object.lotBarrier${l.id}`,
        kind: "decor",
        x: l.x,
        y: 176,
        z: 1,
        peerGroup: "barrier",
        render: {
          className: "s10-barrier",
          sprite: { sheet: "city", col: 24, row: 5, scale: 2.6 },
        },
        behaviors: [],
      })
    ),

    /* and the pay station in front of each */
    ...LANES.map(
      (l): ObjectSpec => ({
        id: `pay${l.id}`,
        nameKey: `object.lotPay${l.id}`,
        kind: "sprite",
        x: l.x,
        y: 236,
        z: 2,
        peerGroup: "pay",
        render: {
          className: "s10-pay",
          sprite: { sheet: "city", col: 27, row: 7, scale: 2.4 },
        },
        behaviors: [
          { t: "clickable", action: [{ a: "trigger", target: `pay${l.id}` }] },
        ],
      })
    ),

    /* a lamp post at each side */
    ...[
      { id: "lampL", x: 30 },
      { id: "lampR", x: 330 },
    ].map(
      (l): ObjectSpec => ({
        id: l.id,
        nameKey: `object.lotLamp${l.id.slice(-1)}`,
        kind: "decor",
        x: l.x,
        // up by the booth, clear of the lanes the cars drive
        y: 220,
        z: 1,
        peerGroup: "lamp",
        render: {
          sprite: { sheet: "city", col: 5, row: 16, spanY: 2, scale: 2 },
          glow: { radius: 80, offsetX: 16, offsetY: 10 },
        },
        behaviors: [],
      })
    ),

    /* three cars parked in the middle bays */
    ...PARKED.map(
      (p): ObjectSpec => ({
        id: p.id,
        nameKey: `object.${p.id}`,
        kind: "sprite",
        x: p.x,
        y: 500,
        z: 1,
        peerGroup: "parked",
        render: {
          sprite: { sheet: "city", col: p.col, row: p.row, spanX: 2, spanY: 2, scale: 1.8 },
          shadow: { offsetX: 8, width: 44 },
        },
        behaviors: [{ t: "blocker", radius: 24 }],
      })
    ),

    /* two cars driving the side lanes: the same car, the same drive */
    ...CARS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: c.y,
        z: 2,
        peerGroup: "car",
        render: {
          sprite: { sheet: "city", col: 33, row: 22, spanX: 2, spanY: 2, scale: 1.8 },
        },
        behaviors: [
          { t: "patrol", axis: "y", min: 290, max: 590, speed: 70, flipSprite: false },
          { t: "damage", counter: "hp", amount: 1, radius: 28 },
        ],
      })
    ),

    /* coins dropped on the tarmac */
    ...COINS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: c.y,
        peerGroup: "coin",
        render: {
          sprite: { sheet: "platformer", col: 11, row: 7, scale: 1.6 },
        },
        behaviors: [
          {
            t: "pickup",
            radius: 26,
            respawn: 6,
            onPickup: [{ a: "increment", counter: "coins", by: 1 }],
          },
        ],
      })
    ),
  ],
};
