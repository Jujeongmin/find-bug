import type { SceneSpec } from "../engine/types";
import { stage01Scene } from "./stage01/scene";
import { stage02Scene } from "./stage02/scene";
import { stage03Scene } from "./stage03/scene";
import { stage05Scene } from "./stage05/scene";
import { stage06Scene } from "./stage06/scene";
import { stage07Scene } from "./stage07/scene";
import { stage08Scene } from "./stage08/scene";
import { stage09Scene } from "./stage09/scene";
import { stage10Scene } from "./stage10/scene";

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
  stage07Scene,
  stage08Scene,
  stage09Scene,
  stage10Scene,
];

export const SCENE_BY_ID: Record<string, SceneSpec> = Object.fromEntries(
  ENGINE_SCENES.map((s) => [s.id, s])
);

/**
 * The year a build first reaches the machines.
 *
 * A finished run is a year, and a new year is a reason to start the next run:
 * builds listed here join the rotation from their year on. Anything not listed
 * arrives in year one — which is every build the game shipped with, so year
 * one is exactly the game it was.
 *
 * Ids must pass the server's book pattern, `stage` and two digits.
 */
export const SCENE_YEAR: Readonly<Record<string, number>> = { stage08: 2, stage09: 3, stage10: 4 };
