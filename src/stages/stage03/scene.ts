import type { SceneSpec } from "../../engine/types";

const GROUND_Y = 555;

export const stage03Scene: SceneSpec = {
  id: "stage03",
  nameKey: "stage.stage03.name",
  introKey: "intro.stage03.line",
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
      render: { sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.8 }, shadow: { offsetX: 12, width: 28 } },
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
      id: "batA",
      nameKey: "object.batA",
      kind: "sprite",
      x: 180,
      y: 230,
      peerGroup: "bat",
      render: { sprite: { sheet: "platchars" as const, col: 7, row: 2, scale: 1.5 }, orientable: true },
      behaviors: [
        { t: "sineFly", cx: 180, cy: 230, ampX: 140, ampY: 26, speed: 0.7 },
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
        { t: "sineFly", cx: 180, cy: 470, ampX: 130, ampY: 24, speed: 0.55 },
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

    /* torches — peers, glow comparison */
    {
      id: "torch1",
      nameKey: "object.torch1",
      kind: "decor",
      x: 35,
      y: 150,
      peerGroup: "torch",
      render: { sprite: { sheet: "roguelike" as const, col: 54, row: 7, scale: 1.8 }, glow: { radius: 110, offsetX: 0, offsetY: 0 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.5, essential: true }],
    },
    {
      id: "torch2",
      nameKey: "object.torch2",
      kind: "decor",
      x: 325,
      y: 300,
      peerGroup: "torch",
      render: { sprite: { sheet: "roguelike" as const, col: 54, row: 7, scale: 1.8 }, glow: { radius: 110, offsetX: 0, offsetY: 0 } },
      behaviors: [{ t: "animate", name: "flicker", period: 0.5, essential: true }],
    },

    {
      id: "door",
      nameKey: "object.door",
      kind: "decor",
      x: 300,
      y: 430,
      render: { sprite: { sheet: "tinytown" as const, col: 5, row: 7, scale: 2.8 } },
      behaviors: [],
    },
  ],
};
