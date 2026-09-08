# Neo둥근모 Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game's text is drawn in Neo둥근모 Pro, a 38KB pixel typeface, instead of the system UI font — with nothing overflowing that did not overflow before.

**Architecture:** One `@font-face` in `src/index.css` and one name at the front of the `body` font stack; the existing stack stays behind it as the fallback for glyphs the font lacks. The font is 8.7% wider in Hangul, which pushes two chips onto a second line — one of those is a pre-existing layout fault in `.quest` that steals half the frame, fixed separately. `scripts/checkquest.ts` stops estimating widths and computes them exactly, because this typeface is built on a 16-unit grid and every advance is a whole number of sixteenths.

**Order matters.** The two font-independent fixes land first — the chip that was throwing away half its width, and the width model that was wrong in two directions at once — so that the commit which actually swaps the typeface lands on a repository that is already measuring correctly, and stays green.

**Tech Stack:** Vite (bundles the woff2 like the sprite sheets so Verse8's sub-path serving works), plain CSS, one tsx check script.

## Global Constraints

- Branch is `develop`. `main` is not used.
- The font file is already in the repository at `src/assets/fonts/neodgm_pro.woff2` — 38,144 bytes, OFL 1.1, from npm `neodgm-pro@0.1.1`. Do not re-download it and do not point at a CDN.
- The existing stack `"Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif` stays as the fallback. A missing glyph must land on a system font, never on a blank box.
- Do not touch `font-weight` rules. The typeface has one weight; the browser synthesises 700/800, it reads acceptably, and it does not change advance widths — so it cannot cause a wrap.
- Do not shorten or reword any i18n string to make it fit. Every fit problem in this plan is solved by giving the text room.
- Comments explain *why*, in prose, in English. Commit subjects are sentences, not `feat:` prefixes.
- Every task ends with a commit **and a push** to `develop`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/index.css` (modify) | the `@font-face` and the `body` stack |
| `docs/ASSETS.md` (modify) | licence and provenance |
| `src/App.css` (modify) | `.quest`'s stolen width, plus whatever task 4 finds |
| `scripts/checkquest.ts` (rewrite) | exact width model, new budget |

---

## Task 1: Give the quest chip back the half of the screen it was throwing away

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. `.quest` simply gets the width it always should have had.

This task is independent of the typeface and would be worth doing without it.

- [ ] **Step 1: Understand what is wrong before changing it**

`.quest` is `position: absolute` with `left: 50%` and `transform: translateX(-50%)`. For an absolutely positioned box with `left` set and `right: auto`, the shrink-to-fit width is capped at `containing block width − left` — so a chip centred this way can never be wider than **half the frame**. On a 380px frame that is 190px, and `max-width: calc(100% - 24px)` (356px) never gets a say.

Measured on the running game, same string, same 380px frame:

| | chip width | lines |
|---|---|---|
| current stack | 190px | 1 (text needs 166) |
| Neo둥근모 Pro | 190px | **2** (text needs 180) |

- [ ] **Step 2: Make the change**

In `src/App.css`, replace these three lines of `.quest`:

```css
  left: 50%;
  /* clear of the bar: the bar is numbers and this is the one sentence, and
     the two reading as one row was worse than either alone */
  top: 40px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
```

with:

```css
  /*
   * Centred by margins rather than by left: 50%.
   *
   * An absolutely positioned box with `left` set and `right` auto shrinks to
   * fit inside what is left of the containing block, which for left: 50% is
   * half of it — so this chip had 190 pixels of a 380 pixel frame and the
   * max-width below never applied. It fit anyway, by eleven pixels, until the
   * typeface changed and it did not.
   */
  left: 0;
  right: 0;
  margin-inline: auto;
  width: max-content;
  /* clear of the bar: the bar is numbers and this is the one sentence, and
     the two reading as one row was worse than either alone */
  top: 40px;
  max-width: calc(100% - 24px);
```

- [ ] **Step 3: See it on the running game**

```bash
npm run build
```

Then open the office with the preview tools and read the chip's box:

```js
const q = document.querySelector('.quest');
const r = q.getBoundingClientRect();
JSON.stringify({ text: q.textContent, w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
```

Expected: height about 25 (one line), not about 40 (two). Width around 203 for `A번 기기부터 — 오늘 제일 심각…`.

Also confirm it is still centred — `r.left + r.width / 2` should be within a pixel of half the frame width.

- [ ] **Step 4: Commit and push**

```bash
git add -A && git commit -m "Stop the quest chip from centring itself into half a screen" && git push origin develop
```

---

## Task 2: Measure the quest lines instead of guessing at them

**Files:**
- Rewrite: `scripts/checkquest.ts`

**Interfaces:**
- Consumes: the five i18n dictionaries.
- Produces: nothing importable; it is a check script.

- [ ] **Step 1: Understand the two errors that were cancelling out**

The old script models a Hangul or Han character as one font size wide and everything else as `0.52` of one, against a `BUDGET` of 200.

Both numbers were wrong, in opposite directions:

- `…` is not 0.52 of an em in this face, it is **0.9375**. Every quest line now ends in one.
- The budget was 200 where the real space, after Task 1, is **314**: a 360px frame, less the 24px `max-width` inset, less 22px of horizontal padding.

Neither error showed because they pointed opposite ways.

- [ ] **Step 2: Write the failing test**

Replace the whole of `scripts/checkquest.ts` with:

```ts
/**
 * Does every quest line fit on one line of the chip?
 *
 * The chip sits over the room and says the one thing to do next. Two lines of
 * it covers more of the scene than a hint should, and it is the line a player
 * reads at a glance rather than reads — so it has to be a glance.
 *
 * This used to estimate: a Hangul or Han character about one font size wide,
 * everything else about half. It does not have to. Neo둥근모 Pro is drawn on a
 * sixteen-unit grid and every advance is a whole number of sixteenths, so the
 * width of a string is exact arithmetic. The table below was read off the
 * font itself with measureText, and the check at the bottom of this file
 * pins it to what a browser actually drew.
 */
import ko from "../src/i18n/ko.json";
import en from "../src/i18n/en.json";
import ja from "../src/i18n/ja.json";
import zhHant from "../src/i18n/zh-Hant.json";
import zhHans from "../src/i18n/zh-Hans.json";

type Dict = Record<string, string>;
const dicts: [string, Dict][] = [
  ["ko", ko],
  ["en", en],
  ["ja", ja],
  ["zh-Hant", zhHant],
  ["zh-Hans", zhHans],
];

/**
 * How wide each character is, in sixteenths of the font size.
 *
 * Anything not listed is a full sixteen — which is every Hangul syllable,
 * every kana, every Han character, the em dash, and the pips and hearts the
 * bar is drawn with. Defaulting to the widest is also the safe way round for
 * a check that asks "does this fit".
 */
const UNITS: Record<string, number> = {};
const put = (u: number, chars: string) => {
  for (const ch of chars) UNITS[ch] = u;
};
put(3, "'");
put(5, " !),.:;I]`ijl|·");
put(6, '"([ft');
put(7, "+Y{}");
put(8, "0123456789#$%&-/<=>?ABCDEFGHJKLNOPQRSUVXZ\\^_abcdeghknopqrsuvxyz~");
put(9, "*MTWmw");
put(12, "@、");
put(15, "…");

const width = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + ((UNITS[ch] ?? 16) * size) / 16, 0);

/**
 * What the chip has, on the narrowest phone worth drawing for.
 *
 *   360  frame — .app-frame is min(100vw, 100dvh * 9/16)
 *   -24  .quest max-width: calc(100% - 24px)
 *   -22  .quest padding: 4px 11px, both sides
 *   ---
 *   314
 *
 * It was 200 before, which was wrong in the same breath as the width model
 * was wrong, and in the opposite direction.
 */
const BUDGET = 314;
const FONT = 12;

/** the longest thing each placeholder is ever replaced with */
const SAMPLE: Record<string, string> = { machine: "machine D", n: "12" };

let bad = 0;

/*
 * The table above, against what a browser drew.
 *
 * Every one of these was measured with canvas measureText at 12px in the real
 * font. Two of them come out a sixteenth wide because "fi" is kerned tighter
 * than the sum of its parts; over-estimating is the safe direction for this
 * check, so the tolerance is one-sided.
 */
const MEASURED: [string, number][] = [
  ["A번 기기부터 — 오늘 제일 심각…", 180],
  ["커피를 사자 — 4번째 빌드용…", 164.25],
  ["더는 못 본다 — 커피나 퇴근…", 162],
  ["잡은 12건 개발자에게…", 126.75],
  ["오늘은 쉬는 날이다…", 114.75],
  ["출근하자 — 현관으로…", 126.75],
  ["Get to work — the front door…", 165],
  ["Out of eyes — coffee, or home…", 169.5],
  ["machine D first — worst today…", 170.25],
  ["machine Dから — 今日一番重い…", 177],
  ["先看machine D — 今天最嚴重…", 165],
  ["走向大路 — 往公司…", 114.75],
];
for (const [text, real] of MEASURED) {
  const got = width(text, FONT);
  const off = got - real;
  if (off < 0 || off > 1) {
    console.log(
      `FAIL  width model is off by ${off.toFixed(2)}px on "${text}" (model ${got}, drawn ${real})`
    );
    bad++;
  }
}
if (!bad) {
  console.log(
    `PASS  the width table matches what the browser drew, on all ${MEASURED.length} samples`
  );
}

for (const [name, dict] of dicts) {
  for (const [key, value] of Object.entries(dict)) {
    if (!key.startsWith("quest.")) continue;
    const filled = value.replace(/\{(\w+)\}/g, (m, slot) => SAMPLE[slot] ?? m);
    const w = Math.round(width(filled, FONT));
    if (w > BUDGET) {
      console.log(`FAIL  ${name} ${key}: ${w}px of ${BUDGET}\n        ${filled}`);
      bad++;
    }
  }
}
if (bad) {
  console.log(`\n${bad} problem(s)`);
  process.exit(1);
}
console.log(`PASS  every quest line fits one line in all ${dicts.length} languages`);
```

- [ ] **Step 3: Run it**

```bash
npx tsx scripts/checkquest.ts
```

Expected: two PASS lines and exit 0.

- [ ] **Step 4: Prove both halves of the check bite**

Break the table — change `put(15, "…")` to `put(5, "…")` — and re-run. Expected: several `width model is off by -...` FAILs, because the model now under-estimates. Put it back.

Then break the budget — set `BUDGET = 120` — and re-run. Expected: FAIL lines naming specific quest keys. Put it back.

- [ ] **Step 5: Full check**

```bash
npm run verify && npx oxlint src server.js scripts
```

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "Compute the quest line's width rather than guessing at it" && git push origin develop
```

---

## Task 3: The typeface

**Files:**
- Modify: `src/index.css`
- Modify: `docs/ASSETS.md`

**Interfaces:**
- Produces: a font family named `NeoDunggeunmoPro`, first in the `body` stack, inherited by everything (buttons already say `font-family: inherit`).

- [ ] **Step 1: Declare the face and put it at the front of the stack**

In `src/index.css`, add above the `* { box-sizing }` rule:

```css
/*
 * The game's own letters.
 *
 * Everything on screen is drawn from 16px pixel sheets, and the text over it
 * was the system UI font — the picture was a game and the writing was a web
 * page. This is 둥근모꼴, the Korean bitmap face that DOS software used in the
 * nineties, redrawn as outlines: the same grid the sprites are on.
 *
 * Bundled rather than linked. Verse8 serves the game from a sub-path and the
 * bundler is what rewrites asset URLs for it — the same reason the sprite
 * sheets are imported in spriteStyle.ts instead of sitting in public/.
 */
@font-face {
  font-family: "NeoDunggeunmoPro";
  src: url("./assets/fonts/neodgm_pro.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  /*
   * Swap, not block. The face is 38KB and usually arrives before the first
   * frame, but a slow phone should show the game in the fallback rather than
   * show nothing — and because the fallback is what every layout here was
   * measured against, the swap can only ever make lines shorter.
   */
  font-display: swap;
}
```

Then change the `font-family` line inside `body`:

```css
  /* the fallback is not decoration: this face has no simplified-Chinese hanja
     to speak of, and a glyph it lacks has to land on a system font rather
     than on an empty box */
  font-family: "NeoDunggeunmoPro", "Segoe UI", "Apple SD Gothic Neo",
    "Noto Sans KR", sans-serif;
```

- [ ] **Step 2: Check it actually loads and is used**

```bash
npm run build
```

Expected: the build emits a hashed copy of the font, e.g. `dist/assets/neodgm_pro-XXXXXXXX.woff2`. Confirm with:

```bash
ls dist/assets/ | grep woff2
```

If nothing appears, the `url()` path is wrong — it is relative to `src/index.css`, so it must be `./assets/fonts/neodgm_pro.woff2`.

- [ ] **Step 3: Record the licence**

`docs/ASSETS.md` opens with "모든 에셋 **CC0**", which is already untrue — Messy Furniture is not CC0. Fix that sentence and add the font. Replace the second line of the file:

```
모든 에셋 **CC0 (Creative Commons Zero)** — 저작자 표시 의무 없음, 상업적 이용·수정·재배포 자유.
법적으로 크레딧이 필요하진 않지만 관례상 아래에 출처를 남긴다.
```

with:

```
그림 에셋은 대부분 **CC0 (Creative Commons Zero)** — 저작자 표시 의무 없음, 상업적
이용·수정·재배포 자유. 예외는 두 개이고 각각 아래에 따로 적었다: Messy Furniture(무료,
재배포 금지)와 Neo둥근모 Pro(OFL 1.1).

법적으로 크레딧이 필요하진 않은 것들도 관례상 아래에 출처를 남긴다.
```

and append this section to the end of the file:

```markdown
## Neo둥근모 Pro (OFL 1.1)

https://github.com/neodgm/neodgm-pro

`src/assets/fonts/neodgm_pro.woff2` — 38,144 바이트. npm `neodgm-pro@0.1.1`에서
받았고 내용은 건드리지 않았다.

1990년대 DOS 비트맵 서체 '둥근모꼴'을 아웃라인으로 옮긴 것의 **가변폭** 판. 같은
프로젝트의 고정폭 판(Neo둥근모, 44KB)은 긴 한글 문장이 늘어져서 쓰지 않는다.

한글 11,172자 전부와 가나·한자·라틴을 담고 있다. 없는 글자는 `index.css`의 스택
뒷부분(시스템 폰트)으로 떨어진다.

라이선스는 SIL Open Font License 1.1이다. CC0와 달리 **의무가 있다**: 이 폰트를
번들에 담아 배포하므로 라이선스 전문을 함께 배포해야 하고, 파일 이름을 그대로 쓰는
한 예약 서체 이름 조항에도 걸리지 않는다. 전문은
[src/assets/fonts/OFL.txt](../src/assets/fonts/OFL.txt)에 있다.

폰트를 고르며 잰 값과 후보 비교는
[스펙 문서](superpowers/specs/2026-09-08-neodgm-pro-design.md)에 있다.
```

- [ ] **Step 4: Ship the licence text with the font**

OFL 1.1 requires the licence to travel with the font. Fetch it beside the file:

```bash
curl -sL -o src/assets/fonts/OFL.txt https://raw.githubusercontent.com/neodgm/neodgm-pro/main/LICENSE.txt
head -3 src/assets/fonts/OFL.txt
```

Expected: the first lines name the copyright holder and "SIL OPEN FONT LICENSE Version 1.1". If the path 404s, find the licence file's real name with `gh api repos/neodgm/neodgm-pro/contents --jq '.[].name'` and fetch that one instead.

- [ ] **Step 5: Full check**

```bash
npm run verify && npx oxlint src server.js scripts && npm run build
```

This has to be green. Tasks 1 and 2 went first for exactly this reason — the chip's width and the width model are both already correct by the time the typeface arrives, so nothing here should be the first thing to go red.

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "Draw the game's words on the same grid as its pictures" && git push origin develop
```

---

## Task 4: Walk every screen and give back the room the wider letters took

**Files:**
- Modify: `src/App.css` and `src/styles/shared.css` as the walk requires

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: nothing.

There is no list of what overflows, because there cannot be one — it is only knowable by rendering. What follows is the route, the one known case, and the rule for fixing what turns up.

- [ ] **Step 1: Start the game**

`.claude/launch.json` already points `find-bug-dev` at port 5177. Start it with the preview tools and open the office at a fixed clock so screens are comparable:

```
http://localhost:5177/?place=office&day=2&at=1400
```

Use a 380x690 viewport, which is a phone.

- [ ] **Step 2: The route**

Visit each and screenshot it. The dev query string reaches most of them; the rest need a few clicks.

| screen | how |
|---|---|
| office floor | `?place=office&day=2&at=1400` |
| street | `?place=street&day=2&at=1000` |
| lane | `?place=lane&day=2&at=1000` |
| home, morning | `?place=home&day=2&at=800` |
| home, evening | `?place=home&day=2&at=2000` |
| a build under test | office, walk to machine A, open it |
| the report flow | in a build, press 결함 보고, pick an object, pick a category |
| result modal | finish that report |
| six o'clock offer | `?place=office&day=2&at=1755` and wait |
| coffee offer | street, walk to the vending machine, press 커피 사기 |
| codex | home, open the journal on the desk |
| settings + shop | the gear in the corner |
| ship screen | `?day=12`, sleep |
| loading screen | reload and screenshot within the first second |

- [ ] **Step 3: The known one — the day chip**

The header row `.wb-header` is a flex line holding the day and deadline, the clock, the condition pips, the hearts, the money and four machine chips. With the wider face `2일차 · D-10` wraps inside its own box and the row grows to two lines.

Look at it first, and fix it by finding room rather than by shortening the label — `.wb-header` has `gap: 8px` and the chips have padding, and `font-variant-numeric: tabular-nums` is already on the clock. Whatever the fix is, the label text does not change.

- [ ] **Step 4: The rule for anything else the walk turns up**

For each overflow, in this order:

1. Is something stealing width the way `.quest` was? Fix that.
2. Is there padding or a gap that can give a few pixels back? Take them.
3. Only then, consider `white-space: nowrap` plus letting a flex sibling shrink.

Never change an i18n string. The words were chosen for the game, not for the font.

- [ ] **Step 5: Check all five languages on whatever you changed**

Language is switched from the gear in the corner. For each screen you had to fix, look at it in Korean, English, Japanese and both Chinese. Japanese and Chinese are full-width in this face exactly as Korean is, so a Korean fix usually covers them — but English is much narrower and can leave a fix looking lopsided.

- [ ] **Step 6: Full check and a last look**

```bash
npm run verify && npx oxlint src server.js scripts && npm run build
```

Then reload the game once more and read the console:

```js
JSON.stringify({ used: getComputedStyle(document.body).fontFamily.split(',')[0],
                 loaded: document.fonts.check('12px NeoDunggeunmoPro') })
```

Expected: `NeoDunggeunmoPro` and `true`.

- [ ] **Step 7: Stop the dev server, commit and push**

```bash
git add -A && git commit -m "Give the wider letters the room they need" && git push origin develop
```

---

## What the user checks after deploying

The font is bundled, so it works the same locally and on Verse8 — but the phone is where the sizes actually matter.

1. The HUD row across the top is one line, not two, on your phone.
2. The quest chip under it is one line.
3. Switch to English, Japanese and Chinese in the settings and look at the same two.
4. The six o'clock prompt and the report result modal both read cleanly.
5. Nothing anywhere is a row of empty boxes — that would mean the fallback stack was dropped.
