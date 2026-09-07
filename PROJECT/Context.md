# Context — find-the-bug

## Project Overview

A QA game. The player is a tester on a twelve-day sprint: every working day a
queue of builds lands on the desk, each build is a small playable scene with one
fault planted in it, and the player has to find the fault, say what kind it is,
and sign the build off. The clock runs while the world does, so looking costs
time, and time is the thing there is not enough of.

The game is not a stage grid. It is an office, a walk to it, a street, and a
home — the builds are opened at a desk inside that day, and the day is what
constrains them.

Two currencies, neither of them money: **time** (09:00–18:00, running at 2.3
game minutes per real second) and **condition** (how many builds the player can
still open). Money exists but is thin on purpose — one run earns less than the
shop's contents cost, so equipment is a choice rather than a checklist.

Nothing about the run persists. The one thing that does is the **defect book**:
115 faults across 7 builds, of which a run meets perhaps forty. The reason to
play again is the ones not met yet.

## Tech Stack

_Exact versions are in `package.json`._

- **Framework**: React 18 (pinned — `@agent8/gameserver` peers on `^18.2.0`)
- **Build / Lang**: Vite, TypeScript, `tsx` for the script suite
- **Styling**: hand-written CSS (`App.css`, `engine/engine.css`, `index.css`). No Tailwind.
- **Multiplayer / accounts**: `@agent8/gameserver` — wired, see `src/net/`
- **Lint**: oxlint
- **Art**: CC0 sprite sheets, packed by `npm run sprites`. See `docs/ASSETS.md`.

## Critical Memory

- **Bugs are generated, not written.** `engine/generate.ts` crosses 19 mutators
  with a scene's objects; `engine/score.ts` grades each result into bands 1–4;
  `engine/curriculum.ts` deals 30 stage slots out of those bands. Nobody hand-
  authors a bug list — you author a scene, and the pool falls out of it.
  `engine/exclusions.ts` is the only place a generated bug is removed by hand.
- **Stage 4 is the documented exception.** The card-matching build has its own
  component and its own hand-written pool; it does not go through the engine.
- **`vite.config.ts` needs its `dedupe` and `optimizeDeps` blocks.** Remove them
  and the dev server throws `Invalid hook call` — the SDK and the app end up
  holding different copies of React. See `docs/DEPLOY.md`.
- **Dictionaries load one at a time.** `i18n/loadLang()` must be awaited before
  `translate()` will answer in anything but English. This bites scripts, not
  screens — `scripts/report.ts` awaits it at the top for that reason.
- **Dev tools ship on purpose while the game is unfinished.** `VITE_DEV_TOOLS=1`
  in `.env`; the build that ships is `npm run build:release`, which turns it off
  via `.env.release`. A build with them on wears a `DEBUG` tag in the corner.
