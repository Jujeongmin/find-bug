import type { SceneSpec } from "../../engine/types";

/**
 * Wiring test bench.
 *
 * One loop, one rule: press a coloured switch, the lamp of the same colour
 * lights, the check counter goes up. A printed legend states the pairing, so
 * "correct" is visible on screen — which is what makes a dead switch, a wrong
 * lamp or a miscounting tally readable as faults.
 *
 * The previous version of this scene mixed levers/doors, a valve, water
 * pressure, a light switch and gears with no shared goal; nothing accumulated,
 * so there was no expected behaviour to measure a fault against.
 */

const CHANNELS = [
  { id: "A", colour: "red", x: 70 },
  { id: "B", colour: "blue", x: 180 },
  { id: "C", colour: "yellow", x: 290 },
];

export const stage06Scene: SceneSpec = {
  id: "stage06",
  nameKey: "stage.stage06.name",
  introKey: "intro.stage06.line",
  backgroundClass: "s6-room",
  counters: [
    { id: "checks", nameKey: "counter.checks", initial: 0, display: "number" },
  ],
  links: CHANNELS.map((c) => ({
    id: `link-${c.id}`,
    from: `switch${c.id}`,
    to: `lamp${c.id}`,
    duration: 1.6,
  })),
  objects: [
    {
      id: "checksHud",
      nameKey: "object.checksHud",
      kind: "hud",
      x: 0,
      y: 0,
      counter: "checks",
      render: {},
      behaviors: [],
    },

    /* lamps — the output under test */
    ...CHANNELS.map((c) => ({
      id: `lamp${c.id}`,
      nameKey: `object.lamp${c.id}`,
      kind: "decor" as const,
      x: c.x - 27,
      y: 180,
      peerGroup: "lamp",
      render: {
        className: `s6-lamp ${c.colour}`,
        bar: { width: 54, height: 54 },
        glow: { radius: 96, offsetX: 27, offsetY: 27 },
      },
      behaviors: [],
    })),

    /* the printed pairing, so the player can see what correct looks like */
    {
      id: "legend",
      nameKey: "object.legend",
      kind: "decor",
      x: 30,
      y: 300,
      render: { className: "s6-legend", bar: { width: 300, height: 44 } },
      behaviors: [],
    },

    /* switches — the input under test */
    ...CHANNELS.map((c) => ({
      id: `switch${c.id}`,
      nameKey: `object.switch${c.id}`,
      kind: "decor" as const,
      x: c.x,
      y: 440,
      peerGroup: "switch",
      render: {
        sprite: { sheet: "platformer" as const, col: 4, row: 3, scale: 2 },
        className: `s6-switch ${c.colour}`,
        orientable: true,
      },
      behaviors: [
        {
          t: "clickable" as const,
          action: [
            { a: "trigger" as const, target: `switch${c.id}` },
            { a: "increment" as const, counter: "checks", by: 1 },
          ],
        },
      ],
    })),

    /* machinery that sells the setting and hosts movement faults */
    {
      id: "gearL",
      nameKey: "object.gears",
      kind: "decor",
      x: 40,
      y: 540,
      peerGroup: "gear",
      render: { className: "s6-gear", bar: { width: 34, height: 34 } },
      behaviors: [{ t: "spin", rpm: 20, dir: 1 }],
    },
    {
      id: "gearR",
      nameKey: "object.gears",
      kind: "decor",
      x: 84,
      y: 540,
      peerGroup: "gear",
      render: { className: "s6-gear", bar: { width: 34, height: 34 } },
      behaviors: [{ t: "spin", rpm: 20, dir: -1 }],
    },
    {
      id: "plumberBot",
      nameKey: "object.plumberBot",
      kind: "sprite",
      x: 210,
      y: 590,
      render: {
        sprite: { sheet: "platchars" as const, col: 6, row: 1, scale: 1.5 },
        shadow: { offsetX: 10, width: 26 },
      },
      behaviors: [
        { t: "patrol", axis: "x", min: 160, max: 320, speed: 40, flipSprite: false },
      ],
    },
  ],
};
