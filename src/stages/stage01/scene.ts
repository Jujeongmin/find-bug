import type { SceneSpec } from "../../engine/types";

/**
 * Stage 1 as pure data. The engine's mutators generate the bug pool from this —
 * the six hand-authored B1-B6 bugs should all fall out of it automatically.
 */
export const stage01Scene: SceneSpec = {
  id: "stage01",
  nameKey: "stage.stage01.name",
  introKey: "intro.line",
  goalKey: "goal.stage01",
  backgroundClass: "s1-field",
  light: { objectId: "sun", x: 55 },
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 5, max: 5, display: "hearts" },
    { id: "score", nameKey: "hud.score", initial: 0, display: "number" },
  ],
  objects: [
    /* HUD */
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "score", nameKey: "object.score", kind: "hud", x: 0, y: 0, counter: "score", render: {}, behaviors: [] },

    /* player */
    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 420,
      z: 3,
      peerGroup: "actor",
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 150, minY: 190, maxY: 580 }],
    },

    /* slimes — peers of each other, so peer-requiring mutators are fair here */
    {
      id: "slimeA",
      nameKey: "object.slimeA",
      kind: "sprite",
      x: 80,
      y: 330,
      peerGroup: "slime",
      render: {
        sprite: { sheet: "platchars" as const, col: 2, row: 1, scale: 1.5 },
        shadow: { offsetX: 10, width: 26 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 35, max: 150, speed: 40, flipSprite: true },
        { t: "animate", name: "hop", period: 0.5, essential: true },
        { t: "damage", counter: "hp", amount: 1, radius: 38 },
        {
          t: "killable",
          radius: 38,
          respawn: 4,
          onKill: [
            { a: "increment", counter: "score", by: 10 },
          ],
        },
      ],
    },
    {
      id: "slimeB",
      nameKey: "object.slimeB",
      kind: "sprite",
      x: 250,
      y: 360,
      peerGroup: "slime",
      render: {
        sprite: { sheet: "platchars" as const, col: 2, row: 1, scale: 1.5 },
        shadow: { offsetX: 10, width: 26 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 195, max: 330, speed: 40, flipSprite: true },
        { t: "animate", name: "hop", period: 0.5, essential: true },
        { t: "damage", counter: "hp", amount: 1, radius: 38 },
        {
          t: "killable",
          radius: 38,
          respawn: 4,
          onKill: [
            { a: "increment", counter: "score", by: 10 },
          ],
        },
      ],
    },
    {
      id: "slimeC",
      nameKey: "object.slimeC",
      kind: "sprite",
      x: 180,
      y: 490,
      peerGroup: "slime",
      render: {
        sprite: { sheet: "platchars" as const, col: 2, row: 1, scale: 1.5 },
        shadow: { offsetX: 10, width: 26 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 90, max: 280, speed: 40, flipSprite: true },
        { t: "animate", name: "hop", period: 0.5, essential: true },
        { t: "damage", counter: "hp", amount: 1, radius: 38 },
        {
          t: "killable",
          radius: 38,
          respawn: 4,
          onKill: [
            { a: "increment", counter: "score", by: 10 },
          ],
        },
      ],
    },

    /* potion */
    {
      id: "potion",
      nameKey: "object.potion",
      kind: "sprite",
      x: 55,
      y: 460,
      render: {
        sprite: { sheet: "roguelike" as const, col: 54, row: 12, scale: 2.2 },
        shadow: { offsetX: 10, width: 18 },
      },
      behaviors: [
        {
          t: "pickup",
          radius: 32,
          respawn: 6,
          onPickup: [{ a: "heal", counter: "hp", by: 2 }],
        },
      ],
    },

    /* trees — peers of each other */
    {
      id: "tree1",
      nameKey: "object.tree1",
      kind: "decor",
      x: 75,
      y: 260,
      peerGroup: "tree",
      render: {
        sprite: { sheet: "platformer" as const, col: 6, row: 6, scale: 2.6 },
        shadow: { offsetX: 10, width: 30 },
      },
      behaviors: [{ t: "blocker", radius: 30 }],
    },
    {
      id: "tree2",
      nameKey: "object.tree2",
      kind: "decor",
      x: 290,
      y: 245,
      peerGroup: "tree",
      render: {
        sprite: { sheet: "platformer" as const, col: 6, row: 6, scale: 2.6 },
        shadow: { offsetX: 10, width: 30 },
      },
      behaviors: [{ t: "blocker", radius: 30 }],
    },

    /* scenery */
    {
      id: "sun",
      nameKey: "object.sun",
      kind: "decor",
      x: 55,
      y: 70,
      render: {
        className: "s1-sun",
        bar: { width: 40, height: 40 },
        glow: { radius: 130, offsetX: 20, offsetY: 20 },
      },
      behaviors: [],
    },
    {
      id: "cloud",
      nameKey: "object.cloud",
      kind: "decor",
      x: 60,
      y: 125,
      render: { className: "s1-cloud", bar: { width: 54, height: 20 } },
      behaviors: [{ t: "drift", axis: "x", speed: 14, wrapMin: -60, wrapMax: 420 }],
    },

    /* attack button */
    {
      id: "attackBtn",
      nameKey: "object.attackBtn",
      kind: "button",
      x: 250,
      y: 600,
      render: { labelKey: "hud.attack", className: "attack-btn-pos" },
      behaviors: [{ t: "clickable", action: { a: "attack", range: 70 } }],
    },
  ],
};
