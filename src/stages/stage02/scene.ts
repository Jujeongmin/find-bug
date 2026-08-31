import type { SceneSpec } from "../../engine/types";

/** shelf stock, drawn from the Roguelike pack */
const ITEMS = [
  { id: "book", sprite: { sheet: "roguelike" as const, col: 46, row: 15 }, x: 60 },
  { id: "potion", sprite: { sheet: "roguelike" as const, col: 54, row: 12 }, x: 120 },
  { id: "scroll", sprite: { sheet: "roguelike" as const, col: 44, row: 15 }, x: 180 },
  { id: "meat", sprite: { sheet: "roguelike" as const, col: 54, row: 15 }, x: 240 },
  { id: "bread", sprite: { sheet: "roguelike" as const, col: 55, row: 13 }, x: 300 },
];

export const stage02Scene: SceneSpec = {
  id: "stage02",
  nameKey: "stage.stage02.name",
  introKey: "intro.stage02.line",
  goalKey: "goal.stage02",
  backgroundClass: "s2-room",
  counters: [
    { id: "gold", nameKey: "counter.gold", initial: 50, display: "number" },
    { id: "items", nameKey: "counter.items", initial: 0, max: 8, display: "number" },
  ],
  objects: [
    { id: "goldHud", nameKey: "object.gold", kind: "hud", x: 0, y: 0, counter: "gold", render: {}, behaviors: [] },
    { id: "invHud", nameKey: "object.inventory", kind: "hud", x: 0, y: 0, counter: "items", render: {}, behaviors: [] },

    /* shelf items — peers of each other */
    ...ITEMS.map((it) => ({
      id: it.id,
      nameKey: `object.${it.id}`,
      kind: "sprite" as const,
      x: it.x,
      y: 322,
      peerGroup: "item",
      render: {
        sprite: { ...it.sprite, scale: 1.9 },
        shadow: { offsetX: 8, width: 20 },
      },
      behaviors: [
        {
          t: "clickable" as const,
          action: [
            { a: "increment" as const, counter: "gold", by: -10 },
            { a: "increment" as const, counter: "items", by: 1 },
          ],
        },
      ],
    })),

    /* candles — peers, so a flipped/frozen flame is fair */
    {
      id: "candle1",
      nameKey: "object.candle1",
      kind: "decor",
      x: 40,
      y: 210,
      peerGroup: "candle",
      render: { className: "s2-candle", bar: { width: 10, height: 30 }, glow: { radius: 70, offsetX: 5, offsetY: 4 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.6, essential: true }],
    },
    {
      id: "candle2",
      nameKey: "object.candle2",
      kind: "decor",
      x: 310,
      y: 210,
      peerGroup: "candle",
      render: { className: "s2-candle", bar: { width: 10, height: 30 }, glow: { radius: 70, offsetX: 5, offsetY: 4 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.6, essential: true }],
    },

    /* wall clock */
    {
      id: "clock",
      nameKey: "object.clock",
      kind: "decor",
      x: 240,
      y: 95,
      render: { sprite: { sheet: "roguelike" as const, col: 26, row: 8, scale: 2.4 } },
      behaviors: [],
    },
    {
      id: "clockHand",
      nameKey: "object.clockHand",
      kind: "decor",
      x: 240,
      y: 78,
      z: 2,
      render: { className: "s2-hand", bar: { width: 3, height: 14 } },
      behaviors: [{ t: "spin", rpm: 10, dir: 1 }],
    },

    /* merchant + cat */
    {
      id: "merchant",
      nameKey: "object.merchant",
      kind: "sprite",
      x: 260,
      y: 440,
      peerGroup: "person",
      render: { sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.9 }, orientable: true, shadow: { offsetX: 10, width: 28 } },
      behaviors: [],
    },
    {
      id: "cat",
      nameKey: "object.cat",
      kind: "sprite",
      x: 120,
      y: 550,
      peerGroup: "person",
      render: { sprite: { sheet: "platchars" as const, col: 2, row: 0, scale: 1.6 }, orientable: true, directional: true, shadow: { offsetX: 10, width: 24 } },
      behaviors: [
        { t: "patrol", axis: "x", min: 50, max: 310, speed: 40, flipSprite: true },
      ],
    },

    /* scenery */
    {
      id: "shelf",
      nameKey: "object.shelf",
      kind: "decor",
      x: 30,
      y: 322,
      render: { className: "s2-plank", bar: { width: 300, height: 12 } },
      behaviors: [],
    },
    {
      id: "door",
      nameKey: "object.door",
      kind: "decor",
      x: 55,
      y: 440,
      render: { sprite: { sheet: "tinytown" as const, col: 5, row: 7, scale: 3 }, shadow: { offsetX: 10, width: 26 } },
      behaviors: [],
    },

  ],
};
