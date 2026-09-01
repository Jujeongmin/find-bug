import type { SceneSpec } from "../../engine/types";

/** where the herbs grow, and what regrows there after one is taken */
const HERBS = [
  { id: "herb1", x: 110, y: 250 },
  { id: "herb2", x: 252, y: 262 },
  { id: "herb3", x: 68, y: 392 },
  { id: "herb4", x: 296, y: 404 },
  { id: "herb5", x: 178, y: 494 },
];

/** the red ones. Static, in the open, and obviously not the green ones */
const TOADSTOOLS = [
  { id: "toad1", x: 186, y: 224 },
  { id: "toad2", x: 138, y: 344 },
  { id: "toad3", x: 244, y: 462 },
];

/**
 * Stage 5: a forage in the woods.
 *
 * It replaced an alchemy lab whose loop nobody could read: you clicked a herb
 * on a shelf and a number called "투입" moved somewhere else on the screen,
 * then a button turned that number into another number. Three counters, and
 * only one of them had anything on screen you could point at.
 *
 * Here the whole loop is one gesture. Walk onto a green shoot and it is
 * yours; the count goes up where you can see it, and the shoot grows back a
 * few seconds later so the field never empties. Red is poison, and a red
 * mushroom looks nothing like a green shoot — the rule teaches itself before
 * the goal line is read. That leaves the faults somewhere honest: something
 * that will not be picked up, something that hurts when it should not,
 * something that never grows back.
 */
export const stage05Scene: SceneSpec = {
  id: "stage05",
  nameKey: "stage.stage05.name",
  introKey: "intro.stage05.line",
  goalKey: "goal.stage05",
  backgroundClass: "s5-forest",
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 3, max: 3, display: "hearts" },
    { id: "herbs", nameKey: "counter.herbs", initial: 0, display: "number" },
  ],
  objects: [
    /* HUD */
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "herbCounter", nameKey: "object.herbCounter", kind: "hud", x: 0, y: 0, counter: "herbs", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 552,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 178, maxY: 596 }],
    },

    /* what you came for — peers of each other */
    ...HERBS.map((h) => ({
      id: h.id,
      nameKey: `object.${h.id}`,
      kind: "sprite" as const,
      x: h.x,
      y: h.y,
      peerGroup: "herb",
      render: {
        sprite: { sheet: "tinytown" as const, col: 5, row: 1, scale: 2.2 },
        shadow: { offsetX: 8, width: 20 },
      },
      behaviors: [
        {
          t: "pickup" as const,
          radius: 28,
          respawn: 5,
          onPickup: [{ a: "increment" as const, counter: "herbs", by: 1 }],
        },
      ],
    })),

    /* what you came for and must not take — peers of each other */
    ...TOADSTOOLS.map((m) => ({
      id: m.id,
      nameKey: `object.${m.id}`,
      kind: "sprite" as const,
      x: m.x,
      y: m.y,
      peerGroup: "toadstool",
      render: {
        sprite: { sheet: "tinytown" as const, col: 5, row: 2, scale: 2.2 },
        shadow: { offsetX: 8, width: 22 },
      },
      behaviors: [{ t: "damage" as const, counter: "hp", amount: 1, radius: 26 }],
    })),

    /* the two that move, so the field is never safe to cross on memory alone.
       Not the sheet's mushroom creature, tempting as it was: its cap is drawn
       past the top of its tile and comes out sliced. */
    {
      id: "bug1",
      nameKey: "object.bug1",
      kind: "sprite",
      x: 60,
      y: 318,
      peerGroup: "critter",
      render: {
        sprite: { sheet: "platchars" as const, col: 4, row: 1, scale: 2.1 },
        shadow: { offsetX: 8, width: 22 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 40, max: 300, speed: 46, flipSprite: true },
        { t: "animate", name: "hop", period: 0.45, essential: true },
        { t: "damage", counter: "hp", amount: 1, radius: 28 },
      ],
    },
    {
      id: "bug2",
      nameKey: "object.bug2",
      kind: "sprite",
      x: 290,
      y: 512,
      peerGroup: "critter",
      render: {
        sprite: { sheet: "platchars" as const, col: 4, row: 1, scale: 2.1 },
        shadow: { offsetX: 8, width: 22 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 50, max: 310, speed: 38, flipSprite: true },
        { t: "animate", name: "hop", period: 0.55, essential: true },
        { t: "damage", counter: "hp", amount: 1, radius: 28 },
      ],
    },

    /* the spring: the only way back up, so it is worth crossing the field for */
    {
      id: "spring",
      nameKey: "object.spring",
      kind: "sprite",
      x: 56,
      y: 552,
      render: {
        sprite: { sheet: "roguelike" as const, col: 54, row: 12, scale: 2.2 },
        shadow: { offsetX: 10, width: 18 },
        glow: { radius: 70, offsetX: 10, offsetY: 12 },
      },
      behaviors: [
        {
          t: "pickup",
          radius: 30,
          respawn: 10,
          onPickup: [{ a: "heal", counter: "hp", by: 1 }],
        },
      ],
    },

    /* trees — peers of each other, and the reason the route is not a straight line */
    ...[
      { id: "tree1", x: 52, y: 206 },
      { id: "tree2", x: 306, y: 210 },
      { id: "tree3", x: 232, y: 344 },
    ].map((t) => ({
      id: t.id,
      nameKey: `object.${t.id}`,
      kind: "decor" as const,
      x: t.x,
      y: t.y,
      peerGroup: "tree",
      // (4,1) looks like the better tree in the sheet, but its canopy is drawn
      // past the top of its cell and comes out flat-topped. This one fits.
      render: {
        sprite: { sheet: "tinytown" as const, col: 4, row: 2, scale: 3.2 },
        shadow: { offsetX: 10, width: 30 },
      },
      behaviors: [{ t: "blocker" as const, radius: 28 }],
    })),
  ],
};
