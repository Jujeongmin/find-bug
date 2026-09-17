# 수첩 완성과 숙련 빌드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결함을 전부 잡은 빌드를 "숙련"으로 만들어 검사할 때 기운이 들지 않게 한다. 결함은 아직 못 잡은 것부터 배정한다.

**Architecture:** 숙련은 저장하지 않는다. 수첩 행(`codexRows`)에서 매번 계산하고, 계산은 `src/office/mastery.ts`에 모은다. 결함을 고르는 함수 두 개(`pickMutation`, `pickBug`)는 선택 인자 `prefer`를 받고, 오피스만 이 값을 넘긴다. 출시 화면의 "새로 숙련"을 계산하려고 회차 세이브에 `masteredAtStart` 필드 하나를 추가한다.

**Tech Stack:** React 18, TypeScript, Vite. 테스트 프레임워크는 없다. `scripts/*.ts`를 tsx로 돌리고, 실패하면 `process.exitCode = 1`로 알린다.

## Global Constraints

- 브랜치는 `develop`만 쓴다. 커밋마다 바로 푸시한다(`git push origin develop`).
- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 보상에 확률형 요소(뽑기, 강화, 합성)를 넣지 않는다.
- 타입 검사는 `npx tsc -b`로 한다(`--noEmit`은 아무것도 검사하지 않는다).
- 셸 heredoc은 `\\`를 망가뜨린다. 백슬래시가 들어간 편집은 Edit 도구나 스크래치패드 node 스크립트로 한다.
- i18n 키는 ko, en, ja, zh-Hans, zh-Hant 5개 파일에 모두 넣는다(`scripts/checki18n.ts`가 검사한다).
- 전체 검사: `npm run verify`

---

### Task 1: 숙련 계산과 우선 배정 함수

**Files:**
- Create: `src/office/mastery.ts`
- Modify: `src/engine/generate.ts` (`pickMutation`)
- Modify: `src/core/judge.ts` (`pickBug`)
- Create: `scripts/checkmastery.ts`
- Modify: `package.json` (`verify` 끝에 `&& tsx scripts/checkmastery.ts`)

**Interfaces:**
- Produces:
  - `buildProgress(rows: readonly CodexRow[]): Map<string, { caught: number; total: number }>`
  - `masteredBuilds(rows: readonly CodexRow[]): string[]`
  - `preferFor(rows: readonly CodexRow[], sceneId: string): string[]`
  - `pickMutation(mutations: Mutation[], excludeId?: string, prefer?: readonly string[]): Mutation`
  - `pickBug(pool: BugDef[], excludeId?: string, prefer?: readonly string[]): BugDef`

- [ ] **Step 1: 실패하는 검사 작성** — `scripts/checkmastery.ts`

