import type { StageDef } from "../../core/types";

export const stage04: StageDef = {
  id: "stage04",
  nameKey: "stage.stage04.name",
  bugPool: [
    { id: "E1", objectIds: ["cards"], category: "no-action", descKey: "bug.E1.desc" },
    { id: "E2", objectIds: ["cards"], category: "weird-movement", descKey: "bug.E2.desc" },
    { id: "E4", objectIds: ["attemptCounter"], category: "logic", descKey: "bug.E4.desc" },
    { id: "E5", objectIds: ["shuffleBtn"], category: "no-action", descKey: "bug.E5.desc" },
    { id: "E6", objectIds: ["pot"], category: "physics", descKey: "bug.E6.desc" },
    { id: "E7", objectIds: ["frame"], category: "graphic", descKey: "bug.E7.desc" },
    { id: "E8", objectIds: ["cards"], category: "logic", descKey: "bug.E8.desc" },
  ],
};
