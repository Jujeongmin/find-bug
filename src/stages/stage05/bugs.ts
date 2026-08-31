import type { StageDef } from "../../core/types";

export const stage05: StageDef = {
  id: "stage05",
  nameKey: "stage.stage05.name",
  bugPool: [
    { id: "F1", objectIds: ["crystal"], category: "no-action", descKey: "bug.F1.desc" },
    { id: "F2", objectIds: ["robot"], category: "weird-movement", descKey: "bug.F2.desc" },
    { id: "F3", objectIds: ["fire"], category: "graphic", descKey: "bug.F3.desc" },
    { id: "F4", objectIds: ["shelf5"], category: "physics", descKey: "bug.F4.desc" },
    { id: "F5", objectIds: ["stockCounter"], category: "logic", descKey: "bug.F5.desc" },
    // the readout and the bar disagree — blaming either one is fair
    { id: "F6", objectIds: ["timeLeft", "progressBar"], category: "logic", descKey: "bug.F6.desc" },
    { id: "F7", objectIds: ["clock5"], category: "weird-movement", descKey: "bug.F7.desc" },
    { id: "F8", objectIds: ["brewBtn", "progressBar"], category: "logic", descKey: "bug.F8.desc" },
    { id: "F9", objectIds: ["window"], category: "graphic", descKey: "bug.F9.desc" },
  ],
};
