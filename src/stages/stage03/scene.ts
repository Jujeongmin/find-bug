import type { SceneSpec } from "../../engine/types";

const GROUND_Y = 555;

export const stage03Scene: SceneSpec = {
  id: "stage03",
  nameKey: "stage.stage03.name",
  introKey: "intro.stage03.line",
  goalKey: "goal.stage03",
  backgroundClass: "s3-field",
  sideView: { groundY: GROUND_Y },
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 5, max: 5, display: "hearts" },
    { id: "coins", nameKey: "counter.coins", initial: 0, display: "number" },
  ],
  objects: [
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "coinCounter", nameKey: "object.coinCounter", kind: "hud", x: 0, y: 0, counter: "coins", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 250,
      y: GROUND_Y,
      z: 3,
      render: { facesLeft: true, sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.8 }, shadow: { offsetX: 12, width: 28 } },
      behaviors: [
        { t: "platformer", speed: 140, gravity: 1500, jumpV: -560, fallScale: 1 },
      ],
    },

    /* static platforms — peers */
    {
      id: "platformL",
      nameKey: "object.platformL",
      kind: "decor",
      x: 20,
      y: 500,
      peerGroup: "platform",
      render: { className: "s3-plat", bar: { width: 120, height: 12 } },
      behaviors: [{ t: "platform", width: 120 }],
    },
    {
      id: "platformR",
      nameKey: "object.platformR",
      kind: "decor",
      x: 220,
      y: 430,
      peerGroup: "platform",
      render: { className: "s3-plat", bar: { width: 120, height: 12 } },
      behaviors: [{ t: "platform", width: 120 }],
    },
    {
      id: "platformC",
      nameKey: "object.platformC",
      kind: "decor",
      x: 90,
      y: 340,
      peerGroup: "platform",
      render: { className: "s3-plat", bar: { width: 160, height: 12 } },
      behaviors: [{ t: "platform", width: 160 }],
    },

    /* moving platform */
    {
      id: "movingPlatform",
      nameKey: "object.movingPlatform",
      kind: "decor",
      x: 30,
      y: 260,
      render: { className: "s3-plat moving", bar: { width: 70, height: 12 } },
      behaviors: [
        { t: "platform", width: 70 },
        { t: "patrol", axis: "x", min: 30, max: 180, speed: 55, flipSprite: false },
      ],
    },

    /* jump pads — peers */
    {
      id: "jumpPadL",
      nameKey: "object.jumpPadL",
      kind: "decor",
      x: 55,
      y: GROUND_Y,
      peerGroup: "pad",
      render: { sprite: { sheet: "platformer" as const, col: 8, row: 6, scale: 1.9 } },
      behaviors: [{ t: "jumpPad", power: -840 }],
    },
    {
      id: "jumpPadR",
      nameKey: "object.jumpPadR",
      kind: "decor",
      x: 305,
      y: GROUND_Y,
      peerGroup: "pad",
      render: { sprite: { sheet: "platformer" as const, col: 8, row: 6, scale: 1.9 } },
      behaviors: [{ t: "jumpPad", power: -840 }],
    },

    /* hazards */
    {
      id: "spikes",
      nameKey: "object.spikes",
      kind: "decor",
      x: 180,
      y: GROUND_Y,
      render: { sprite: { sheet: "platformer" as const, col: 8, row: 3, scale: 1.9 } },
      behaviors: [{ t: "damage", counter: "hp", amount: 1, radius: 30 }],
    },
    {
      /*
       * The two bats fly one orbit at one pace, at two heights. They used to
       * differ in speed and width, and no fault makes a bat faster, so a player
       * who reported the faster one was marked wrong for noticing the level.
       */
      id: "batA",
      nameKey: "object.batA",
      kind: "sprite",
      x: 180,
      y: 230,
      peerGroup: "bat",
      render: { sprite: { sheet: "platchars" as const, col: 7, row: 2, scale: 1.5 }, orientable: true },
      behaviors: [
        { t: "sineFly", cx: 180, cy: 230, ampX: 135, ampY: 25, speed: 0.6 },
        { t: "animate", name: "flap", period: 0.3 },
        { t: "damage", counter: "hp", amount: 1, radius: 30 },
      ],
    },
    {
      id: "batB",
      nameKey: "object.batB",
      kind: "sprite",
      x: 180,
      y: 470,
      peerGroup: "bat",
      render: { sprite: { sheet: "platchars" as const, col: 7, row: 2, scale: 1.5 }, orientable: true },
      behaviors: [
        { t: "sineFly", cx: 180, cy: 470, ampX: 135, ampY: 25, speed: 0.6 },
        { t: "animate", name: "flap", period: 0.3 },
        { t: "damage", counter: "hp", amount: 1, radius: 30 },
      ],
    },

    /* coins — peers */
    ...[
      { id: "coin1", x: 80, y: 460 },
      { id: "coin2", x: 280, y: 390 },
      { id: "coin3", x: 170, y: 300 },
      { id: "coin4", x: 105, y: 215 },
    ].map((c) => ({
      id: c.id,
      nameKey: "object.coins",
      kind: "sprite" as const,
      x: c.x,
      y: c.y,
      peerGroup: "coin",
      render: { sprite: { sheet: "roguelike" as const, col: 45, row: 11, scale: 1.6 } },
      behaviors: [
        {
          t: "pickup" as const,
          radius: 28,
          respawn: 5,
          onPickup: [{ a: "increment" as const, counter: "coins", by: 1 }],
        },
      ],
    })),

    /* Floor braziers, peers of each other, for glow comparison.
       They hung in mid-air before. Nothing in the scene draws a wall, so there
       was no reason on screen for them to be up there and they read as
       floating — the same trap as stage 1's well: correct, but fault-shaped.
       On the floor with a shadow, their position explains itself. */
    {
      id: "torch1",
      nameKey: "object.torch1",
      kind: "decor",
      x: 20,
      y: GROUND_Y,
      peerGroup: "torch",
      render: { sprite: { sheet: "roguelike" as const, col: 54, row: 7, scale: 2.2 }, glow: { radius: 110, offsetX: 0, offsetY: -12 }, shadow: { offsetX: 10, width: 26 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.5, essential: true }],
    },
    {
      id: "torch2",
      nameKey: "object.torch2",
      kind: "decor",
      x: 340,
      y: GROUND_Y,
      peerGroup: "torch",
      render: { sprite: { sheet: "roguelike" as const, col: 54, row: 7, scale: 2.2 }, glow: { radius: 110, offsetX: 0, offsetY: -12 }, shadow: { offsetX: 10, width: 26 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.5, essential: true }],
    },

  ],
};
