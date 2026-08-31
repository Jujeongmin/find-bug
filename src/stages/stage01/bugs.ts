import type { StageDef } from "../../core/types";

export const stage01: StageDef = {
  id: "stage01",
  nameKey: "stage.stage01.name",
  bugPool: [
    { id: "B1", objectIds: ["attackBtn"], category: "no-action", descKey: "bug.B1.desc" },
    { id: "B2", objectIds: ["slimeB"], category: "weird-movement", descKey: "bug.B2.desc" },
    { id: "B3", objectIds: ["player"], category: "graphic", descKey: "bug.B3.desc" },
    { id: "B4", objectIds: ["potion"], category: "physics", descKey: "bug.B4.desc" },
    { id: "B5", objectIds: ["score"], category: "logic", descKey: "bug.B5.desc" },
    { id: "B6", objectIds: ["tree1"], category: "physics", descKey: "bug.B6.desc" },
  ],
};
