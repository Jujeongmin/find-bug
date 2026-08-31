import type { StageDef } from "../../core/types";

export const stage06: StageDef = {
  id: "stage06",
  nameKey: "stage.stage06.name",
  bugPool: [
    { id: "G1", objectIds: ["leverC"], category: "no-action", descKey: "bug.G1.desc" },
    // both levers are miswired into each other — blaming either is fair
    { id: "G2", objectIds: ["leverA", "leverB"], category: "logic", descKey: "bug.G2.desc" },
    { id: "G3", objectIds: ["gears"], category: "weird-movement", descKey: "bug.G3.desc" },
    { id: "G4", objectIds: ["ceilingLight"], category: "graphic", descKey: "bug.G4.desc" },
    { id: "G5", objectIds: ["valve"], category: "no-action", descKey: "bug.G5.desc" },
    { id: "G6", objectIds: ["gauge"], category: "logic", descKey: "bug.G6.desc" },
    { id: "G7", objectIds: ["doorB"], category: "weird-movement", descKey: "bug.G7.desc" },
    { id: "G8", objectIds: ["alarmLight"], category: "logic", descKey: "bug.G8.desc" },
    { id: "G9", objectIds: ["plumberBot"], category: "graphic", descKey: "bug.G9.desc" },
  ],
};