```ts
/**
 * Mastery: a build whose every fault is caught costs nothing to inspect, and
 * the faults a player has not caught are dealt first.
 *
 * Run: npx tsx scripts/checkmastery.ts
 */
import { readFileSync } from "node:fs";
import { codexRows, type Book } from "../src/office/codex";
import { buildProgress, masteredBuilds, preferFor } from "../src/office/mastery";
import { pickMutation, generateMutations } from "../src/engine/generate";
import { poolFor } from "../src/engine/curriculum";
import { pickBug } from "../src/core/judge";
import { ENGINE_SCENES } from "../src/stages/registry";
import { stage04 } from "../src/stages/stage04/bugs";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

const all = codexRows({}, 99);
const bookWith = (sceneId: string, state: "caught" | "missed", except?: string): Book => {
  const book: Book = {};
  for (const r of all) {
    if (r.sceneId !== sceneId) continue;
    book[`${r.sceneId}/${r.bugId}`] = r.bugId === except ? "missed" : state;
  }
  return book;
};

console.log("\na build is mastered when every one of its faults is caught");
{
  is(masteredBuilds(codexRows({}, 99)).length === 0, "an empty book masters nothing");
  const rows = codexRows(bookWith("stage03", "caught"), 99);
  const m = masteredBuilds(rows);
  is(m.length === 1 && m[0] === "stage03", `catching all of stage03 masters stage03 alone (${m.join(",")})`);
  const first = all.find((r) => r.sceneId === "stage03")!.bugId;
  const oneMissed = codexRows(bookWith("stage03", "caught", first), 99);
  is(masteredBuilds(oneMissed).length === 0, "one missed fault keeps it from mastery");
  const p = buildProgress(oneMissed).get("stage03")!;
  is(p.total === p.caught + 1, `progress counts it (${p.caught}/${p.total})`);
  const y1 = buildProgress(codexRows({}, 1));
  is(!y1.has("stage08") && !y1.has("stage09"), "year one's progress has no mine or kitchen");
  is(buildProgress(codexRows({}, 99)).size === 9, "every build has progress by year 99");
}

console.log("\nthe faults preferred are the ones not caught");
{
  const first = all.find((r) => r.sceneId === "stage03")!.bugId;
  const book: Book = { [`stage03/${first}`]: "caught" };
  const pref = preferFor(codexRows(book, 99), "stage03");
  const total = all.filter((r) => r.sceneId === "stage03").length;
  is(pref.length === total - 1 && !pref.includes(first), "a caught fault is not preferred");
  const missedBook: Book = { [`stage03/${first}`]: "missed" };
  is(preferFor(codexRows(missedBook, 99), "stage03").includes(first), "a missed one still is");
  is(preferFor(codexRows(bookWith("stage03", "caught"), 99), "stage03").length === 0,
     "a mastered build prefers nothing");
}

console.log("\npicking follows the preference, and falls back to everything");
{
  const scene = ENGINE_SCENES.find((s) => s.id === "stage03")!;
  const muts = generateMutations(scene);
  const want = [muts[2].bug.id, muts[5].bug.id];
  const got = new Set<string>();
  for (let i = 0; i < 200; i++) got.add(pickMutation(muts, undefined, want).bug.id);
  is([...got].every((id) => want.includes(id)) && got.size === 2, `only preferred ones come (${[...got].join(",")})`);

  const noPref = new Set<string>();
  for (let i = 0; i < 400; i++) noPref.add(pickMutation(muts, undefined, []).bug.id);
  is(noPref.size > 2, "an empty preference picks from everything");
  const stale = new Set<string>();
  for (let i = 0; i < 400; i++) stale.add(pickMutation(muts, undefined, ["nope"]).bug.id);
  is(stale.size > 2, "a preference matching nothing picks from everything");

  const re = new Set<string>();
  for (let i = 0; i < 200; i++) re.add(pickMutation(muts, want[0], want).bug.id);
  is(re.size === 1 && re.has(want[1]), "a re-roll keeps the preference and leaves out the last one");

  const pool = stage04.bugPool;
  const wantCard = [pool[1].id];
  const cards = new Set<string>();
  for (let i = 0; i < 100; i++) cards.add(pickBug(pool, undefined, wantCard).id);
  is(cards.size === 1 && cards.has(pool[1].id), "the card build follows it too");
  const anyCard = new Set<string>();
  for (let i = 0; i < 300; i++) anyCard.add(pickBug(pool, undefined, []).id);
  is(anyCard.size > 1, "and falls back the same way");
}

console.log("\nevery fault in the book can be dealt, so every build can be mastered");
{
  for (const scene of ENGINE_SCENES) {
    const banded = poolFor(scene, 1, 4);
    const dealt = (banded.length >= 1 ? banded : generateMutations(scene)).map((m) => m.bug.id).sort();
    const book = all.filter((r) => r.sceneId === scene.id).map((r) => r.bugId).sort();
    is(JSON.stringify(dealt) === JSON.stringify(book),
       `${scene.id}: the office deals exactly the book's ${book.length} faults`);
  }
  const cards = stage04.bugPool.map((b) => b.id).sort();
  const cardBook = all.filter((r) => r.sceneId === "stage04").map((r) => r.bugId).sort();
  is(JSON.stringify(cards) === JSON.stringify(cardBook), "stage04: the card pool is the book's");
}

