import type { StageDef } from "../../core/types";

export const stage02: StageDef = {
  id: "stage02",
  nameKey: "stage.stage02.name",
  bugPool: [
    { id: "C1", objectIds: ["shield"], category: "no-action", descKey: "bug.C1.desc" },
    { id: "C2", objectIds: ["cat"], category: "weird-movement", descKey: "bug.C2.desc" },
    { id: "C3", objectIds: ["candle1"], category: "graphic", descKey: "bug.C3.desc" },
    { id: "C4", objectIds: ["potion"], category: "physics", descKey: "bug.C4.desc" },
    // the gold readout misbehaves, but blaming the apple is just as fair
    { id: "C5", objectIds: ["gold", "apple"], category: "logic", descKey: "bug.C5.desc" },
    { id: "C6", objectIds: ["inventory"], category: "logic", descKey: "bug.C6.desc" },
    { id: "C7", objectIds: ["clock"], category: "weird-movement", descKey: "bug.C7.desc" },
  ],
};
