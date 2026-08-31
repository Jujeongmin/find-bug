import { generateMutations } from "./generate";
import { scoreMutations, type Band, type ScoredMutation } from "./score";
import type { SceneSpec } from "./types";

export interface CurriculumStage {
  /** 1-based stage number shown to the player */
  n: number;
  id: string;
  /** i18n key for this slot's own name, independent of the scene it uses */
  nameKey: string;
  sceneId: string;
  /** inclusive band range this stage draws bugs from */
  minBand: Band;
  maxBand: Band;
  /** 1-3 stars, for display */
  stars: 1 | 2 | 3;
  /** true for the bespoke card stage, which has its own component */
  bespoke?: boolean;
}

/** minimum pool size for a stage to be worth shipping */
export const MIN_POOL = 3;

const BAND_SCHEDULE: { upTo: number; min: Band; max: Band; stars: 1 | 2 | 3 }[] = [
  // stage 1 teaches the report loop, so it only ever draws the most obvious bugs
  { upTo: 1, min: 1, max: 1, stars: 1 },
  { upTo: 5, min: 1, max: 2, stars: 1 },
  { upTo: 14, min: 2, max: 2, stars: 1 },
  { upTo: 22, min: 2, max: 3, stars: 2 },
  { upTo: 27, min: 3, max: 3, stars: 2 },
  { upTo: 99, min: 3, max: 4, stars: 3 },
];

function scheduleFor(n: number) {
  return BAND_SCHEDULE.find((s) => n <= s.upTo)!;
}

export function poolFor(
  scene: SceneSpec,
  minBand: Band,
  maxBand: Band
): ScoredMutation[] {
  return scoreMutations(scene, generateMutations(scene)).filter(
    (m) => m.band >= minBand && m.band <= maxBand
  );
}

/**
 * Lays out the stage list: scenes rotate so the same one never runs twice in a
 * row, difficulty rises with the stage number, and the bespoke card stage is
 * slotted in at two fixed points. A (scene, band) pair with too few bugs is
 * skipped in favour of the next scene in the rotation.
 */
export function buildCurriculum(
  scenes: SceneSpec[],
  total: number,
  bespokeSlots: number[] = [8, 20]
): CurriculumStage[] {
  const out: CurriculumStage[] = [];
  let rot = 0;

  for (let n = 1; n <= total; n++) {
    const sch = scheduleFor(n);

    if (bespokeSlots.includes(n)) {
      out.push({
        n,
        nameKey: "",
        id: `s${n}-stage04`,
        sceneId: "stage04",
        minBand: sch.min,
        maxBand: sch.max,
        stars: sch.stars,
        bespoke: true,
      });
      continue;
    }

    // walk the rotation until a scene has enough bugs in this band range and
    // isn't the one we just used
    let picked: SceneSpec | null = null;
    for (let i = 0; i < scenes.length * 2; i++) {
      const cand = scenes[(rot + i) % scenes.length];
      if (out.length && out[out.length - 1].sceneId === cand.id) continue;
      if (poolFor(cand, sch.min, sch.max).length >= MIN_POOL) {
        picked = cand;
        rot = (rot + i + 1) % scenes.length;
        break;
      }
    }
    if (!picked) continue; // no scene can serve this band; skip the slot

    out.push({
      n,
      nameKey: "",
      id: `s${n}-${picked.id}`,
      sceneId: picked.id,
      minBand: sch.min,
      maxBand: sch.max,
      stars: sch.stars,
    });
  }

  // renumber in case slots were skipped, then name each slot by its position
  return out.map((s, i) => ({
    ...s,
    n: i + 1,
    nameKey: `stage.build.${String(i + 1).padStart(2, "0")}`,
  }));
}
