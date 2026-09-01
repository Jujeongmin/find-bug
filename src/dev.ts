/**
 * Whether the testing surfaces exist in this build.
 *
 * They were tied to import.meta.env.DEV, which is exactly right for the game
 * that ships and wrong for the build before it: the deployed copy is the one
 * worth checking, and on that copy the defect list, the build jump and the
 * clock jump were all gone. Checking the thing you are about to release is not
 * the same as handing the answers to whoever finds the address bar.
 *
 * So it is a flag, and while the game is still being built it is on — in .env,
 * which means an ordinary build and an ordinary deploy both carry the tools.
 * That is deliberate: the copy on the server is the one worth checking, and a
 * flag you have to remember to turn on is one you forget.
 *
 * `npm run build:release` turns it off, and that is the build that ships.
 * Until then the game wears a DEBUG tag in the corner of every screen, because
 * the failure this arrangement invites is shipping without noticing.
 */
export const DEV_TOOLS =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === "1";

/** a query parameter, but only where the testing surfaces exist at all */
export const devParam = (name: string) =>
  DEV_TOOLS ? new URLSearchParams(location.search).get(name) : null;

export const devFlag = (name: string) =>
  DEV_TOOLS && new URLSearchParams(location.search).has(name);
