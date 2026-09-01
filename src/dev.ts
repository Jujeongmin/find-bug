/**
 * Whether the testing surfaces exist in this build.
 *
 * They were tied to import.meta.env.DEV, which is exactly right for the game
 * that ships and wrong for the build before it: the deployed copy is the one
 * worth checking, and on that copy the defect list, the build jump and the
 * clock jump were all gone. Checking the thing you are about to release is not
 * the same as handing the answers to whoever finds the address bar.
 *
 * So it is a flag, on by default on the dev server and turned on for a build
 * with `npm run build:debug`. An ordinary build folds it to false and every
 * surface behind it becomes unreachable — checked by loading the built game
 * and asking for ?debug, which gives the ordinary morning. The code itself is
 * still in the bundle, since the constant does not propagate across modules
 * far enough for Rollup to drop the components; nothing routes to it, and no
 * answer is in there to read, because every defect is generated at runtime.
 */
export const DEV_TOOLS =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === "1";

/** a query parameter, but only where the testing surfaces exist at all */
export const devParam = (name: string) =>
  DEV_TOOLS ? new URLSearchParams(location.search).get(name) : null;

export const devFlag = (name: string) =>
  DEV_TOOLS && new URLSearchParams(location.search).has(name);
