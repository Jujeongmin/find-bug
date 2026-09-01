/**
 * Which objects actually overlap on screen.
 *
 * zSwap says "drawn on top of another object", and that is only something a
 * player can see where two things genuinely share pixels. No scene declares
 * `overlaps`, so the mutator has never once fired; this is what it could be
 * pointed at without inventing a fault nobody can look at.
 */
import { ENGINE_SCENES } from "../src/stages/registry";
import { SHEETS } from "../src/engine/sheets";
import type { ObjectSpec } from "../src/engine/types";

const box = (o: ObjectSpec) => {
  const r = o.render;
  if (r.bar) return { x: o.x, y: o.y, w: r.bar.width, h: r.bar.height };
  if (r.sprite) {
    const t = SHEETS[r.sprite.sheet].tile * (r.sprite.scale ?? 3);
    const w = t * (r.sprite.spanX ?? 1);
    const h = t * (r.sprite.spanY ?? 1);
    return { x: o.x - w / 2, y: o.y - h, w, h };
  }
  return null;
};

for (const s of ENGINE_SCENES) {
  const hits: string[] = [];
  const objs = s.objects.filter((o) => o.kind !== "hud" && o.kind !== "button");
  for (let i = 0; i < objs.length; i++)
    for (let j = i + 1; j < objs.length; j++) {
      const a = box(objs[i]), b = box(objs[j]);
      if (!a || !b) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 6 && oy > 6)
        hits.push(`${objs[i].id} × ${objs[j].id}  ${Math.round(ox)}×${Math.round(oy)}px`);
    }
  console.log(`\n${s.id}: ${hits.length}`);
  for (const h of hits.slice(0, 8)) console.log("   " + h);
}
