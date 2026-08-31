import type { SceneSpec } from "../../engine/types";

const INGREDIENTS = [
  { id: "herb", sprite: { sheet: "roguelike" as const, col: 55, row: 17 }, x: 70 },
  { id: "mushroom", sprite: { sheet: "platformer" as const, col: 8, row: 6 }, x: 180 },
  { id: "crystal", sprite: { sheet: "roguelike" as const, col: 33, row: 9 }, x: 290 },
];

export const stage05Scene: SceneSpec = {
  id: "stage05",
  nameKey: "stage.stage05.name",
  introKey: "intro.stage05.line",
  backgroundClass: "s5-lab",
  flags: ["brewing"],
  timers: [
    {
      id: "brew",
      duration: 5,
      onDone: [{ a: "increment", counter: "products", by: 1 }],
    },
  ],
  counters: [
    { id: "stock", nameKey: "counter.stock", initial: 30, display: "number" },
    { id: "products", nameKey: "counter.products", initial: 0, display: "number" },
  ],
  objects: [
    { id: "stockCounter", nameKey: "object.stockCounter", kind: "hud", x: 0, y: 0, counter: "stock", render: {}, behaviors: [] },
    { id: "shelf5", nameKey: "object.shelf5", kind: "hud", x: 0, y: 0, counter: "products", render: {}, behaviors: [] },

    /* ingredients — peers */
    ...INGREDIENTS.map((ing) => ({
      id: ing.id,
      nameKey: `object.${ing.id}`,
      kind: "sprite" as const,
      x: ing.x,
      y: 480,
      peerGroup: "ingredient",
      render: {
        sprite: { ...ing.sprite, scale: 1.9 },
        shadow: { offsetX: 8, width: 20 },
      },
      behaviors: [
        {
          t: "clickable" as const,
          action: { a: "increment" as const, counter: "stock", by: -1 },
        },
      ],
    })),

    /* cauldron and fire — fire overlaps the cauldron, enabling zSwap */
    {
      id: "cauldron",
      nameKey: "object.cauldron",
      kind: "decor",
      x: 180,
      y: 300,
      z: 2,
      render: { sprite: { sheet: "roguelike" as const, col: 54, row: 7, scale: 3 }, shadow: { offsetX: 10, width: 34 } },
      behaviors: [],
    },
    {
      id: "fire",
      nameKey: "object.fire",
      kind: "decor",
      x: 160,
      y: 302,
      z: 1,
      overlaps: "cauldron",
      render: { className: "s5-flame", bar: { width: 40, height: 16 }, glow: { radius: 90, offsetX: 20, offsetY: 8 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.5 }],
    },

    /* wall clock + window stars */
    {
      id: "clock5",
      nameKey: "object.clock5",
      kind: "decor",
      x: 310,
      y: 70,
      render: { sprite: { sheet: "roguelike" as const, col: 26, row: 8, scale: 2.2 } },
      behaviors: [],
    },
    {
      id: "clockHand5",
      nameKey: "object.clockHand",
      kind: "decor",
      x: 310,
      y: 56,
      z: 2,
      render: { className: "s2-hand", bar: { width: 3, height: 13 } },
      behaviors: [{ t: "spin", rpm: 10, dir: 1 }],
    },
    {
      id: "window",
      nameKey: "object.window",
      kind: "decor",
      x: 60,
      y: 70,
      peerGroup: "wallthing",
      render: { className: "s5-moon", bar: { width: 30, height: 30 }, glow: { radius: 80, offsetX: 15, offsetY: 15 } },
      behaviors: [{ t: "animate", name: "flicker", period: 1.8 }],
    },

    /* assistant robot */
    {
      id: "robot",
      nameKey: "object.robot",
      kind: "sprite",
      x: 60,
      y: 560,
      render: { sprite: { sheet: "platchars" as const, col: 0, row: 2, scale: 1.6 }, shadow: { offsetX: 10, width: 26 } },
      behaviors: [
        { t: "patrol", axis: "x", min: 40, max: 300, speed: 42, flipSprite: true },
      ],
    },

    /* decoration — peers with window for graphic mutators */
    {
      id: "books",
      nameKey: "object.books",
      kind: "decor",
      x: 320,
      y: 200,
      peerGroup: "wallthing",
      render: { sprite: { sheet: "roguelike" as const, col: 49, row: 12, scale: 2.2 }, shadow: { offsetX: 8, width: 22 } },
      behaviors: [],
    },
    {
      id: "scroll",
      nameKey: "object.scroll",
      kind: "decor",
      x: 320,
      y: 400,
      peerGroup: "wallthing",
      render: { sprite: { sheet: "roguelike" as const, col: 44, row: 15, scale: 1.8 }, shadow: { offsetX: 8, width: 20 } },
      behaviors: [],
    },

    /* brew button */
    {
      id: "brewBtn",
      nameKey: "object.brewBtn",
      kind: "button",
      x: 180,
      y: 600,
      render: { emoji: "🔥", labelKey: "lab.brew" },
      behaviors: [{ t: "clickable", action: { a: "startTimer", timer: "brew" } }],
    },
  ],
};
