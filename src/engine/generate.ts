import type { GeneratedBug, SceneSpec } from "./types";
import { MUTATORS, type Mutator, type Target } from "./mutators";
import { isExcluded } from "./exclusions";

export interface Mutation {
  bug: GeneratedBug;
  mutator: Mutator;
  target: Target;
}

/**
 * Enumerates every fair bug a scene can host.
 * Fairness rule: peer-requiring mutators need a visible same-group sibling.
 *
 * Two mutations that share an (object, category) answer are both kept — only
 * one bug is ever live in a round, so they can never be ambiguous against each
 * other, and keeping both widens the pool a difficulty band can draw from.
 */
export function generateMutations(
  scene: SceneSpec,
  mutators: Mutator[] = MUTATORS
): Mutation[] {
  const out: Mutation[] = [];

  for (const m of mutators) {
    for (const target of m.candidates(scene)) {
      const obj = scene.objects.find((o) => o.id === target.objectId);
      if (!obj) continue;

      if (m.requiresPeer) {
        const hasPeer =
          obj.peerGroup !== undefined &&
          scene.objects.some(
            (p) => p.id !== obj.id && p.peerGroup === obj.peerGroup
          );
        if (!hasPeer) continue;
      }

      const answerIds = m.answerIds(scene, target);
      const bugId = `${m.id}:${target.objectId}${target.note ? ":" + target.note : ""}`;
      // dropped during review
      if (isExcluded(scene.id, bugId)) continue;

      out.push({
        mutator: m,
        target,
        bug: {
          id: bugId,
          objectIds: answerIds,
          category: m.category,
          alsoCategories: m.alsoCategories,
          descKey: m.descKey,
          descParams: {
            obj: obj.nameKey,
            ...(m.descParams ? m.descParams(scene, target) : {}),
          },
          subtlety: m.subtlety,
        },
      });
    }
  }
  return out;
}

/** Applies one mutation, returning the buggy scene. */
export function applyMutation(scene: SceneSpec, mutation: Mutation): SceneSpec {
  return mutation.mutator.apply(scene, mutation.target);
}

/** Picks a random mutation, avoiding the one used last round. */
export function pickMutation(
  mutations: Mutation[],
  excludeId?: string,
  prefer?: readonly string[]
): Mutation {
  const fresh =
    mutations.length > 1 && excludeId
      ? mutations.filter((m) => m.bug.id !== excludeId)
      : mutations;
  // the ones asked for, if any of them are here; everything otherwise
  const wanted = prefer?.length
    ? fresh.filter((m) => prefer.includes(m.bug.id))
    : [];
  const pool = wanted.length ? wanted : fresh;
  return pool[Math.floor(Math.random() * pool.length)];
}
