/**
 * Builds dev/used-sprites.html: every sprite the scenes actually reference,
 * drawn at 5x next to the name the player is shown.
 *
 * Two rounds of art bugs came from sprites whose tile did not match their name
 * (a "sword" that drew a scroll, a "cauldron" that drew a hooded figure). Both
 * were only catchable by looking, so this makes looking cheap: one page, one
 * pass, name beside picture.
 *
 * Run: npm run sprites   then open /dev/used-sprites.html on the dev server.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { SHEETS } from "../src/engine/sheets";
import { ENGINE_SCENES } from "../src/stages/registry";
import ko from "../src/i18n/ko.json";

const names = ko as Record<string, string>;

interface Row {
  scene: string;
  id: string;
  name: string;
  sheet: string;
  col: number;
  row: number;
  scale: number;
}

const rows: Row[] = [];
for (const scene of ENGINE_SCENES) {
  for (const o of scene.objects) {
    const s = o.render.sprite;
    if (!s) continue;
    rows.push({
      scene: scene.id,
      id: o.id,
      name: names[o.nameKey] ?? o.nameKey,
      sheet: s.sheet,
      col: s.col,
      row: s.row,
      scale: s.scale ?? 1,
    });
  }
}

const cells = rows
  .map((r) => {
    const s = SHEETS[r.sheet as keyof typeof SHEETS];
    const step = (s.tile + s.margin) * 5;
    const size = s.tile * 5;
    return `<figure>
  <div class="s" style="width:${size}px;height:${size}px;
    background-image:url(/src/assets/sheets/${r.sheet}.png);
    background-position:${-r.col * step}px ${-r.row * step}px;
    background-size:${s.cols * step}px ${s.rows * step}px"></div>
  <figcaption><b>${r.name}</b><br>${r.scene} · ${r.id}<br>
  <span class="t">${r.sheet} ${r.col},${r.row} ×${r.scale}</span></figcaption>
</figure>`;
  })
  .join("\n");

const html = `<!doctype html><meta charset="utf-8"><title>used sprites</title>
<style>
body{background:#15151a;color:#e6e6ea;font:13px system-ui,sans-serif;margin:0;padding:16px}
h1{font-size:15px;color:#9ad;margin:0 0 12px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;width:150px;background:#22222a;border-radius:6px;padding:8px;text-align:center}
.s{image-rendering:pixelated;margin:0 auto 6px;background-color:#0d0d11;border-radius:4px}
figcaption{font-size:11px;line-height:1.45}
.t{color:#8a8a99;font-family:monospace;font-size:10px}
</style>
<h1>스프라이트 대조표 — 이름과 그림이 맞는지 확인 (${rows.length}개)</h1>
<div class="grid">
${cells}
</div>
`;

mkdirSync("dev", { recursive: true });
writeFileSync("dev/used-sprites.html", html);
console.log(`wrote dev/used-sprites.html (${rows.length} sprites)`);
