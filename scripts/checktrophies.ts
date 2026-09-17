/**
 * The trophy shelf: one trophy on the home wall for every mastered build.
 *
 * Run: npx tsx scripts/checktrophies.ts
 */
import { readFileSync } from "node:fs";
import { homeScene } from "../src/home/scene";
import {
  SHELF_ID,
  TROPHY_ART,
  TROPHY_ORDER,
  trophyLine,
  trophySlots,
  withTrophies,
} from "../src/home/trophies";
import { buildIdsFor } from "../src/office/schedule";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

const WINDOW = { from: 148, to: 208 };
const TROPHY_W = 24;

console.log("\nevery build has a trophy and a place on the wall");
{
  const all = buildIdsFor(99);
  is(TROPHY_ORDER.length === all.length && all.every((id) => TROPHY_ORDER.includes(id)),
     `the shelf holds exactly the ${all.length} builds`);
  is(all.every((id) => TROPHY_ART[id] && (TROPHY_ART[id].sprite || TROPHY_ART[id].prop)),
     "each one has art");
  const slots = trophySlots();
  is(slots.length === 9, `nine slots (${slots.length})`);
  const spans = slots.map((s) => ({ ...s, from: s.x - TROPHY_W / 2, to: s.x + TROPHY_W / 2 }));
  is(spans.every((s) => s.from >= 0 && s.to <= 360), "all on the wall");
  is(spans.every((s) => s.to <= WINDOW.from || s.from >= WINDOW.to), "none in front of the window");
  const overlap = spans.some((a, i) => spans.some((b, j) => i < j && a.from < b.to && b.from < a.to));
  is(!overlap, "none on top of another");
}

const added = (mastered: string[], year: number) => {
  const scene = withTrophies(homeScene, mastered, buildIdsFor(year));
  const before = new Set(homeScene.objects.map((o) => o.id));
  return scene.objects.filter((o) => !before.has(o.id));
};
const trophies = (objs: ReturnType<typeof added>) => objs.filter((o) => o.id.startsWith("trophy_"));

console.log("\nwhat year one with an empty book looks like");
{
  const objs = added([], 1);
  const t = trophies(objs);
  is(t.length === 7, `seven trophies (${t.length})`);
  is(t.every((o) => o.render.className?.includes("trophy-locked")), "all of them greyed out");
  is(!t.some((o) => o.id === "trophy_stage08" || o.id === "trophy_stage09"), "no mine or kitchen yet");
  const ids = homeScene.objects.map((o) => o.id);
  is(objs.every((o) => !ids.includes(o.id)), "no id clashes with the room");
  const stations = objs.filter((o) => o.behaviors.some((b) => b.t === "station"));
  is(stations.length === 1 && stations[0].id === SHELF_ID, "the shelf is the one station added");
  is(objs.every((o) => o.kind !== "player"), "nothing added walks");
}

console.log("\nmastered builds stand out");
{
  const t = trophies(added(["stage01", "stage08"], 2));
  const lit = t.filter((o) => !o.render.className?.includes("trophy-locked")).map((o) => o.id).sort();
  is(JSON.stringify(lit) === JSON.stringify(["trophy_stage01", "trophy_stage08"]),
     `only the mastered two are lit (${lit.join(",")})`);
  is(t.length === 8, "and year two has eight on the wall");
  is(trophies(added([], 3)).length === 9, "year three has all nine");
}

console.log("\nthe shelf says what is on it");
{
  const t = (k: string) => `<${k}>`;
  const tp = (k: string, p: Record<string, string>) => `<${k}|${JSON.stringify(p)}>`;
  is(trophyLine([], buildIdsFor(1), t, tp) === "<home.trophiesEmpty>", "nothing mastered, the empty line");
  const line = trophyLine(["stage01"], buildIdsFor(1), t, tp);
  is(line.startsWith("<home.trophiesLine|") && line.includes('"k":"1"') && line.includes('"m":"7"')
     && line.includes("<stage.stage01.name>"), `one mastered, named (${line})`);
}

console.log("\nthe office hangs it and answers it");
{
  const office = readFileSync("src/office/Office.tsx", "utf8");
  const home = office.slice(office.indexOf("const homeHere = useMemo("), office.indexOf("const laneHere"));
  is((home.match(/withTrophies\(/g) ?? []).length === 2, "both ways home carry the shelf");
  is(/id === SHELF_ID/.test(office) && /trophyLine\(/.test(office), "the shelf has something to say");
}

console.log(bad ? `\n${bad} FAIL` : "\nthe shelf holds");
process.exitCode = bad ? 1 : 0;
