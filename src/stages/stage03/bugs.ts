import type { StageDef } from "../../core/types";

export const stage03: StageDef = {
  id: "stage03",
  nameKey: "stage.stage03.name",
  bugPool: [
    { id: "D1", objectIds: ["jumpPadR"], category: "no-action", descKey: "bug.D1.desc" },
    { id: "D2", objectIds: ["movingPlatform"], category: "weird-movement", descKey: "bug.D2.desc" },
    { id: "D3", objectIds: ["torch1"], category: "graphic", descKey: "bug.D3.desc" },
    { id: "D4", objectIds: ["coins"], category: "physics", descKey: "bug.D4.desc" },
    // the counter is what misbehaves, but blaming the coins is just as fair
    { id: "D5", objectIds: ["coinCounter", "coins"], category: "logic", descKey: "bug.D5.desc" },
    { id: "D6", objectIds: ["player"], category: "physics", descKey: "bug.D6.desc" },
    { id: "D7", objectIds: ["batB"], category: "graphic", descKey: "bug.D7.desc" },
    { id: "D8", objectIds: ["spikes"], category: "no-action", descKey: "bug.D8.desc" },
  ],
};
