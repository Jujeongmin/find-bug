import type { ObjectSpec, SceneSpec } from "../../engine/types";
import { streetActor } from "../../street/scene";

/**
 * Stage 9: the kitchen, the build that arrives in a player's third year.
 *
 * It exists for one rule everybody already holds: turn the heat on and the
 * thing gets hotter. The engine has had a thermometer that can read
 * backwards since the fault list was written, and no scene ever put one on
 * screen, so that fault had never once been planted. Here it sits beside a
 * burner you light yourself, with a pot on top that boils while the fire is
 * lit — so a needle falling while the pot boils is wrong at a glance.
 *
 * Everything comes in pairs, left and right, so each piece has its twin a
 * hand's width away to be judged against. The dishes on the pass and the two
 * customers in the queue are the parts that do not need the burners.
 *
 * The flame and the food are sprites the shop and the dungeon builds already
 * use. No pack here has a stove, a knob or a thermometer, so those are drawn
 * in CSS, the way the drinks machine is.
 */

/** the two burners, left and right, each a complete set */
const STOVES = [
  { id: "L", x: 60, gaugeX: 4 },
  { id: "R", x: 190, gaugeX: 306 },
];
const STOVE_W = 110;

const DISHES = [
  { id: "dish1", x: 70, col: 54, row: 15 },
  { id: "dish2", x: 180, col: 55, row: 13 },
  { id: "dish3", x: 290, col: 54, row: 15 },
];

const CUSTOMERS = [
  { id: "customer1", x: 60, sheet: "personA" as const },
  { id: "customer2", x: 300, sheet: "personB" as const },
];

export const stage09Scene: SceneSpec = {
  id: "stage09",
  nameKey: "stage.stage09.name",
  introKey: "intro.stage09.line",
  goalKey: "goal.stage09",
  backgroundClass: "s9-kitchen",
  counters: [
    { id: "served", nameKey: "counter.orders", initial: 0, display: "number" },
    // no HUD widget reads these: the thermometers are how heat is shown
    { id: "heatL", nameKey: "counter.heat", initial: 0, max: 100, display: "number" },
    { id: "heatR", nameKey: "counter.heat", initial: 0, max: 100, display: "number" },
  ],
  flags: ["fireL", "fireR"],
  objects: [
    { id: "ordersHud", nameKey: "object.ordersHud", kind: "hud", x: 0, y: 0, counter: "served", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 560,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars", col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 380, maxY: 600 }],
    },

    ...STOVES.flatMap((s): ObjectSpec[] => [
      /* the range itself */
      {
        id: `stove${s.id}`,
        nameKey: `object.stove${s.id}`,
        kind: "decor",
        x: s.x,
        y: 180,
        z: 0,
        render: { className: "s9-stove", bar: { width: STOVE_W, height: 110 } },
        behaviors: [],
      },
      /* the pot on it, which boils while the fire under it is lit */
      {
        id: `pot${s.id}`,
        nameKey: `object.pot${s.id}`,
        kind: "decor",
        x: s.x + 20,
        y: 142,
        z: 1,
        render: { className: "s9-pot", bar: { width: 70, height: 40 } },
        behaviors: [{ t: "flagged", flag: `fire${s.id}`, onClass: "boiling" }],
      },
      /* the flame, drawn only while lit */
      {
        id: `flame${s.id}`,
        nameKey: `object.flame${s.id}`,
        kind: "decor",
        x: s.x + STOVE_W / 2,
        y: 214,
        z: 2,
        peerGroup: "flame",
        render: {
          className: "s9-flame",
          sprite: { sheet: "roguelike", col: 54, row: 7, scale: 2.2 },
          glow: { radius: 90, offsetX: 0, offsetY: -12 },
        },
        behaviors: [
          { t: "flagged", flag: `fire${s.id}`, onClass: "lit" },
          { t: "animate", name: "flicker", period: 0.6 },
        ],
      },
      /* the knob that lights it */
      {
        id: `knob${s.id}`,
        nameKey: `object.knob${s.id}`,
        kind: "sprite",
        x: s.x + STOVE_W / 2 - 15,
        y: 300,
        z: 2,
        peerGroup: "knob",
        render: { className: "s9-knob", bar: { width: 30, height: 30 } },
        behaviors: [
          { t: "clickable", action: { a: "toggle", flag: `fire${s.id}` } },
          { t: "flagged", flag: `fire${s.id}`, onClass: "on" },
        ],
      },
      /* and the thermometer beside it: the heat rises while the flame is lit */
      {
        id: `gauge${s.id}`,
        nameKey: `object.gauge${s.id}`,
        kind: "decor",
        x: s.gaugeX,
        y: 206,
        z: 2,
        peerGroup: "gauge",
        render: { className: "s9-gauge", bar: { width: 50, height: 50 } },
        behaviors: [
          { t: "pressure", counter: `heat${s.id}`, flag: `fire${s.id}`, rise: 30, fall: 15 },
          { t: "meter", counter: `heat${s.id}`, max: 100, invert: false },
        ],
      },
    ]),

    /* the pass, and the plates on it */
    {
      id: "pass",
      nameKey: "object.pass",
      kind: "decor",
      x: 20,
      y: 452,
      z: 0,
      render: { className: "s9-pass", bar: { width: 320, height: 22 } },
      behaviors: [],
    },
    ...DISHES.map(
      (d): ObjectSpec => ({
        id: d.id,
        nameKey: `object.${d.id}`,
        kind: "sprite",
        x: d.x,
        y: 470,
        z: 1,
        peerGroup: "dish",
        render: { sprite: { sheet: "roguelike", col: d.col, row: d.row, scale: 2.4 } },
        behaviors: [
          {
            t: "pickup",
            radius: 30,
            respawn: 6,
            onPickup: [{ a: "increment", counter: "served", by: 1 }],
          },
        ],
      })
    ),

    /* the queue, walking the same line at the same pace */
    ...CUSTOMERS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: 626,
        z: 2,
        peerGroup: "customer",
        render: { actor: streetActor(c.sheet) },
        behaviors: [
          { t: "patrol", axis: "x", min: 40, max: 320, speed: 40, flipSprite: false },
        ],
      })
    ),
  ],
};
