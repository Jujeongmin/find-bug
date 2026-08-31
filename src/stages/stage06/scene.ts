import type { SceneSpec } from "../../engine/types";

/**
 * Shooting gallery.
 *
 * Targets ride three rails at different speeds; tap one to knock it down for
 * points, and it pops back up a moment later. The genre explains itself, which
 * is the point: the player only notices a fault because they already know what
 * a gallery is supposed to do.
 *
 * Earlier passes tried a machine room and a wiring bench here. Neither was a
 * genre anyone recognises, so there was no intuition to violate.
 */

const RAILS = [
  { id: "A", y: 250, min: 40, max: 300, speed: 55, col: 0, score: 10 },
  { id: "B", y: 360, min: 40, max: 300, speed: 75, col: 2, score: 20 },
  { id: "C", y: 470, min: 40, max: 300, speed: 95, col: 4, score: 30 },
];

export const stage06Scene: SceneSpec = {
  id: "stage06",
  nameKey: "stage.stage06.name",
  introKey: "intro.stage06.line",
  goalKey: "goal.stage06",
  backgroundClass: "s6-room",
  light: { objectId: "boothLamp", x: 60 },
  counters: [
    { id: "score", nameKey: "counter.score", initial: 0, display: "number" },
    { id: "hits", nameKey: "counter.hits", initial: 0, display: "number" },
  ],
  objects: [
    { id: "scoreHud", nameKey: "object.scoreHud", kind: "hud", x: 0, y: 0, counter: "score", render: {}, behaviors: [] },
    { id: "hitsHud", nameKey: "object.hitsHud", kind: "hud", x: 0, y: 0, counter: "hits", render: {}, behaviors: [] },

    /* the booth lamp: a visible light source, so shadow faults are judgeable */
    {
      id: "boothLamp",
      nameKey: "object.boothLamp",
      kind: "decor",
      x: 60,
      y: 108,
      render: {
        className: "s6-booth-lamp",
        bar: { width: 26, height: 26 },
        glow: { radius: 110, offsetX: 13, offsetY: 13 },
      },
      behaviors: [],
    },

    /* rails */
    ...RAILS.map((r) => ({
      id: `rail${r.id}`,
      nameKey: `object.rail${r.id}`,
      kind: "decor" as const,
      x: 30,
      y: r.y + 6,
      peerGroup: "rail",
      render: { className: "s6-rail", bar: { width: 300, height: 8 } },
      behaviors: [],
    })),

    /* targets: tap to knock down, they pop back up */
    ...RAILS.map((r) => ({
      id: `target${r.id}`,
      nameKey: `object.target${r.id}`,
      kind: "sprite" as const,
      x: r.min,
      y: r.y,
      peerGroup: "target",
      render: {
        sprite: { sheet: "platchars" as const, col: r.col, row: 0, scale: 1.5 },
        shadow: { offsetX: 10, width: 26 },
        orientable: true,
      },
      behaviors: [
        {
          t: "patrol" as const,
          axis: "x" as const,
          min: r.min,
          max: r.max,
          speed: r.speed,
          flipSprite: false,
        },
        {
          t: "killable" as const,
          radius: 30,
          respawn: 1.6,
          tappable: true,
          onKill: [
            { a: "increment" as const, counter: "score", by: r.score },
            { a: "increment" as const, counter: "hits", by: 1 },
          ],
        },
      ],
    })),

    /* prize wheel: booth dressing, and a home for speed faults */
    {
      id: "wheelL",
      nameKey: "object.wheel",
      kind: "decor",
      x: 40,
      y: 580,
      peerGroup: "wheel",
      render: { className: "s6-wheel", bar: { width: 34, height: 34 } },
      behaviors: [{ t: "spin", rpm: 20, dir: 1 }],
    },
    {
      id: "wheelR",
      nameKey: "object.wheel",
      kind: "decor",
      x: 84,
      y: 580,
      peerGroup: "wheel",
      render: { className: "s6-wheel", bar: { width: 34, height: 34 } },
      behaviors: [{ t: "spin", rpm: 20, dir: -1 }],
    },

    /* the stall keeper */
    {
      id: "keeper",
      nameKey: "object.keeper",
      kind: "sprite",
      x: 290,
      y: 600,
      render: {
        sprite: { sheet: "platchars" as const, col: 0, row: 1, scale: 1.7 },
        shadow: { offsetX: 10, width: 28 },
      },
      behaviors: [],
    },
  ],
};
