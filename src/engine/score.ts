import type { ObjectSpec, SceneSpec } from "./types";
import type { Mutation } from "./generate";
import { FIELD_W, FIELD_H } from "../components/FieldScaler";
import { SHEETS } from "./sheets";

/** difficulty bands, 1 = tutorial … 4 = expert */
export type Band = 1 | 2 | 3 | 4;

/**
 * How much the object draws the eye. Big sprites near the middle of the screen
 * get looked at first, so a bug on them is easier to spot.
 */
/** on-screen size in px, whatever the object is drawn with */
function displaySize(o: ObjectSpec): number {
  const s = o.render.sprite;
  if (s) {
    const sheet = SHEETS[s.sheet];
    return sheet.tile * Math.max(s.spanX ?? 1, s.spanY ?? 1) * (s.scale ?? 3);
  }
  if (o.render.bar) return Math.max(o.render.bar.width, o.render.bar.height);
  return o.render.fontSize ?? 24;
}

function salience(o: ObjectSpec): number {
  const size = displaySize(o);
  const sizeScore = Math.min(1, size / 56); // 0…1
  const dx = (o.x - FIELD_W / 2) / (FIELD_W / 2);
  const dy = (o.y - FIELD_H / 2) / (FIELD_H / 2);
  const centreScore = 1 - Math.min(1, Math.hypot(dx, dy) / 1.4);
  const hudBonus = o.kind === "hud" || o.kind === "button" ? 0.3 : 0;
  return Math.min(1, sizeScore * 0.5 + centreScore * 0.5 + hudBonus);
}

/** distance to the nearest peer, normalised — a far comparison point is harder */
function peerDistance(scene: SceneSpec, o: ObjectSpec): number {
  if (!o.peerGroup) return 0;
  const peers = scene.objects.filter(
    (p) => p.id !== o.id && p.peerGroup === o.peerGroup
  );
  if (!peers.length) return 0;
  const nearest = Math.min(
    ...peers.map((p) => Math.hypot(p.x - o.x, p.y - o.y))
  );
  return Math.min(1, nearest / 300);
}

/**
 * Final difficulty for one mutation.
 * base mutator subtlety, made easier by salience and harder by a distant peer.
 */
export function difficulty(scene: SceneSpec, m: Mutation): number {
  const o = scene.objects.find((x) => x.id === m.target.objectId);
  if (!o) return m.bug.subtlety;
  // a far-away peer only makes the bug harder when spotting it means comparing
  // against that peer; a dead button or a wall you walk through needs no peer
  const distancePenalty = m.mutator.comparative
    ? peerDistance(scene, o) * 0.7
    : 0;
  return m.bug.subtlety - salience(o) * 0.9 + distancePenalty;
}

export function bandOf(score: number): Band {
  if (score < 1.5) return 1;
  if (score < 2.3) return 2;
  if (score < 3.1) return 3;
  return 4;
}

export interface ScoredMutation extends Mutation {
  score: number;
  band: Band;
}

export function scoreMutations(
  scene: SceneSpec,
  mutations: Mutation[]
): ScoredMutation[] {
  return mutations.map((m) => {
    const score = difficulty(scene, m);
    return { ...m, score, band: bandOf(score) };
  });
}