console.log(bad ? `\n${bad} FAIL` : "\nmastery holds");
process.exitCode = bad ? 1 : 0;
```

`readFileSync`는 Task 2에서 소스 검사를 넣을 때 쓴다. 이 단계에서 lint 경고가 나면 import를 Task 2로 옮긴다.

- [ ] **Step 2: 실패 확인**

Run: `npx tsx scripts/checkmastery.ts`
Expected: `../src/office/mastery`를 찾을 수 없다는 오류로 실패

- [ ] **Step 3: `src/office/mastery.ts` 작성**

```ts
import type { CodexRow } from "./codex";

/**
 * Mastery: a build whose every fault is in the book as caught.
 *
 * Nothing here is stored. The book already is, on the device and on the
 * account, and a wipe that empties it takes mastery with it — a second copy
 * would only be something that could disagree. The rows carry the year's
 * gating, so a build that has not arrived yet is not in any of these.
 */

export interface Progress {
  caught: number;
  total: number;
}

export function buildProgress(rows: readonly CodexRow[]): Map<string, Progress> {
  const out = new Map<string, Progress>();
  for (const r of rows) {
    const p = out.get(r.sceneId) ?? { caught: 0, total: 0 };
    p.total++;
    if (r.state === "caught") p.caught++;
    out.set(r.sceneId, p);
  }
  return out;
}

export function masteredBuilds(rows: readonly CodexRow[]): string[] {
  return [...buildProgress(rows)]
    .filter(([, p]) => p.total > 0 && p.caught === p.total)
    .map(([id]) => id);
}

/**
 * The faults of one build that the book does not have as caught. Dealt first,
 * so each run moves the book on instead of dealing the ones it already has;
 * a mastered build has none, and is dealt from everything again.
 */
export function preferFor(rows: readonly CodexRow[], sceneId: string): string[] {
  return rows
    .filter((r) => r.sceneId === sceneId && r.state !== "caught")
    .map((r) => r.bugId);
}
```

- [ ] **Step 4: `pickMutation` 교체** — `src/engine/generate.ts`

```ts
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
```

- [ ] **Step 5: `pickBug` 교체** — `src/core/judge.ts`

```ts
/**
 * Pick a random bug from the pool, excluding the previously used one, and
 * from the preferred ones when any of them are left.
 */
