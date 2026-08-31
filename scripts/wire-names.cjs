const fs = require("fs");
const miss = [];
const swap = (s, a, b, tag) => { if (!s.includes(a)) { miss.push(tag); return s; } return s.split(a).join(b); };

/* curriculum: each slot carries its own name key */
let c = fs.readFileSync("src/engine/curriculum.ts", "utf8");
c = swap(c, "  /** 1-based stage number shown to the player */\n  n: number;\n  id: string;",
  "  /** 1-based stage number shown to the player */\n  n: number;\n  id: string;\n  /** i18n key for this slot's own name, independent of the scene it uses */\n  nameKey: string;", "type");
c = swap(c, "  // renumber in case slots were skipped\n  return out.map((s, i) => ({ ...s, n: i + 1 }));",
  "  // renumber in case slots were skipped, then name each slot by its position\n  return out.map((s, i) => ({\n    ...s,\n    n: i + 1,\n    nameKey: `stage.build.${String(i + 1).padStart(2, \"0\")}`,\n  }));", "naming");
/* the two builder branches need the field present before renumbering */
c = swap(c, "      out.push({\n        n,\n        id: `s${n}-stage04`,", "      out.push({\n        n,\n        nameKey: \"\",\n        id: `s${n}-stage04`,", "bespoke push");
c = swap(c, "    out.push({\n      n,\n      id: `s${n}-${picked.id}`,", "    out.push({\n      n,\n      nameKey: \"\",\n      id: `s${n}-${picked.id}`,", "engine push");
fs.writeFileSync("src/engine/curriculum.ts", c);

/* stage list shows the slot name; the scene stays a visual surprise */
let a = fs.readFileSync("src/App.tsx", "utf8");
a = swap(a, "                    <span className=\"cell-name\">\n                      {t(`stage.${s.sceneId}.name`)}\n                    </span>",
  "                    <span className=\"cell-name\">{t(s.nameKey)}</span>", "cell name");
a = swap(a, "            stageNo={stage.n}\n            tutorial={stage.n === 1}",
  "            stageNo={stage.n}\n            title={t(stage.nameKey)}\n            tutorial={stage.n === 1}", "engine title");
a = swap(a, "            playtest={PLAYTEST}\n            stageNo={stage.n}\n          />",
  "            playtest={PLAYTEST}\n            stageNo={stage.n}\n            title={t(stage.nameKey)}\n          />", "stage04 title");
fs.writeFileSync("src/App.tsx", a);

/* headers prefer the slot name, falling back to the scene name */
let e = fs.readFileSync("src/engine/EngineStage.tsx", "utf8");
e = swap(e, "  /** stage number shown in the header */\n  stageNo?: number;",
  "  /** stage number shown in the header */\n  stageNo?: number;\n  /** this slot's own name; falls back to the scene name */\n  title?: string;", "engine prop type");
e = swap(e, "  stageNo,\n  tutorial = false,", "  stageNo,\n  title,\n  tutorial = false,", "engine prop");
e = swap(e, "          {stageNo ? stageNo + \". \" : \"\"}\n          {t(scene.nameKey)}", "          {stageNo ? stageNo + \". \" : \"\"}\n          {title ?? t(scene.nameKey)}", "engine header");
fs.writeFileSync("src/engine/EngineStage.tsx", e);

let s4 = fs.readFileSync("src/stages/stage04/Stage04.tsx", "utf8");
s4 = swap(s4, "  playtest?: boolean;\n  stageNo?: number;\n}", "  playtest?: boolean;\n  stageNo?: number;\n  title?: string;\n}", "s4 prop type");
s4 = swap(s4, "  playtest = false,\n  stageNo,\n}: Props) {", "  playtest = false,\n  stageNo,\n  title,\n}: Props) {", "s4 prop");
s4 = swap(s4, "          {stageNo ? stageNo + \". \" : \"\"}\n          {t(\"stage.stage04.name\")}", "          {stageNo ? stageNo + \". \" : \"\"}\n          {title ?? t(\"stage.stage04.name\")}", "s4 header");
fs.writeFileSync("src/stages/stage04/Stage04.tsx", s4);

console.log(miss.length ? "MISSED: " + miss.join(", ") : "ok");
