import type { SceneSpec } from "../../engine/types";

/**
 * A drinks machine.
 *
 * Stage six's notes record that a wiring bench was tried and thrown away: no
 * one recognises a wiring bench, so there was no intuition for a fault to
 * violate. Everybody knows a vending machine. You press the picture of the
 * thing you want and that thing comes out, and when it does not, nobody needs
 * the rule explained to them.
 *
 * Which is what the crossed-wires fault has been waiting for. It swaps two
 * links, and until this scene existed no scene declared any, so the mutator
 * had never once fired in front of a player.
 */

const DRINKS = [
  { id: "Cola", x: 52, hue: "cola" },
  { id: "Soda", x: 154, hue: "soda" },
  { id: "Juice", x: 256, hue: "juice" },
];

export const stage07Scene: SceneSpec = {
  id: "stage07",
  nameKey: "stage.stage07.name",
  introKey: "intro.stage07.line",
  goalKey: "goal.stage07",
  backgroundClass: "s7-room",
  counters: [
    { id: "served", nameKey: "counter.served", initial: 0, display: "number" },
  ],
  /*
   * One wire per button, and the wire is the whole point of the machine: the
   * button you press is a promise about which drink drops.
   */
  links: DRINKS.map((d) => ({
    id: `wire${d.id}`,
    from: `btn${d.id}`,
    to: `drink${d.id}`,
    duration: 1.5,
  })),
  objects: [
    { id: "servedHud", nameKey: "object.servedHud", kind: "hud", x: 0, y: 0, counter: "served", render: {}, behaviors: [] },

    /* the cabinet, and the glass across the front of it */
    {
      id: "vendBody",
      nameKey: "object.vendBody",
      kind: "decor",
      x: 20,
      y: 70,
      z: 0,
      render: { className: "s7-body", bar: { width: 320, height: 520 } },
      behaviors: [],
    },
    {
      id: "vendWindow",
      nameKey: "object.vendWindow",
      kind: "decor",
      x: 34,
      y: 96,
      z: 1,
      // just deep enough for the shelf: the empty half below the cans made the
      // drop read as a fall through nothing rather than a can leaving a machine
      render: { className: "s7-window", bar: { width: 292, height: 152 } },
      behaviors: [],
    },

    /* three cans on the shelf, each waiting on its own wire */
    ...DRINKS.map((d) => ({
      id: `drink${d.id}`,
      nameKey: `object.drink${d.id}`,
      kind: "decor" as const,
      x: d.x,
      y: 132,
      z: 2,
      peerGroup: "drink",
      render: {
        className: `s7-can s7-${d.hue}`,
        bar: { width: 52, height: 96 },
      },
      behaviors: [],
    })),

    /* and the three buttons that claim to fetch them */
    ...DRINKS.map((d) => ({
      id: `btn${d.id}`,
      nameKey: `object.btn${d.id}`,
      kind: "decor" as const,
      x: d.x,
      y: 366,
      z: 2,
      peerGroup: "vendBtn",
      render: {
        className: `s7-btn s7-${d.hue}`,
        bar: { width: 52, height: 52 },
      },
      behaviors: [
        {
          t: "clickable" as const,
          action: [
            { a: "trigger" as const, target: `btn${d.id}` },
            { a: "increment" as const, counter: "served", by: 1 },
          ],
        },
      ],
    })),

    /*
     * The flap over the mouth of the tray.
     *
     * Without it the can lands in front of the machine rather than inside it,
     * which is the difference between a drink being dispensed and a brick
     * falling down a wall. It is drawn above the cans so they pass behind it.
     */
    {
      id: "vendFlap",
      nameKey: "object.vendTray",
      kind: "decor" as const,
      x: 44,
      y: 452,
      z: 4,
      render: { className: "s7-flap", bar: { width: 272, height: 22 } },
      behaviors: [],
    },

    /* where it lands */
    {
      id: "vendTray",
      nameKey: "object.vendTray",
      kind: "decor",
      x: 34,
      y: 452,
      z: 1,
      render: { className: "s7-tray", bar: { width: 292, height: 104 } },
      behaviors: [],
    },
  ],
};
