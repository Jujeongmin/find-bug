import * as fs from "fs";
import * as path from "path";
import { generateMutations } from "../src/engine/generate";
import { scoreMutations } from "../src/engine/score";
import { buildCurriculum } from "../src/engine/curriculum";
import { ENGINE_SCENES, SCENE_BY_ID } from "../src/stages/registry";
import { translateParams, translate } from "../src/i18n";
import { stage04 } from "../src/stages/stage04/bugs";

const cur = buildCurriculum(ENGINE_SCENES, 30);

/** which curriculum stages can serve a given scene+band */
function stagesFor(sceneId: string, band: number): number[] {
  return cur
    .filter((s) => s.sceneId === sceneId && band >= s.minBand && band <= s.maxBand)
    .map((s) => s.n);
}

interface Row {
  fullId: string;
  scene: string;
  sceneName: string;
  mutator: string;
  category: string;
  categoryLabel: string;
  answers: string;
  desc: string;
  score: number;
  band: number;
  stages: number[];
}

const rows: Row[] = [];
for (const scene of ENGINE_SCENES) {
  const scored = scoreMutations(scene, generateMutations(scene)).sort(
    (a, b) => a.score - b.score
  );
  for (const m of scored) {
    const params = {
      ...m.bug.descParams,
      obj: translate("ko", m.bug.descParams.obj),
      counter: m.bug.descParams.counter
        ? translate("ko", m.bug.descParams.counter)
        : "",
    };
    rows.push({
      fullId: `${scene.id}:${m.bug.id}`,
      scene: scene.id,
      sceneName: translate("ko", scene.nameKey),
      mutator: m.mutator.id,
      category: m.bug.category,
      categoryLabel: translate("ko", `category.${m.bug.category}`),
      answers: m.bug.objectIds
        .map((id) => translate("ko", scene.objects.find((o) => o.id === id)?.nameKey ?? id))
        .join(" / "),
      desc: translateParams("ko", m.bug.descKey, params),
      score: Number(m.score.toFixed(2)),
      band: m.band,
      stages: stagesFor(scene.id, m.band),
    });
  }
}

/* bespoke card stage */
for (const b of stage04.bugPool) {
  rows.push({
    fullId: `stage04:${b.id}`,
    scene: "stage04",
    sceneName: translate("ko", "stage.stage04.name"),
    mutator: "(수기)",
    category: b.category,
    categoryLabel: translate("ko", `category.${b.category}`),
    answers: b.objectIds.map((id) => translate("ko", `object.${id}`)).join(" / "),
    desc: translate("ko", b.descKey),
    score: 0,
    band: 0,
    stages: cur.filter((s) => s.bespoke).map((s) => s.n),
  });
}

/* ---- markdown ---- */
const md: string[] = [
  "# 버그 검수 리스트",
  "",
  `총 ${rows.length}개 · 씬 ${ENGINE_SCENES.length + 1}개 · 스테이지 ${cur.length}개`,
  "",
  "빼려면 `src/engine/exclusions.ts`의 `EXCLUDED_BUGS`에 ID를 붙여넣으세요.",
  "",
];
const bySceneOrder = [...ENGINE_SCENES.map((s) => s.id), "stage04"];
for (const sceneId of bySceneOrder) {
  const list = rows.filter((r) => r.scene === sceneId);
  if (!list.length) continue;
  md.push(`## ${list[0].sceneName} (${sceneId}) — ${list.length}개`);
  md.push("");
  md.push("| 난이도 | 밴드 | 카테고리 | 정답 지목 | 설명 | 등장 스테이지 | ID |");
  md.push("|---|---|---|---|---|---|---|");
  for (const r of list) {
    md.push(
      `| ${r.score || "-"} | ${r.band || "-"} | ${r.categoryLabel} | ${r.answers} | ${r.desc} | ${r.stages.join(", ") || "-"} | \`${r.fullId}\` |`
    );
  }
  md.push("");
}

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(path.join("docs", "bug-review.md"), md.join("\n"), "utf8");
fs.writeFileSync(
  path.join("docs", "bug-review.json"),
  JSON.stringify({ rows, curriculum: cur }, null, 2),
  "utf8"
);
console.log(`wrote docs/bug-review.md and docs/bug-review.json (${rows.length} bugs)`);