export function pickBug(
  pool: BugDef[],
  excludeId?: string,
  prefer?: readonly string[]
): BugDef {
  const candidates =
    pool.length > 1 && excludeId
      ? pool.filter((b) => b.id !== excludeId)
      : pool;
  const wanted = prefer?.length
    ? candidates.filter((b) => prefer.includes(b.id))
    : [];
  const from = wanted.length ? wanted : candidates;
  return from[Math.floor(Math.random() * from.length)];
}
```

- [ ] **Step 6: verify에 추가하고 통과 확인**

`package.json`의 `verify` 끝 `&& tsx scripts/checkyears.ts` 뒤에 ` && tsx scripts/checkmastery.ts`를 붙인다.

Run: `npx tsx scripts/checkmastery.ts && npx tsc -b`
Expected: 모든 줄 PASS, 마지막 줄 `mastery holds`. tsc 오류 없음.

- [ ] **Step 7: 커밋, 푸시**

```bash
git add src/office/mastery.ts src/engine/generate.ts src/core/judge.ts scripts/checkmastery.ts package.json
git commit -m "Work out mastery from the book and deal uncaught faults first"
git push origin develop
```

---

### Task 2: 오피스에 연결 (우선 배정, 공짜 검사)

**Files:**
- Modify: `src/engine/EngineStage.tsx` (Props, 첫 선택, `nextRound`)
- Modify: `src/stages/stage04/Stage04.tsx` (Props, 첫 선택, `onRetry`, 다시 뽑기)
- Modify: `src/office/Office.tsx`
- Modify: `scripts/checkmastery.ts` (소스 검사 추가)

**Interfaces:**
- Consumes: `masteredBuilds`, `preferFor`(Task 1), `codexRows(book?, year)`
- Produces: Office 안의 `bookRows`(useMemo), `mastered: string[]`, `runningFree` 상태. Task 3에서 사용한다.

- [ ] **Step 1: 실패하는 소스 검사 추가** — `scripts/checkmastery.ts`의 마지막 `console.log(bad ? ...` 바로 앞

```ts
console.log("\nthe office wires it through");
{
  const office = readFileSync("src/office/Office.tsx", "utf8");
  is(/if \(!free && condition < INSPECT_COST\)/.test(office), "a mastered build opens with no condition left");
  is(/if \(!runningFree\) setCondition\(\(c\) => Math\.max\(0, c - INSPECT_COST\)\)/.test(office),
     "and costs none to inspect");
  is((office.match(/prefer=\{prefer\}/g) ?? []).length === 2, "both build components are handed the preference");
  const engine = readFileSync("src/engine/EngineStage.tsx", "utf8");
  is((engine.match(/pickMutation\([^)]*prefer\)/g) ?? []).length === 2, "EngineStage picks with it, first and on a re-roll");
  const cards = readFileSync("src/stages/stage04/Stage04.tsx", "utf8");
  is((cards.match(/pickBug\([^)]*prefer\)/g) ?? []).length === 3, "Stage04 picks with it everywhere it picks");
}
```

Run: `npx tsx scripts/checkmastery.ts` → 새 5줄이 FAIL

- [ ] **Step 2: EngineStage**

Props 인터페이스의 `bugId?: string | null;` 아래에 추가:

```ts
  /** fault ids to deal first, when any of them are in the pool */
  prefer?: readonly string[];
```

구조 분해의 `onBugPicked,` 아래에 `prefer,`를 추가한다. 이어서 다음 두 줄을 교체한다.

```ts
    return mutations.find((m) => m.bug.id === bugId) ?? pickMutation(mutations, undefined, prefer);
```

```ts
    const next = pickMutation(mutations, mutation.bug.id, prefer);
```

- [ ] **Step 3: Stage04**

Props의 `bugId?: string | null;` 아래에 같은 `prefer?: readonly string[];`(같은 주석)을 넣고, 구조 분해의 `bugId,` 아래에 `prefer,`를 넣는다. `pickBug` 호출 세 곳을 바꾼다.

```ts
    () => stage04.bugPool.find((b) => b.id === bugId) ?? pickBug(stage04.bugPool, undefined, prefer)
```

`onRetry`와 `onReroll` 안의 두 곳:

```ts
    setBug(pickBug(stage04.bugPool, bug.id, prefer));
```

- [ ] **Step 4: Office — import와 상태**

import 줄을 바꾼다.

```ts
import { masteredBuilds, preferFor } from "./mastery";
```

`const [codexAtStart] = useState(...)` 블록 바로 아래에 추가한다.

```ts
  /*
   * The book as rows, worked out once rather than on every tick of the clock:
   * a hundred and fifty faults are generated to build it. It moves when a
   * build closes (running), when a day turns, and when the account's copy may
   * have come down (connected).
   */
  const bookRows = useMemo(
    () => codexRows(undefined, yearAtStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yearAtStart, running, day, connected]
  );
  const mastered = useMemo(() => masteredBuilds(bookRows), [bookRows]);
  /** the build on screen was mastered when it was opened, so it costs nothing */
  const [runningFree, setRunningFree] = useState(false);
