import type { SceneSpec } from "../engine/types";
import { stage01Scene } from "./stage01/scene";
import { stage02Scene } from "./stage02/scene";
import { stage03Scene } from "./stage03/scene";
import { stage05Scene } from "./stage05/scene";
import { stage06Scene } from "./stage06/scene";

/**
 * Scenes the engine drives. Stage 4 (card matching) stays a bespoke component —
 * its grid/match rules are the documented escape hatch from the data model.
 */
export const ENGINE_SCENES: SceneSpec[] = [
  stage01Scene,
  stage02Scene,
  stage03Scene,
  stage05Scene,
  stage06Scene,
];

export const SCENE_BY_ID: Record<string, SceneSpec> = Object.fromEntries(
  ENGINE_SCENES.map((s) => [s.id, s])
);
