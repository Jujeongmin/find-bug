import type { ObjectSpec, RenderSpec, SceneSpec } from "../engine/types";
import { buildIdsFor } from "../office/schedule";

/**
 * The shelf on the wall at home: a trophy for every mastered build.
 *
 * Mastery already made those builds cost nothing to inspect, which is felt
 * and not seen. This is the seen half, in the room the player wakes up in and
 * goes to bed in. A build that is open and not mastered is a grey outline, so
 * the wall says what is left as well as what is done; a build that has not
 * arrived yet has an empty place and nothing in it.
 *
 * Nothing is stored. The wall is drawn from the same mastered list the office
 * works out from the book, so a wipe takes the trophies with the book.
 */

/** the builds in the order they hang: year one's rotation, then the later years */
export const TROPHY_ORDER: readonly string[] = buildIdsFor(Number.MAX_SAFE_INTEGER);

export const SHELF_ID = "trophyShelf";

/** each build's own art, borrowed from its own scene, about 24px on a side */
export const TROPHY_ART: Record<string, RenderSpec> = {
  stage01: { sprite: { sheet: "platchars", col: 2, row: 1, scale: 1 } },
  stage02: { sprite: { sheet: "roguelike", col: 54, row: 12, scale: 1.5 } },
  stage03: { sprite: { sheet: "platchars", col: 7, row: 2, scale: 1 } },
  stage05: { sprite: { sheet: "critter", col: 0, row: 0, scale: 1.5 } },
  stage06: { sprite: { sheet: "platchars", col: 0, row: 0, scale: 1 } },
  stage07: { sprite: { sheet: "platformer", col: 11, row: 7, scale: 1.35 } },
  stage04: { prop: { id: "card", scale: 0.75 } },
  stage08: { sprite: { sheet: "dungeon", col: 11, row: 10, scale: 1.5 } },
  stage09: { sprite: { sheet: "roguelike", col: 55, row: 13, scale: 1.5 } },
};

/** where the trophies stand: on the plank, either side of the window */
const SHELF_Y = 70;
const PLANKS = [
  { id: SHELF_ID, x: 16, width: 124, slots: 5 },
  { id: "trophyShelfRight", x: 216, width: 100, slots: 4 },
];
const SLOT_W = 24;

export function trophySlots(): { sceneId: string; x: number }[] {
  const out: { sceneId: string; x: number }[] = [];
  let i = 0;
  for (const p of PLANKS) {
    for (let s = 0; s < p.slots && i < TROPHY_ORDER.length; s++, i++) {
      out.push({ sceneId: TROPHY_ORDER[i], x: p.x + 14 + s * SLOT_W });
    }
  }
  return out;
}

export function withTrophies(
  scene: SceneSpec,
  mastered: readonly string[],
  open: readonly string[]
): SceneSpec {
  const planks: ObjectSpec[] = PLANKS.map((p) => ({
    id: p.id,
    nameKey: "object.trophyShelf",
    kind: "decor",
    x: p.x,
    y: SHELF_Y,
    render: { className: "trophy-shelf", bar: { width: p.width, height: 4 } },
    // the left plank is the one you can reach from the floor
    behaviors:
      p.id === SHELF_ID
        ? [{ t: "station", radius: 90, labelKey: "home.trophies" }]
        : [],
  }));
  const trophies: ObjectSpec[] = trophySlots()
    .filter((s) => open.includes(s.sceneId))
    .map((s) => {
      const art = TROPHY_ART[s.sceneId];
      const lit = mastered.includes(s.sceneId);
      return {
        id: `trophy_${s.sceneId}`,
        nameKey: "object.trophy",
        kind: "sprite",
        x: s.x,
        y: SHELF_Y,
        z: 1,
        render: { ...art, className: lit ? "trophy" : "trophy trophy-locked" },
        behaviors: [],
      };
    });
  return { ...scene, objects: [...scene.objects, ...planks, ...trophies] };
}

/** what the shelf says when the player stands at it */
export function trophyLine(
  mastered: readonly string[],
  open: readonly string[],
  t: (key: string) => string,
  tp: (key: string, params: Record<string, string>) => string
): string {
  const lit = TROPHY_ORDER.filter((id) => open.includes(id) && mastered.includes(id));
  if (!lit.length) return t("home.trophiesEmpty");
  return tp("home.trophiesLine", {
    k: String(lit.length),
    m: String(TROPHY_ORDER.filter((id) => open.includes(id)).length),
    names: lit.map((id) => t(`stage.${id}.name`)).join(", "),
  });
}
