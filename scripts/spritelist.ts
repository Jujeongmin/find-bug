/**
 * Writes dev/used-sprites.json: every sheet tile the scenes reference, with the
 * object it belongs to.
 *
 * Node cannot decode the PNGs without a bundler, so the pixel work happens in
 * the browser (dev/cropcheck.html reads this file). Splitting it this way keeps
 * the scene data on the Node side, where it already lives.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { SHEETS } from "../src/engine/sheets";
import { ENGINE_SCENES } from "../src/stages/registry";
import { officeScene } from "../src/office/scene";
import { homeScene } from "../src/home/scene";
import { streetScene } from "../src/street/scene";
import { laneScene } from "../src/street/lane";
import type { SceneSpec } from "../src/engine/types";
import ko from "../src/i18n/ko.json";

const names = ko as Record<string, string>;
const scenes: SceneSpec[] = [...ENGINE_SCENES, officeScene, homeScene, streetScene, laneScene];

interface Cell {
  scene: string;
  id: string;
  name: string;
  sheet: string;
  col: number;
  row: number;
  spanX: number;
  spanY: number;
  tile: number;
  margin: number;
}

const out: Cell[] = [];
const seen = new Set<string>();
for (const scene of scenes) {
  for (const o of scene.objects) {
    const s = o.render.sprite;
    if (!s) continue;
    const g = SHEETS[s.sheet];
    const key = `${s.sheet}:${s.col}:${s.row}:${s.spanX ?? 1}:${s.spanY ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      scene: scene.id,
      id: o.id,
      name: names[o.nameKey] ?? o.nameKey,
      sheet: s.sheet,
      col: s.col,
      row: s.row,
      spanX: s.spanX ?? 1,
      spanY: s.spanY ?? 1,
      tile: g.tile,
      margin: g.margin,
    });
  }
}

mkdirSync("dev", { recursive: true });
writeFileSync("dev/used-sprites.json", JSON.stringify(out, null, 1));
console.log(`wrote dev/used-sprites.json (${out.length} distinct tiles)`);