```

`running`, `day`, `connected`가 이 위치보다 위에 선언돼 있는지 확인한다. `running`(511행 부근)과 `day`(489행)는 위에 있다. `connected`가 아래에 있으면 이 블록을 `connected` 선언 아래로 옮긴다. `useMemo`가 react import에 없으면 추가한다.

- [ ] **Step 5: Office — 열기와 차감**

`onStation`의 다음 코드를

```ts
    if (condition < INSPECT_COST) return setNote(t("office.tooTired"));
    setRunning(a);
```

아래처럼 바꾼다.

```ts
    const free = mastered.includes(a.sceneId);
    if (!free && condition < INSPECT_COST) return setNote(t("office.tooTired"));
    setRunningFree(free);
    setRunning(a);
```

`finish` 안의 `setCondition((c) => Math.max(0, c - INSPECT_COST));`를 아래로 바꾼다.

```ts
    if (!runningFree) setCondition((c) => Math.max(0, c - INSPECT_COST));
```

- [ ] **Step 6: Office — prefer 넘기기**

`if (running) {` 블록의 `const build = {` 위에 추가한다.

```ts
    const prefer = preferFor(bookRows, running.sceneId);
```

`<Stage04`와 `<EngineStage`의 `bugId={build.bugId}` 아래에 각각 `prefer={prefer}`를 넣는다.

- [ ] **Step 7: 통과 확인**

Run: `npx tsc -b && npx tsx scripts/checkmastery.ts && npx oxlint`
Expected: 오류 없음, 전부 PASS

- [ ] **Step 8: 커밋, 푸시**

```bash
git add src/engine/EngineStage.tsx src/stages/stage04/Stage04.tsx src/office/Office.tsx scripts/checkmastery.ts
git commit -m "Deal uncaught faults first and let mastered builds cost nothing"
git push origin develop
```

---

### Task 3: 회차 필드와 화면

**Files:**
- Modify: `src/office/run.ts` (`RunFields`, `parseRun`)
- Modify: `server.js` (`RUN_FIELDS`, `runField`)
- Modify: `scripts/checkrun.ts` (`FULL`)
- Modify: `src/office/Office.tsx` (상태, wire, HUD 칩, 수첩, 아침 문구, 출시 화면)
- Modify: `src/App.css`
- Modify: `src/i18n/{ko,en,ja,zh-Hans,zh-Hant}.json`

**Interfaces:**
- Consumes: `bookRows`, `mastered`(Task 2), `buildProgress`, `masteredBuilds`(Task 1), `buildIdsFor(year)`(`src/office/schedule.ts`)
- Produces: `RunFields.masteredAtStart: string[]`

- [ ] **Step 1: 실패하는 검사** — `scripts/checkrun.ts`의 `FULL`에서 `gift: "alarm",` 아래에 추가

```ts
  masteredAtStart: ["stage03", "stage04"],
```

Run: `npx tsx scripts/checkrun.ts` → FAIL. TS 오류가 나거나, "every field comes back unchanged — lost masteredAtStart"가 뜬다.

- [ ] **Step 2: run.ts**

`RunFields`의 `gift` 아래에 추가한다.

```ts
  /** the builds already mastered when this run began, for "newly mastered" */
  masteredAtStart: string[];
```

`parseRun`의 `put(out, "gift", ...)` 아래에 추가한다.

```ts
  put(out, "masteredAtStart", listOf(r.masteredAtStart, sceneId));
```

`listOf` 정의 아래에 추가한다.

```ts
const SCENE_ID = /^stage\d{2}$/;
const sceneId = (x: unknown): string | undefined =>
  typeof x === "string" && SCENE_ID.test(x) ? x : undefined;
```

- [ ] **Step 3: server.js**

`RUN_FIELDS`의 `gift: [...]` 아래에 `masteredAtStart: ["scenes"],`를 넣는다. `runField`의 `case "runid":` 위에 추가한다.

```js
    case "scenes":
      return runList(v, (x) =>
        typeof x === "string" && /^stage\d{2}$/.test(x) ? x : undefined
      );
```

- [ ] **Step 4: Office — 상태와 wire**

`bookRows`/`mastered` 블록 아래에 추가한다.

```ts
  const [masteredAtStart] = useState<string[]>(
    () => boot?.masteredAtStart ?? masteredBuilds(codexRows(undefined, yearAtStart))
  );
```

wire 객체의 `gift,` 아래에 `masteredAtStart,`를 넣는다. `satisfies RunFields`가 빠진 필드를 잡아낸다.

Run: `npx tsc -b && npx tsx scripts/checkrun.ts` → PASS

- [ ] **Step 5: i18n** — 5개 파일 모두, `ship.bestNew` 줄 아래에 추가

| 키 | ko | en | ja | zh-Hans | zh-Hant |
|---|---|---|---|---|---|
| `mastery.stamp` | 숙련 | Mastered | 熟練 | 熟练 | 熟練 |
| `mastery.chip` | 숙련 빌드 — 검사해도 기운이 들지 않는다. | Mastered build — inspecting it costs no condition. | 熟練ビルド — 検査しても体力を使わない。 | 熟练版本 — 检查不消耗体力。 | 熟練版本 — 檢查不消耗體力。 |
| `mastery.tally` | 숙련 빌드 {k}/{m} | Mastered builds {k}/{m} | 熟練ビルド {k}/{m} | 熟练版本 {k}/{m} | 熟練版本 {k}/{m} |
| `mastery.morning` | 숙련 빌드 {k}/{m}. | Mastered builds: {k}/{m}. | 熟練ビルド {k}/{m}。 | 熟练版本 {k}/{m}。 | 熟練版本 {k}/{m}。 |
| `mastery.fresh` | 새로 숙련: {names} | Newly mastered: {names} | 新たに熟練：{names} | 新熟练：{names} | 新熟練：{names} |
| `mastery.all` | 모든 빌드를 숙련했다. 이 회사에서 모르는 결함은 없다. | Every build mastered. There is no fault here you have not caught. | 全ビルド熟練。この会社に知らない不具合はない。 | 所有版本均已熟练。这里没有你没抓过的缺陷。 | 所有版本皆已熟練。這裡沒有你沒抓過的缺陷。 |

- [ ] **Step 6: Office — HUD 칩**

칩의 `className`을 바꾼다.

```tsx
                  className={`q-${a.severity} ${a.result ? "done" : ""} ${mastered.includes(a.sceneId) ? "mastered" : ""} hud-ask`}
```

`onClick`의 `setNote(tp(...))`를 아래처럼 감싼다.

```tsx
                  onClick={() =>
                    setNote(
                      tp(a.result ? "office.whatChipDone" : "office.whatChip", {
                        machine: t(`object.${a.machine}`),
                        sev: t(`office.sev.${a.severity}`),
                      }) + (mastered.includes(a.sceneId) ? `\n${t("mastery.chip")}` : "")
                    )
                  }
```

- [ ] **Step 7: Office — 수첩**

수첩 모달에서 `const tally = codexTally(rows);` 아래에 추가한다.

```tsx
              const done = masteredBuilds(rows);
              const buildCount = buildProgress(rows).size;
```

`codex-tally` `<p>`를 닫은 바로 뒤에 추가한다.

```tsx
                  <p className="codex-tally">
                    {tp("mastery.tally", { k: String(done.length), m: String(buildCount) })}
                  </p>
```

`<h3>` 안의 `</b>` 뒤에 추가한다.

```tsx
                          {done.includes(sceneId) && (
                            <em className="codex-mastered">{t("mastery.stamp")}</em>
                          )}
```

import에 `buildProgress`를 더한다: `import { buildProgress, masteredBuilds, preferFor } from "./mastery";`

- [ ] **Step 8: Office — 아침 문구**

`yearMorning`의 `return lines.join("\n");` 위에 추가한다.

```ts
    if (yearAtStart >= 4) {
      lines.push(
        tp("mastery.morning", {
          k: String(mastered.length),
          m: String(buildIdsFor(yearAtStart).length),
        })
      );
    }
```

`buildIdsFor`가 Office에 이미 import돼 있는지 확인하고, 없으면 `./schedule` import에 추가한다.

- [ ] **Step 9: Office — 출시 화면**

`codex.shipLine` 블록(수첩 줄) 바로 뒤에 추가한다.

```tsx
        {(() => {
          /*
           * What this run added to the builds that cost nothing. Read from the
           * book as it stands against the list taken when the run began.
           */
          const rows = codexRows(undefined, yearAtStart);
          const now = masteredBuilds(rows);
          const fresh = now.filter((id) => !masteredAtStart.includes(id));
          const every =
            now.length === buildIdsFor(Number.MAX_SAFE_INTEGER).length;
          if (!fresh.length && !every) return null;
          return (
            <p className="wb-tally wb-mastery">
              {fresh.length > 0 &&
                tp("mastery.fresh", {
                  names: fresh.map((id) => t(`stage.${id}.name`)).join(", "),
                })}
              {fresh.length > 0 && every && <br />}
              {every && t("mastery.all")}
            </p>
          );
        })()}
```

`buildIdsFor(Number.MAX_SAFE_INTEGER)`가 9개 빌드를 모두 돌려주는지 확인한다(`src/office/schedule.ts`). 연차에 상한이 있으면 `buildIdsFor(99)`를 쓴다.

- [ ] **Step 10: CSS** — `src/App.css`

`.office-queue b.done` 줄 아래에 추가한다.

```css
/* a mastered build: a gold ring and a star, and the note says it is free */
.office-queue b.mastered { box-shadow: 0 0 0 2px #f2c14e; position: relative; }
.office-queue b.mastered::after {
  content: "★"; position: absolute; top: -7px; right: -5px;
  font-size: 9px; color: #f2c14e; text-shadow: 0 0 2px #000;
}
```

`.codex-tally` 줄 아래에 추가한다.

```css
.codex-mastered {
  font-style: normal; font-size: 10px; font-weight: 700; margin-left: 6px;
  color: #14141f; background: #f2c14e; border-radius: 4px; padding: 0 5px;
}
.wb-mastery { color: #f2c14e; }
```

- [ ] **Step 11: 전체 검사**

Run: `npm run verify && npx oxlint`
Expected: exit 0, FAIL 없음

- [ ] **Step 12: 커밋, 푸시**

```bash
git add src/office/run.ts server.js scripts/checkrun.ts src/office/Office.tsx src/App.css src/i18n
git commit -m "Show mastered builds on the chips, the book, the morning and the ship screen"
git push origin develop
```

---

### Task 4: 브라우저 확인

- [ ] **Step 1:** `preview_start {name: "find-bug-dev"}`
- [ ] **Step 2:** 콘솔에서 수첩에 stage01 결함을 모두 `caught`로 넣는다. 결함 id는 `?debug` 목록이나 checkmastery 출력에서 얻는다. `fb_codex_v1`을 쓰고 같은 틱에 `location.reload()`를 부른다(자동저장에 덮이지 않도록).
- [ ] **Step 3:** 출근한다. stage01이 배정된 칩에 금테와 ★가 보이는지, 칩을 누르면 "숙련 빌드" 문구가 나오는지 확인한다.
- [ ] **Step 4:** 기운 0으로 세이브를 만들고(`fb_run`의 `condition: 0`) stage01 기기를 연다. 열리는지, 결과를 낸 뒤 기운이 0에서 그대로인지 확인한다. 숙련이 아닌 기기는 "너무 피곤" 문구가 나오는지 확인한다.
- [ ] **Step 5:** 수첩을 열어 "숙련 빌드 1/7"과 stage01 도장을 확인한다.
- [ ] **Step 6:** 테스트로 넣은 localStorage를 지우고 서버를 멈춘다. 문제가 있으면 고쳐서 커밋하고 푸시한다.
