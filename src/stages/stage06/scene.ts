import type { SceneSpec } from "../../engine/types";

const LEVERS = [
  { id: "leverA", door: "doorA", x: 55, color: "red" },
  { id: "leverB", door: "doorB", x: 165, color: "blue" },
  { id: "leverC", door: "doorC", x: 275, color: "yellow" },
];

const DOORS = [
  { id: "doorA", x: 70, cls: "red" },
  { id: "doorB", x: 180, cls: "blue" },
  { id: "doorC", x: 290, cls: "yellow" },
];

export const stage06Scene: SceneSpec = {
  id: "stage06",
  nameKey: "stage.stage06.name",
  introKey: "intro.stage06.line",
  backgroundClass: "s6-room",
  flags: ["light", "water"],
  counters: [
    { id: "shipped", nameKey: "counter.shipped", initial: 0, display: "number" },
    { id: "pressure", nameKey: "counter.pressure", initial: 0, max: 100, display: "number" },
  ],
  links: LEVERS.map((l) => ({ id: `link-${l.id}`, from: l.id, to: l.door, duration: 3 })),
  objects: [
    {
      id: "shippedHud",
      nameKey: "object.shippedHud",
      kind: "hud" as const,
      x: 0,
      y: 0,
      counter: "shipped",
      render: {},
      behaviors: [],
    },
    {
      id: "pressureHud",
      nameKey: "object.pressureHud",
      kind: "hud" as const,
      x: 0,
      y: 0,
      counter: "pressure",
      render: {},
      behaviors: [],
    },
    ...DOORS.map((d) => ({
      id: d.id,
      nameKey: `object.${d.id}`,
      kind: "decor" as const,
      x: d.x,
      y: 180,
      peerGroup: "door",
      render: {
        className: `s6-door ${d.cls}`,
        bar: { width: 54, height: 78 },
      },
      behaviors: [],
    })),

    ...LEVERS.map((l) => ({
      id: l.id,
      nameKey: `object.${l.id}`,
      kind: "decor" as const,
      x: l.x,
      y: 470,
      peerGroup: "lever",
      render: {
        sprite: { sheet: "platformer" as const, col: 4, row: 3, scale: 2 },
        className: `s6-lever-${l.color}`,
        orientable: true,
      },
      behaviors: [
        {
          t: "clickable" as const,
          // opening a line ships one crate down it
          action: [
            { a: "trigger" as const, target: l.id },
            { a: "increment" as const, counter: "shipped", by: 1 },
          ],
        },
      ],
    })),

    /* gears — meshed, so a same-direction spin is a fair bug */
    {
      id: "gearL",
      nameKey: "object.gears",
      kind: "decor",
      x: 44,
      y: 320,
      peerGroup: "gear",
      render: { className: "s6-gear", bar: { width: 30, height: 30 } },
      behaviors: [{ t: "spin", rpm: 20, dir: 1 }],
    },
    {
      id: "gearR",
      nameKey: "object.gears",
      kind: "decor",
      x: 82,
      y: 320,
      peerGroup: "gear",
      render: { className: "s6-gear", bar: { width: 30, height: 30 } },
      behaviors: [{ t: "spin", rpm: 20, dir: -1 }],
    },

    /* lighting: two lamps so offsetGlow has a comparison point */
    {
      id: "ceilingLight",
      nameKey: "object.ceilingLight",
      kind: "decor",
      x: 180,
      y: 60,
      peerGroup: "lamp",
      render: { className: "s6-bulb", bar: { width: 22, height: 22 }, glow: { radius: 100, offsetX: 11, offsetY: 11 } },
      behaviors: [{ t: "flagged", flag: "light", onClass: "lit" }],
    },
    {
      id: "sideLamp",
      nameKey: "object.sideLamp",
      kind: "decor",
      x: 320,
      y: 120,
      peerGroup: "lamp",
      render: { className: "s6-bulb small", bar: { width: 16, height: 16 }, glow: { radius: 76, offsetX: 8, offsetY: 8 } },
      behaviors: [],
    },

    /* water + gauge + alarm */
    {
      id: "pipeWater",
      nameKey: "object.pipeWater",
      kind: "decor",
      x: 30,
      y: 370,
      render: { className: "s6-water-strip", bar: { width: 300, height: 16 } },
      behaviors: [
        { t: "flagged", flag: "water", onClass: "flowing" },
        { t: "pressure", counter: "pressure", flag: "water", rise: 22, fall: 18 },
      ],
    },
    {
      id: "gauge",
      nameKey: "object.gauge",
      kind: "decor",
      x: 300,
      y: 300,
      render: { className: "s6-gauge", bar: { width: 34, height: 34 } },
      behaviors: [{ t: "meter", counter: "pressure", max: 100, invert: false }],
    },
    {
      id: "alarmLight",
      nameKey: "object.alarmLight",
      kind: "decor",
      x: 330,
      y: 60,
      render: { className: "s6-alarm", bar: { width: 20, height: 20 } },
      behaviors: [{ t: "meter", counter: "pressure", max: 100, invert: false }],
    },

    /* plumber robot — overlaps the doors, enabling zSwap */
    {
      id: "plumberBot",
      nameKey: "object.plumberBot",
      kind: "sprite",
      x: 60,
      y: 320,
      z: 1,
      overlaps: "doorA",
      render: { sprite: { sheet: "platchars" as const, col: 6, row: 1, scale: 1.5 }, shadow: { offsetX: 10, width: 26 } },
      behaviors: [
        { t: "patrol", axis: "x", min: 35, max: 310, speed: 40, flipSprite: true },
      ],
    },

    /* controls */
    {
      id: "valve",
      nameKey: "object.valve",
      kind: "button",
      x: 80,
      y: 585,
      render: { emoji: "🔘" },
      behaviors: [{ t: "clickable", action: { a: "toggle", flag: "water" } }],
    },
    {
      id: "lightSwitch",
      nameKey: "object.lightSwitch",
      kind: "button",
      x: 280,
      y: 585,
      render: { emoji: "🔆" },
      behaviors: [{ t: "clickable", action: { a: "toggle", flag: "light" } }],
    },
  ],
};
