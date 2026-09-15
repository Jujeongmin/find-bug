# 연차 뼈대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 끝낸 회차가 연차로 쌓이고, 연차가 빌드 목록·수첩 분모·시작 선물·아침 문구·출시 화면을 바꾸게 한다. 새 씬은 이 계획에 없다 — `SCENE_YEAR`는 비어 있는 채로 끝난다.

**Architecture:** 연차는 끝낸 회차 id의 집합이다. 로컬(`fb_years_v1`)과 계정(`state.finished`)이 합집합으로 합쳐진다. 회차는 시작할 때 `runId`·`yearAtStart`를 스냅샷에 고정하고, 빌드 배정·수첩·선물은 전부 `yearAtStart`를 읽는다. 배정 로직은 테스트할 수 있게 `Office.tsx`에서 순수 모듈 `src/office/schedule.ts`로 옮긴다.

**Tech Stack:** React 18, TypeScript, Vite, Verse8/Agent8 game server (`server.js`), tsx 검사 스크립트 (테스트 프레임워크 없음)

**Spec:** `docs/superpowers/specs/2026-09-15-years-and-new-builds-design.md` 섹션 1~3

## Global Constraints

- 브랜치는 `develop`만 쓴다. `main`은 쓰지 않는다
- 모든 태스크는 커밋 **그리고** `git push origin develop`으로 끝난다
- 타입 검사는 `npx tsc -b`다. `npx tsc --noEmit`은 이 저장소에서 아무것도 검사하지 않는다 (루트 tsconfig가 `files: []` + references)
- 테스트 프레임워크가 없다. 검사는 `scripts/*.ts`를 `npx tsx`로 돌리고, 실패하면 `process.exitCode = 1`
- `server.js`는 `class Server`를 정의만 하고 export하지 않는다. 플랫폼이 이름으로 찾는다. 스크립트는 `new Function`으로 불러온다
- i18n은 `en.json`이 기준이다. en에 없는 키가 다른 언어에 있거나 `{자리}`가 어긋나면 `checki18n`이 실패한다. 새 키는 다섯 언어(en, ko, ja, zh-Hans, zh-Hant) 전부에 넣는다
- `RUN_VERSION`은 1 그대로다. 새 필드는 전부 선택 필드라 옛 스냅샷도 읽힌다
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 선물 후보는 정확히 `["magnifier", "chair", "alarm", "shoes", "thermos"]` — `retest` 제외
- 연차 = `min(집합 크기, 98) + 1`, id 목록 상한 99
- 1년차 빌드 목록은 정확히 `["stage01", "stage02", "stage03", "stage05", "stage06", "stage07", "stage04"]`
- 이관은 계정에 `finished` 필드가 처음 생길 때 한 번만, `legacy = max(0, min(runs, 99) − 들어온 id 수)`
- 출시 화면은 `reportRun`이 끝난 뒤 `syncYears`를 부른다

---

## File Structure

| 파일 | 할 일 | 책임 |
|---|---|---|
| `src/office/schedule.ts` | 새로 | 빌드 목록과 하루 배정. `YEAR_ONE_BUILDS`, `LATER_BUILDS`, `buildIdsFor`, `assignDay`, `isFreeze`, `FREEZE_FROM` |
| `src/office/years.ts` | 새로 | 로컬 연차 기록. id 형식, 생성, 읽기·더하기·합치기·지우기, `yearOf` |
| `src/stages/registry.ts` | 수정 | `SCENE_YEAR` 표 (비어 있음) |
| `src/office/run.ts` | 수정 | `RunFields`에 `runId`·`yearAtStart`·`gift`, `GIFTS`·`GiftId` |
| `server.js` | 수정 | `RUN_FIELDS` 세 필드, `runid` 규칙, `syncYears`, `resetSave`가 `finished` 비움 |
| `src/net/save.ts` | 수정 | `syncYears(server)` |
| `src/office/codex.ts` | 수정 | `codexRows(book, year, sceneYear)` 잠긴 씬 제외 |
| `src/office/Office.tsx` | 수정 | 배정 로직 제거·import, 연차 상태, 자동저장, 동기화, 출시 순서, 수첩 호출, 선물 창, 연차 문구, 출시 화면 줄 |
| `src/components/Settings.tsx` | 수정 | 초기화가 로컬 연차도 지움 |
| `src/i18n/{en,ko,ja,zh-Hans,zh-Hant}.json` | 수정 | 새 키 7개 |
| `scripts/checkyears.ts` | 새로 | 배정·연차·서버 동기화·수첩 분모 검사 |
| `scripts/checkrun.ts` | 수정 | `FULL`에 새 필드 |
| `package.json` | 수정 | `verify` 체인에 `checkyears` |

---

### Task 1: 배정 로직을 순수 모듈로 옮기고 1년차를 고정한다

**Files:**
- Create: `src/office/schedule.ts`
- Create: `scripts/checkyears.ts`
- Modify: `src/stages/registry.ts` (파일 끝에 추가)
- Modify: `src/office/Office.tsx:405-458` (SEVERITIES ~ assignDay 삭제), import 블록, `assignDay` 호출 4곳

**Interfaces:**
- Produces:
  - `SCENE_YEAR: Readonly<Record<string, number>>` (registry.ts)
  - `YEAR_ONE_BUILDS: readonly string[]`
  - `interface LaterBuild { id: string; year: number }`
  - `LATER_BUILDS: readonly LaterBuild[]`
  - `buildIdsFor(year: number, later?: readonly LaterBuild[]): string[]`
  - `assignDay(day: number, builds: readonly string[], machines: readonly MachineId[]): Assignment[]`
  - `FREEZE_FROM: number`, `isFreeze(day: number): boolean`

- [ ] **Step 1: 실패하는 검사를 쓴다**

`scripts/checkyears.ts`:

```ts
/**
 * The years: what a finished run opens, and what it must not change.
 *
 * No test framework here, so this is a script. It grows one section per task
 * of the plan in docs/superpowers/plans/2026-09-15-years-skeleton.md.
 *
 * Run: npx tsx scripts/checkyears.ts
 */
import {
  assignDay,
  buildIdsFor,
  YEAR_ONE_BUILDS,
  type LaterBuild,
} from "../src/office/schedule";
import { ENGINE_SCENES, SCENE_YEAR } from "../src/stages/registry";

let bad = 0;
const is = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) bad++;
};

const MACHINES = ["machineA", "machineB", "machineC", "machineD"] as const;
const isWeekend = (day: number) => (day - 1) % 7 >= 5;
const plan = (builds: readonly string[]) =>
  Array.from({ length: 12 }, (_, i) =>
    assignDay(i + 1, builds, MACHINES).map((a) => `${a.sceneId}:${a.severity}`)
  );

console.log("\nyear one is the schedule the game shipped with, to the letter");
{
  /* captured from Office.tsx before the move, 2026-09-15 */
  const GOLDEN = [
    ["stage07:low", "stage04:critical", "stage01:normal", "stage02:normal"],
    ["stage05:critical", "stage06:normal", "stage07:normal", "stage04:low"],
    ["stage02:normal", "stage03:normal", "stage05:low", "stage06:critical"],
    ["stage04:normal", "stage01:low", "stage02:critical", "stage03:normal"],
    ["stage06:critical", "stage07:critical", "stage04:normal", "stage01:normal"],
    ["stage03:critical", "stage05:normal", "stage06:normal", "stage07:low"],
    ["stage01:normal", "stage02:normal", "stage03:low", "stage05:critical"],
    ["stage07:normal", "stage04:low", "stage01:critical", "stage02:normal"],
    ["stage05:low", "stage06:critical", "stage07:normal", "stage04:normal"],
    ["stage02:critical", "stage03:normal", "stage05:normal", "stage06:low"],
    ["stage04:critical", "stage01:critical", "stage02:critical", "stage03:critical"],
    ["stage06:critical", "stage07:critical", "stage04:critical", "stage01:critical"],
  ];
  const got = plan(buildIdsFor(1));
  const off = got.findIndex((d, i) => JSON.stringify(d) !== JSON.stringify(GOLDEN[i]));
  is(off === -1, `all twelve days match${off === -1 ? "" : ` — day ${off + 1} is ${JSON.stringify(got[off])}`}`);
}

console.log("\nevery build belongs to exactly one year");
{
  const all = [...ENGINE_SCENES.map((s) => s.id), "stage04"];
  const nowhere = all.filter((id) => !YEAR_ONE_BUILDS.includes(id) && !(id in SCENE_YEAR));
  const twice = all.filter((id) => YEAR_ONE_BUILDS.includes(id) && id in SCENE_YEAR);
  const ghosts = YEAR_ONE_BUILDS.filter((id) => !all.includes(id));
  is(nowhere.length === 0, `no build is left out of the rotation${nowhere.length ? ` — ${nowhere.join(", ")}` : ""}`);
  is(twice.length === 0, `no build is in year one and a later year${twice.length ? ` — ${twice.join(", ")}` : ""}`);
  is(ghosts.length === 0, `year one names only builds that exist${ghosts.length ? ` — ${ghosts.join(", ")}` : ""}`);
}

console.log("\na later year adds its builds and every one of them reaches a machine");
{
  const later: LaterBuild[] = [
    { id: "stage08", year: 2 },
    { id: "stage09", year: 3 },
  ];
  is(JSON.stringify(buildIdsFor(1, later)) === JSON.stringify(YEAR_ONE_BUILDS), "year one ignores later builds");
  for (const year of [2, 3, 7]) {
    const builds = buildIdsFor(year, later);
    const seen = new Set<string>();
    let doubled = false;
    for (let d = 1; d <= 12; d++) {
      const day = assignDay(d, builds, MACHINES).map((a) => a.sceneId);
      if (new Set(day).size < day.length) doubled = true;
      if (!isWeekend(d)) day.forEach((id) => seen.add(id));
    }
    const missing = builds.filter((id) => !seen.has(id));
    is(missing.length === 0, `year ${year}: all ${builds.length} builds are queued on a working day${missing.length ? ` — never ${missing.join(", ")}` : ""}`);
    is(!doubled, `year ${year}: no day puts one build on two machines`);
  }
}

console.log(bad ? `\n${bad} FAIL` : "\nthe years hold");
process.exitCode = bad ? 1 : 0;
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx scripts/checkyears.ts`
Expected: 실패 — `Cannot find module '../src/office/schedule'`

- [ ] **Step 3: `SCENE_YEAR`를 registry에 추가한다**

`src/stages/registry.ts` 끝에:

```ts
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
export const SCENE_YEAR: Readonly<Record<string, number>> = {};
```

- [ ] **Step 4: `src/office/schedule.ts`를 만든다**

```ts
import type { Assignment } from "./run";
import type { MachineId } from "./scene";
import type { Severity } from "./rating";
import { isHotfix } from "./events";
import { SCENE_YEAR } from "../stages/registry";

/**
 * Which builds go on which machine, day by day.
 *
 * Moved out of Office.tsx so it can be checked without a browser: the schedule
 * is the one thing a new year must not disturb for anyone still in year one,
 * and "it looks the same" is not a check.
 */

/*
 * One per machine, rotated by the day so no machine is always the bad one.
 *
 * Four entries because there are four machines: with three the fourth build
 * doubled a severity that moved from day to day, and the total riding on a
 * day changed with it — which is not something a rating can be a share of.
 */
const SEVERITIES: Severity[] = ["normal", "low", "critical", "normal"];

/**
 * Code freeze: the last two working days, when everything on the machines is
 * critical. Nothing new is written this close to a release, so what is left
 * on the machines is the work nobody dared touch until now.
 */
export const FREEZE_FROM = 11;
export const isFreeze = (day: number) => day >= FREEZE_FROM;

/**
 * Every build of year one, in the order the rotation has always walked.
 *
 * Written out rather than derived from the scene list, because appending a
 * scene to that list would change this order and move every day of every
 * year-one run. The card game is its own component, not an engine scene, and
 * has always come last.
 */
export const YEAR_ONE_BUILDS: readonly string[] = [
  "stage01",
  "stage02",
  "stage03",
  "stage05",
  "stage06",
  "stage07",
  "stage04",
];

export interface LaterBuild {
  id: string;
  year: number;
}

/** the builds that arrive after year one, earliest year first */
export const LATER_BUILDS: readonly LaterBuild[] = Object.entries(SCENE_YEAR)
  .map(([id, year]) => ({ id, year }))
  .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

/** the rotation for a run that started in `year` */
export function buildIdsFor(
  year: number,
  later: readonly LaterBuild[] = LATER_BUILDS
): string[] {
  return [
    ...YEAR_ONE_BUILDS,
    ...later.filter((b) => b.year <= year).map((b) => b.id),
  ];
}

/**
 * Four builds a day, one per machine. Each day holds one of each severity and
 * a second normal, and which machine carries the critical one rotates.
 */
export function assignDay(
  day: number,
  builds: readonly string[],
  machines: readonly MachineId[]
): Assignment[] {
  return machines.map((machine, i) => ({
    machine,
    // a stride that is coprime with the list, so the day's four slide along
    // it instead of alternating between the same two sets — 5 is coprime with
    // 7, 8 and 9, which is every length the years produce
    sceneId: builds[(day * 5 + i) % builds.length],
    severity:
      isFreeze(day) || (isHotfix(day) && i === 0)
        ? "critical"
        : SEVERITIES[(i + day) % SEVERITIES.length],
    result: null,
    bugId: null,
  }));
}
```

- [ ] **Step 5: 검사가 통과하는지 본다**

Run: `npx tsx scripts/checkyears.ts`
Expected: 모든 줄 `PASS`, 마지막 줄 `the years hold`

- [ ] **Step 6: `Office.tsx`에서 옛 정의를 지우고 새 모듈을 쓴다**

먼저 옛 이름을 쓰는 곳을 센다:

Run: `grep -n "SEVERITIES\|FREEZE_FROM\|isFreeze\|BUILD_IDS\|assignDay" src/office/Office.tsx`
Expected: 정의부(405~458행 부근)와 `assignDay(` 호출 4곳(531, 1135, 1508, 1620행 부근), `isFreeze(` 사용처 몇 곳. 정의부 밖에서 `SEVERITIES`나 `BUILD_IDS`를 쓰는 줄이 있으면 멈추고 보고한다.

`Office.tsx`에서 `const SEVERITIES: Severity[] = ["normal", "low", "critical", "normal"];`부터 `function assignDay(...) { ... }`의 닫는 `}`까지 (그 위 주석 포함) 전부 지운다. `SEVERITY_PIPS`는 **지우지 않는다** — 다른 상수다.

import 블록의 `import { ENGINE_SCENES } from "../stages/registry";` 아래에 추가:

```ts
import { assignDay, buildIdsFor, isFreeze } from "./schedule";
```

`OfficeRun` 안, `const [day, setDay] = useState(boot?.day ?? START_DAY);` **바로 다음 줄에** (Task 5가 이 자리를 `yearAtStart`로 바꾼다):

```ts
  const builds = useMemo(() => buildIdsFor(1), []);
```

`assignDay` 호출 4곳을 바꾼다:

```ts
// 531행 부근 (assignments 초기값)
        : assignDay(boot?.day ?? START_DAY, builds, MACHINES))
// 1135행 부근 (wake)
    setAssignments(isWeekend(next) ? [] : assignDay(next, builds, MACHINES));
// 1508행 부근 (hotfix)
          assignDay(day, builds, [MACHINES[0]]).map((a) => ({ ...a, hotfix: true }))
// 1620행 부근 (stake)
      (sum, d) => sum + totalStake(1, assignDay(d, builds, MACHINES).map((a) => a.severity)),
```

- [ ] **Step 7: 타입과 기존 검사**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checkyears.ts && npx tsx scripts/checkrun.ts`
Expected: 오류 없음, 두 스크립트 모두 실패 0

- [ ] **Step 8: 커밋·푸시**

```bash
git add src/office/schedule.ts src/stages/registry.ts src/office/Office.tsx scripts/checkyears.ts
git commit -m "Move the schedule out of Office and pin year one to what shipped

assignDay lived inside a component file that node cannot import, so the one
promise the years make to a year-one player - that nothing moves - could not
be checked. It is a pure module now, taking the build list it rotates through,
and checkyears compares year one against the twelve days captured from the
code before the move.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 2: 로컬 연차 기록

**Files:**
- Create: `src/office/years.ts`
- Modify: `scripts/checkyears.ts` (import와 새 구역)

**Interfaces:**
- Produces:
  - `MAX_YEARS = 99`
  - `RUN_ID: RegExp` = `/^(r[0-9a-z]{12}|legacy-\d{1,2})$/`
  - `isRunId(v: unknown): v is string`
  - `newRunId(): string`
  - `loadYears(): string[]`
  - `addYear(id: string): string[]`
  - `mergeYears(incoming: readonly unknown[]): string[]`
  - `clearYears(): void`
  - `yearOf(ids: readonly string[]): number`

- [ ] **Step 1: 실패하는 검사를 추가한다**

`scripts/checkyears.ts` 맨 위 import 아래에:

```ts
import {
  MAX_YEARS,
  addYear,
  clearYears,
  isRunId,
  loadYears,
  mergeYears,
  newRunId,
  yearOf,
} from "../src/office/years";

/** a localStorage that exists, because node has none */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
```

`console.log(bad ? ...` 줄 **바로 위에**:

```ts
console.log("\nthe device keeps a set of finished runs, and the year is its size");
{
  store.clear();
  is(yearOf(loadYears()) === 1, "nothing finished is year one");

  const a = newRunId();
  const b = newRunId();
  is(isRunId(a) && isRunId(b) && a !== b, `run ids are well formed and distinct (${a}, ${b})`);

  addYear(a);
  is(yearOf(loadYears()) === 2, "one finished run is year two");
  addYear(a);
  is(loadYears().length === 1, "reporting the same run twice counts it once");

  mergeYears([b, "legacy-1", a]);
  is(yearOf(loadYears()) === 4, "a second device's runs are added, not maxed");

  mergeYears(["", "r123", "stage01/x", 42, null, "legacy-100"]);
  is(loadYears().length === 3, "ids that are not run ids are ignored");

  store.set("fb_years_v1", "not json");
  is(loadYears().length === 0, "an unreadable record is an empty one, not an exception");

  store.clear();
  const many = Array.from({ length: 120 }, () => newRunId());
  mergeYears(many);
  is(loadYears().length === MAX_YEARS, `the record stops at ${MAX_YEARS} runs`);
  is(yearOf(loadYears()) === 99, "and the year stops at 99");

  clearYears();
  is(loadYears().length === 0 && yearOf(loadYears()) === 1, "clearing goes back to year one");
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx scripts/checkyears.ts`
Expected: 실패 — `Cannot find module '../src/office/years'`

- [ ] **Step 3: `src/office/years.ts`를 만든다**

```ts
/**
 * The runs this player has finished, on this device.
 *
 * A finished run is a year, and the year decides what the next run holds. It
 * is counted as a set of run ids rather than a number, for the same reason the
 * book is a set: two devices that each finish a run offline have finished two,
 * and a number merged by taking the larger would say one; a report sent twice
 * is still one run, and a number incremented on the server would say two.
 *
 * Local storage is what the game reads. The account keeps a second copy that
 * is folded in both ways — see syncYears in src/net/save.ts.
 */

const KEY = "fb_years_v1";

/** no more than this many runs are kept, which puts the year at 99 */
export const MAX_YEARS = 99;

/**
 * What a run id looks like: "r" and twelve characters for a run this build
 * started, or "legacy-N" for a run the account counted before ids existed.
 * The server holds the same pattern.
 */
export const RUN_ID = /^(r[0-9a-z]{12}|legacy-\d{1,2})$/;

export const isRunId = (v: unknown): v is string =>
  typeof v === "string" && RUN_ID.test(v);

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newRunId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "r";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function loadYears(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const id of parsed) {
      if (out.length >= MAX_YEARS) break;
      if (isRunId(id) && !out.includes(id)) out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}

function store(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* a browser that will not store plays every run as the same year */
  }
}

/** fold ids in; anything that is not a run id, or past the cap, is ignored */
export function mergeYears(incoming: readonly unknown[]): string[] {
  const ids = loadYears();
  let changed = false;
  for (const id of incoming) {
    if (ids.length >= MAX_YEARS) break;
    if (!isRunId(id) || ids.includes(id)) continue;
    ids.push(id);
    changed = true;
  }
  if (changed) store(ids);
  return ids;
}

/** a run has shipped */
export function addYear(id: string): string[] {
  return mergeYears([id]);
}

export function clearYears(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing was stored, so nothing needs removing */
  }
}

/** the year a run started now would be */
export const yearOf = (ids: readonly string[]): number =>
  Math.min(ids.length, MAX_YEARS - 1) + 1;
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsc -b && npx tsx scripts/checkyears.ts`
Expected: 오류 없음, 실패 0

- [ ] **Step 5: 커밋·푸시**

```bash
git add src/office/years.ts scripts/checkyears.ts
git commit -m "Keep the runs a player has finished, as a set

A year is a finished run. Counted as a set of run ids, so two devices that
each finish offline have finished two and a report sent twice is still one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 3: 회차 스냅샷에 `runId`·`yearAtStart`·`gift`

**Files:**
- Modify: `src/office/run.ts` (`ItemId` 아래, `RunFields` 끝, `parseRun` 끝)
- Modify: `server.js:108` 부근 (`RUN_FIELDS` 끝), `runField` switch
- Modify: `scripts/checkrun.ts` (`FULL` 끝)

**Interfaces:**
- Consumes: `isRunId` (Task 2)
- Produces:
  - `type GiftId = Exclude<ItemId, "retest">`
  - `GIFTS: readonly GiftId[]` = `["magnifier", "chair", "alarm", "shoes", "thermos"]`
  - `RunFields.runId: string`, `RunFields.yearAtStart: number`, `RunFields.gift: GiftId | null`

- [ ] **Step 1: 실패하는 검사 — `FULL`에 새 필드를 넣는다**

`scripts/checkrun.ts`의 `FULL`에서 `codexAtStart: 37,` 다음 줄에:

```ts
  runId: "r0a1b2c3d4e5f",
  yearAtStart: 3,
  gift: "alarm",
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx scripts/checkrun.ts`
Expected: 먼저 타입 오류가 없으면 `FAIL  every field comes back unchanged — lost runId, yearAtStart, gift`, `FAIL  the server validates every field the client saves — missing gift, runId, yearAtStart`, `FAIL  Office restores all ... never reads runId, yearAtStart, gift`. (tsx는 타입을 검사하지 않으므로 스크립트는 돈다.)

- [ ] **Step 3: `run.ts`**

`export type ItemId = ...;` 선언 바로 아래에:

```ts
/**
 * What a new year can hand over on its first morning. Everything on sale
 * except the retest form: the others change how fast you work or how well you
 * see, and the form undoes a report the briefing says will stand.
 */
export type GiftId = Exclude<ItemId, "retest">;
export const GIFTS: readonly GiftId[] = [
  "magnifier",
  "chair",
  "alarm",
  "shoes",
  "thermos",
];
```

파일 위쪽 import에 추가 (다른 import가 없으면 파일 첫 줄에):

```ts
import { isRunId } from "./years";
```

`RunFields` 인터페이스의 `codexAtStart: number;` 다음에:

```ts
  /** this run's id, added to the finished set when it ships */
  runId: string;
  /**
   * The year this run began in. Fixed at the start: another device finishing a
   * run halfway through this one does not change what this one holds.
   */
  yearAtStart: number;
  /** what the first morning handed over, or null until it is picked */
  gift: GiftId | null;
```

`parseRun`의 `put(out, "codexAtStart", ...)` 다음 줄에:

```ts
  put(out, "runId", isRunId(r.runId) ? r.runId : undefined);
  put(out, "yearAtStart", int(r.yearAtStart, 1, 99));
  put(out, "gift", r.gift === null ? null : oneOf(r.gift, GIFTS));
```

- [ ] **Step 4: `server.js`**

`const MAX_ID_LEN = 64;` 다음 줄에:

```js
/*
 * A finished run's id: "r" and twelve characters, or "legacy-N" for a run the
 * account counted before ids existed. The same pattern as src/office/years.ts.
 */
const RUN_ID = /^(r[0-9a-z]{12}|legacy-\d{1,2})$/;
const MAX_YEARS = 99;
```

`RUN_FIELDS`의 `codexAtStart: ["n", 0, 999],` 다음에:

```js
  runId: ["runid"],
  yearAtStart: ["n", 1, 99],
  gift: ["s", [null, "magnifier", "chair", "alarm", "shoes", "thermos"]],
```

`runField`의 `case "items":` 블록 바로 앞에:

```js
    case "runid":
      return typeof v === "string" && RUN_ID.test(v) ? v : undefined;
```

- [ ] **Step 5: 검사 — Office 복원 검사만 남아야 한다**

Run: `npx tsx scripts/checkrun.ts`
Expected: 왕복·서버 비교는 `PASS`. `Office restores all ... — never reads runId, yearAtStart, gift` 한 줄만 `FAIL` (Task 5가 채운다).

이 한 줄 실패를 남긴 채로 커밋하지 않도록, Office가 새 필드를 **읽기만** 하게 지금 넣는다. `OfficeRun`의 `const builds = useMemo(() => buildIdsFor(1), []);` 줄을 이것으로 바꾼다:

```ts
  /** this run's id, fixed for its lifetime */
  const [runId] = useState(() => boot?.runId ?? newRunId());
  /**
   * The year this run belongs to. A saved run from before years existed has
   * none and is year one; a fresh run is whatever this device has finished.
   */
  const [yearAtStart] = useState(
    () => boot?.yearAtStart ?? (boot ? 1 : yearOf(loadYears()))
  );
  /** the first morning's gift, once picked */
  const [gift, setGift] = useState<GiftId | null>(boot?.gift ?? null);
  const builds = useMemo(() => buildIdsFor(yearAtStart), [yearAtStart]);
```

Office import 추가:

```ts
import { loadYears, newRunId, yearOf } from "./years";
```

`./run` import 목록에 `type GiftId,`를 추가하고, 자동저장 `wire` 객체의 `codexAtStart,` 다음에:

```ts
    runId,
    yearAtStart,
    gift,
```

`setGift`는 Task 6이 쓴다. 지금은 lint가 안 쓰인 변수로 경고하면 `const [gift] = useState<GiftId | null>(boot?.gift ?? null);`로 두고 Task 6에서 `setGift`를 붙인다.

- [ ] **Step 6: 전체 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checkrun.ts && npx tsx scripts/checkyears.ts`
Expected: 오류 없음, 두 스크립트 실패 0

- [ ] **Step 7: 커밋·푸시**

```bash
git add src/office/run.ts server.js scripts/checkrun.ts src/office/Office.tsx
git commit -m "Give every run an id, the year it began in, and room for a gift

Three fields on the snapshot, validated the same way on both sides. The year is
fixed when the run starts: a saved run from before years is year one, a fresh
one is whatever this device has finished. The schedule now reads it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 4: 계정 동기화 `syncYears`와 초기화

**Files:**
- Modify: `server.js` — `class Server` 안 `reportRun` 다음에 `syncYears`, `resetSave`에 `finished: []`, 파일 끝에 `sanitiseYears`
- Modify: `src/net/save.ts` — `syncBook` 다음에 `syncYears`
- Modify: `scripts/checkyears.ts` — 서버 구역

**Interfaces:**
- Consumes: `loadYears`, `mergeYears` (Task 2)
- Produces:
  - 서버 `async syncYears(incoming: unknown): string[]`
  - 클라이언트 `syncYears(server: Remote): Promise<void>`

- [ ] **Step 1: 실패하는 검사**

`scripts/checkyears.ts` import에 추가:

```ts
import { readFileSync } from "node:fs";
```

`console.log(bad ? ...` 바로 위에:

```ts
/** server.js, loaded the way the platform loads it, against a fake account */
const account = () => {
  let state: Record<string, unknown> = {};
  const $global = {
    getMyState: async () => JSON.parse(JSON.stringify(state)),
    updateMyState: async (patch: Record<string, unknown>) => {
      state = { ...state, ...patch };
    },
  };
  const src = readFileSync("server.js", "utf8");
  const load = new Function("$global", `${src}\nreturn new Server();`) as (
    g: typeof $global
  ) => {
    syncYears: (ids: unknown) => Promise<string[]>;
    reportRun: (rating: number) => Promise<unknown>;
    resetSave: () => Promise<unknown>;
  };
  return {
    server: load($global),
    set: (s: Record<string, unknown>) => void (state = s),
    get: () => state,
  };
};

await (async () => {
  console.log("\nthe account keeps the same set, and counts the runs from before ids");

  {
    const { server, set, get } = account();
    set({ runs: 3 });
    const first = await server.syncYears([]);
    is(first.length === 3 && first[0] === "legacy-1", `three runs from before become three legacy ids (${first.join(",")})`);
    set({ ...get(), runs: 4 });
    const again = await server.syncYears([]);
    is(again.length === 3, "and the migration happens once — a later runs count adds nothing");
  }

  {
    const { server, set } = account();
    set({ runs: 4 });
    const got = await server.syncYears(["r0a1b2c3d4e5f"]);
    is(got.length === 4, `a run reported before the first sync is not counted twice (${got.join(",")})`);
    is(yearOf(got) === 5, "which makes it year five");
  }

  {
    const { server } = account();
    await server.syncYears(["r000000000001"]);
    const both = await server.syncYears(["r000000000002"]);
    is(both.length === 2, "two devices' runs are a union");
    const dup = await server.syncYears(["r000000000001"]);
    is(dup.length === 2, "and the same run twice is still one");
    const junk = await server.syncYears(["stage01/x", 7, "r12", null]);
    is(junk.length === 2, "ids that are not run ids are refused");
  }

  {
    const { server } = account();
    const many = Array.from({ length: 120 }, (_, i) => `r${String(i).padStart(12, "0")}`);
    const got = await server.syncYears(many);
    is(got.length === 99, "the account stops at 99 runs too");
  }

  {
    const { server, set, get } = account();
    set({ runs: 5, finished: ["r000000000001"] });
    await server.resetSave();
    is(Array.isArray(get().finished) && (get().finished as unknown[]).length === 0, "a wipe empties the finished set");
    const after = await server.syncYears([]);
    is(after.length === 0, "and does not migrate the old count back in");
  }
})();
```

`console.log(bad ? ...` 줄과 `process.exitCode` 줄은 이 블록 **아래**에 그대로 남는다.

- [ ] **Step 2: 실패 확인**

Run: `npx tsx scripts/checkyears.ts`
Expected: `TypeError: server.syncYears is not a function`

- [ ] **Step 3: 서버 구현**

`class Server` 안, `async reportRun(rating) { ... }` 메서드가 끝난 다음에:

```js
  /**
   * Fold a device's finished runs into the account's and hand back the union.
   *
   * A set, not a count: two devices that each finished a run offline have
   * finished two, and a run reported twice is one.
   *
   * The account counted runs as a number before this existed. The first time
   * a `finished` set is written, that number becomes that many legacy ids —
   * less whatever ids arrived in the same call, because the ship screen reports
   * the rating before it syncs, so a run that just shipped is already in `runs`
   * and is also arriving here. After that the number is never read again, so a
   * report that lands between two syncs cannot be counted twice.
   */
  async syncYears(incoming) {
    const state = (await $global.getMyState()) || {};
    const add = sanitiseYears(incoming);
    const had = Array.isArray(state.finished);
    let finished;
    if (had) {
      finished = sanitiseYears(state.finished);
    } else {
      const runs =
        Number.isInteger(state.runs) && state.runs > 0
          ? Math.min(state.runs, MAX_YEARS)
          : 0;
      const legacy = Math.max(0, runs - add.length);
      finished = Array.from({ length: legacy }, (_, i) => `legacy-${i + 1}`);
    }
    const before = finished.length;
    for (const id of add) {
      if (finished.length >= MAX_YEARS) break;
      if (!finished.includes(id)) finished.push(id);
    }
    if (!had || finished.length !== before) {
      await $global.updateMyState({ finished, updatedAt: Date.now() });
    }
    return finished;
  }
```

`resetSave`의 `updateMyState` 객체에서 `run: null,` 다음에:

```js
      finished: [],
```

파일 맨 끝(`sanitise` 함수 다음)에:

```js
/** a list of run ids as sent by a client: well formed, distinct, capped */
function sanitiseYears(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const id of raw) {
    if (out.length >= MAX_YEARS) break;
    if (typeof id !== "string" || !RUN_ID.test(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
```

- [ ] **Step 4: 클라이언트 구현**

`src/net/save.ts` import에 추가:

```ts
import { loadYears, mergeYears } from "../office/years";
```

`export async function syncBook(...) { ... }` 다음에:

```ts
/**
 * Fold this device's finished runs into the account's, both ways.
 *
 * The same posture as the book: a union, allowed to fail quietly, and a wipe
 * still owed is carried out before anything is pulled down — otherwise the
 * account's set would come straight back over an emptied device.
 */
export async function syncYears(server: Remote): Promise<void> {
  if (resetOwed()) {
    await resetSave(server);
    if (resetOwed()) return;
  }
  const sent = epoch;
  try {
    const merged = (await server.remoteFunction("syncYears", [
      loadYears(),
    ])) as unknown;
    if (Array.isArray(merged) && sent === epoch) mergeYears(merged);
  } catch {
    /* no server, or it said no. The local set is still the set. */
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checkyears.ts && npx tsx scripts/checkrun.ts`
Expected: 오류 없음, 실패 0. `checkrun`의 `resetSave clears the run`과 `does not touch adsRemoved`도 그대로 PASS

- [ ] **Step 6: 커밋·푸시**

```bash
git add server.js src/net/save.ts scripts/checkyears.ts
git commit -m "Sync the finished runs with the account, and count the old ones once

syncYears is a union both ways. The first time an account gets a finished set,
the runs it already counted become legacy ids - less whatever arrived in the
same call - and the old count is never read again. A wipe empties the set.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 5: Office가 연차를 쌓고, 초기화가 지운다

**Files:**
- Modify: `src/office/Office.tsx` — 연결 effect(572행 부근), 출시 보고(1645행 부근)
- Modify: `src/components/Settings.tsx:222` 부근

**Interfaces:**
- Consumes: `addYear`, `clearYears` (Task 2), 클라이언트 `syncYears` (Task 4), `runId` (Task 3)

- [ ] **Step 1: 연결될 때 동기화**

`Office.tsx` import `import { syncBook, queueSync, reportRun } from "../net/save";`를:

```ts
import { syncBook, syncYears, queueSync, reportRun } from "../net/save";
```

`./years` import를:

```ts
import { addYear, loadYears, newRunId, yearOf } from "./years";
```

연결 effect를:

```ts
  useEffect(() => {
    if (!connected) return;
    void syncBook(server);
    void syncYears(server);
  }, [connected, server]);
```

- [ ] **Step 2: 출시 화면 — 로컬에 먼저, 계정은 보고 뒤에**

`void reportRun(connected ? server : null, rating);` 줄을 이것으로 바꾼다:

```ts
      /*
       * The run is a year now. Written to the device first, so a tab closed on
       * this screen still counts it. The account hears after the rating has
       * landed: syncYears turns an old runs count into legacy ids once, and it
       * has to see this run already counted there to subtract it.
       */
      addYear(runId);
      void (async () => {
        const srv = connected ? server : null;
        await reportRun(srv, rating);
        if (srv) await syncYears(srv);
      })();
```

- [ ] **Step 3: 초기화**

`src/components/Settings.tsx` import에:

```ts
import { clearYears } from "../office/years";
```

`clearCodex();` 다음 줄에:

```ts
              clearYears();
```

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checkrun.ts && npx tsx scripts/checkyears.ts`
Expected: 오류 없음, 실패 0

Run: `grep -n "addYear(runId)" -A 6 src/office/Office.tsx`
Expected: `addYear(runId);` 뒤에 `await reportRun` 다음 `await syncYears` 순서

- [ ] **Step 5: 커밋·푸시**

```bash
git add src/office/Office.tsx src/components/Settings.tsx
git commit -m "Count a shipped run as a year, and let the wipe take the years too

The run goes into the device's set as the ship screen opens, and to the
account only after the rating has been reported. Connecting syncs the set
alongside the book; wiping the record clears it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 6: 수첩은 열린 빌드만 센다

**Files:**
- Modify: `src/office/codex.ts` — import, `codexRows`
- Modify: `src/office/Office.tsx` — `codexRows()` 호출 3곳
- Modify: `scripts/checkyears.ts` — 수첩 구역

**Interfaces:**
- Consumes: `SCENE_YEAR` (Task 1), `yearAtStart` (Task 3)
- Produces: `codexRows(book?: Book, year?: number, sceneYear?: Readonly<Record<string, number>>): CodexRow[]`

- [ ] **Step 1: 실패하는 검사**

`scripts/checkyears.ts` import에:

```ts
import { codexRows } from "../src/office/codex";
```

마지막 `await (async () => { ... })();` 블록 **앞에** (동기 구역들 사이에):

```ts
console.log("\nthe book only counts what this year can meet");
{
  const all = codexRows({}, 1);
  const lockStage07 = { stage07: 2 };
  const y1 = codexRows({}, 1, lockStage07);
  const y2 = codexRows({}, 2, lockStage07);
  const in07 = all.filter((r) => r.sceneId === "stage07").length;
  is(in07 > 0, `stage07 has faults to lock (${in07})`);
  is(y1.length === all.length - in07, "a build from a later year is not in year one's book");
  is(y1.every((r) => r.sceneId !== "stage07"), "not even one of its rows");
  is(y2.length === all.length, "and it is there from its own year");
  is(codexRows({}, 1).length === all.length, "with nothing locked, year one's book is the whole book");
}
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx scripts/checkyears.ts`
Expected: `FAIL  a build from a later year is not in year one's book`, `FAIL  not even one of its rows`

- [ ] **Step 3: 구현**

`src/office/codex.ts` 첫 줄 `import { ENGINE_SCENES } from "../stages/registry";`를:

```ts
import { ENGINE_SCENES, SCENE_YEAR } from "../stages/registry";
```

`codexRows` 시그니처와 첫 루프를:

```ts
/**
 * Every fault the game can plant this year, with what the player has done
 * about it. A build that arrives in a later year is left out of the rows and
 * the total alike: the book's "of N" is what the player can meet.
 */
export function codexRows(
  book: Book = loadCodex(),
  year: number = Number.MAX_SAFE_INTEGER,
  sceneYear: Readonly<Record<string, number>> = SCENE_YEAR
): CodexRow[] {
  const rows: CodexRow[] = [];
  for (const scene of ENGINE_SCENES) {
    if ((sceneYear[scene.id] ?? 1) > year) continue;
    for (const m of generateMutations(scene)) {
```

(루프 본문과 stage04 루프는 그대로. 카드 게임은 1년차 빌드다.)

`Office.tsx`의 세 호출:

```ts
// codexAtStart 초기값
    () => boot?.codexAtStart ?? codexTally(codexRows(undefined, yearAtStart)).caught
// 출시 화면
          const book = codexTally(codexRows(undefined, yearAtStart));
// 수첩 모달
              const rows = codexRows(undefined, yearAtStart);
```

`yearAtStart` 선언이 `codexAtStart` 선언보다 **위에** 있는지 확인한다 (Task 3에서 `day` 바로 아래에 넣었으므로 위에 있다).

- [ ] **Step 4: 통과 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checkyears.ts`
Expected: 오류 없음, 실패 0

- [ ] **Step 5: 커밋·푸시**

```bash
git add src/office/codex.ts src/office/Office.tsx scripts/checkyears.ts
git commit -m "Count only this year's builds in the book

A build that arrives in a later year is out of the rows and the total, so the
book's denominator is what the player can actually meet. With SCENE_YEAR empty
nothing changes yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 7: 시작 선물

**Files:**
- Modify: `src/office/Office.tsx` — 선물 상태, 아침 문구 effect, `takeGift`, 선물 모달
- Modify: `src/i18n/en.json`, `ko.json`, `ja.json`, `zh-Hans.json`, `zh-Hant.json`

**Interfaces:**
- Consumes: `GIFTS`, `GiftId` (Task 3), `gift`·`setGift`·`yearAtStart` (Task 3)
- Produces: i18n 키 `gift.title` (`{n}`), `gift.take`

- [ ] **Step 1: i18n 키**

`scripts/addkeys.mjs`를 임시로 만들지 말고, node 한 줄로 다섯 파일에 넣는다:

```bash
node -e '
const fs = require("fs");
const add = {
  en: { "gift.title": "Year {n}, first day — take one thing with you", "gift.take": "Take" },
  ko: { "gift.title": "{n}년차 첫 출근 — 하나 챙겨가자", "gift.take": "챙기기" },
  ja: { "gift.title": "{n}年目の初出勤 — ひとつ持っていこう", "gift.take": "持っていく" },
  "zh-Hans": { "gift.title": "第{n}年第一天上班 — 带一样东西去", "gift.take": "带上" },
  "zh-Hant": { "gift.title": "第{n}年第一天上班 — 帶一樣東西去", "gift.take": "帶上" },
};
for (const [lang, keys] of Object.entries(add)) {
  const p = `src/i18n/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(dict, keys);
  fs.writeFileSync(p, JSON.stringify(dict, null, 2) + "\n");
}
'
```

Run: `git diff --stat src/i18n`
Expected: 다섯 파일 각 `+2`줄 안팎. 한 파일이 수백 줄 바뀌었다면 원래 들여쓰기가 달랐던 것이다 — `git checkout src/i18n`으로 되돌리고 그 파일만 Edit 도구로 두 줄 넣는다.

Run: `npx tsx scripts/checki18n.ts`
Expected: 실패 0

- [ ] **Step 2: 선물 상태와 아침 문구 순서**

Task 3에서 `const [gift] = useState...`로 두었다면 `const [gift, setGift] = useState<GiftId | null>(boot?.gift ?? null);`로 바꾼다.

`./run` import에 `GIFTS,`를 추가한다 (값 import).

`const builds = useMemo(...)` 다음 줄에:

```ts
  /** a run from year two on hands over one thing before its first morning */
  const giftOwed = yearAtStart >= 2 && gift === null;
```

아침 문구 effect를:

```ts
  // said once on the first morning too, not only on the ones you wake up to —
  // after the gift, when there is one, so the two never open over each other
  useEffect(() => {
    if (giftOwed) return;
    setNote(morningLine());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

`const buy = (item: ItemId, cost: number) => { ... };` 다음에:

```ts
  /** the year's gift: bought for nothing, once, and then the morning */
  const takeGift = (item: GiftId) => {
    if (gift !== null) return;
    setGift(item);
    setOwned((o) => (o.includes(item) ? o : [...o, item]));
    sfx.play("success");
    setNote(morningLine());
  };
```

- [ ] **Step 3: 선물 모달**

`{shop && (` 모달 블록 **바로 앞에**:

```tsx
      {/*
        The year's gift. The shop's own markup, so it reads as the same
        catalogue, with no close button and a backdrop that does nothing: the
        only way out is to take something, because closing it by accident would
        throw the gift away.
      */}
      {giftOwed && (
        <div className="modal-backdrop">
          <div className="modal shop" onClick={(e) => e.stopPropagation()}>
            <h2>{tp("gift.title", { n: String(yearAtStart) })}</h2>
            <div className="shop-list">
              {GIFTS.map((id) => (
                <button key={id} className="shop-item" onClick={() => takeGift(id)}>
                  <span className="shop-name">{t(`item.${id}`)}</span>
                  <span className="shop-desc">{t(`item.${id}.desc`)}</span>
                  <em>{t("gift.take")}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checki18n.ts && npx tsx scripts/checkrun.ts && npx tsx scripts/checkyears.ts`
Expected: 오류 없음, 실패 0

- [ ] **Step 5: 커밋·푸시**

```bash
git add src/office/Office.tsx src/i18n
git commit -m "Hand over one piece of equipment on the first morning of a new year

From year two the first morning opens on the shop's own catalogue, less the
retest form, with no way out but taking something. It is owned from then on,
and the morning line waits for it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 8: 연차 아침 문구와 출시 화면 한 줄

**Files:**
- Modify: `src/office/Office.tsx` — import, `morningFor`, 출시 화면 JSX
- Modify: i18n 다섯 파일

**Interfaces:**
- Consumes: `LATER_BUILDS` (Task 1), `SCENE_BY_ID` (registry, 기존), `loadYears`·`yearOf` (Task 2), `yearAtStart` (Task 3)
- Produces: i18n 키 `home.morningYear` (`{n}`), `home.newBuild` (`{name}`), `ship.nextYear` (`{n}`), `ship.nextYearBuild` (`{n}`, `{name}`), `ship.giftAhead`

- [ ] **Step 1: i18n 키**

먼저 각 언어가 "빌드"를 어떻게 옮겼는지 본다:

Run: `grep -n '"office.buildTitle"' src/i18n/*.json`
Expected: 다섯 줄. 아래 값의 빌드 번역어(ja `ビルド`, zh-Hans `构建`, zh-Hant `建置`)가 그 줄의 단어와 다르면 그 줄의 단어로 바꿔서 넣는다.

```bash
node -e '
const fs = require("fs");
const add = {
  en: {
    "home.morningYear": "Year {n}. Twelve days again.",
    "home.newBuild": "A new build is in: {name}.",
    "ship.nextYear": "Next: year {n}",
    "ship.nextYearBuild": "Next: year {n} — a new build arrives: {name}",
    "ship.giftAhead": "You take one piece of equipment in on the first day",
  },
  ko: {
    "home.morningYear": "{n}년차. 다시 12일이다.",
    "home.newBuild": "새 빌드 ‘{name}’이 들어왔다.",
    "ship.nextYear": "다음은 {n}년차",
    "ship.nextYearBuild": "다음은 {n}년차 — 새 빌드 ‘{name}’이 들어온다",
    "ship.giftAhead": "첫 출근에 장비 하나를 챙겨간다",
  },
  ja: {
    "home.morningYear": "{n}年目。また12日だ。",
    "home.newBuild": "新しいビルド「{name}」が入った。",
    "ship.nextYear": "次は{n}年目",
    "ship.nextYearBuild": "次は{n}年目 — 新しいビルド「{name}」が入る",
    "ship.giftAhead": "初出勤に装備をひとつ持っていける",
  },
  "zh-Hans": {
    "home.morningYear": "第{n}年。又是十二天。",
    "home.newBuild": "新构建「{name}」来了。",
    "ship.nextYear": "下一年：第{n}年",
    "ship.nextYearBuild": "下一年：第{n}年 — 新构建「{name}」将加入",
    "ship.giftAhead": "第一天上班可以带一件装备",
  },
  "zh-Hant": {
    "home.morningYear": "第{n}年。又是十二天。",
    "home.newBuild": "新建置「{name}」來了。",
    "ship.nextYear": "下一年：第{n}年",
    "ship.nextYearBuild": "下一年：第{n}年 — 新建置「{name}」將加入",
    "ship.giftAhead": "第一天上班可以帶一件裝備",
  },
};
for (const [lang, keys] of Object.entries(add)) {
  const p = `src/i18n/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(dict, keys);
  fs.writeFileSync(p, JSON.stringify(dict, null, 2) + "\n");
}
'
```

Run: `npx tsx scripts/checki18n.ts`
Expected: 실패 0

- [ ] **Step 2: 연차 아침 문구**

import `import { ENGINE_SCENES } from "../stages/registry";`를:

```ts
import { ENGINE_SCENES, SCENE_BY_ID } from "../stages/registry";
```

`./schedule` import를:

```ts
import { assignDay, buildIdsFor, isFreeze, LATER_BUILDS } from "./schedule";
```

`morningFor`의 1일차 분기:

```ts
          : d === 1
          ? t(firstEverRun ? "home.morningFirst" : "home.morningFirstAgain")
```

를:

```ts
          : d === 1
          ? yearAtStart >= 2
            ? yearMorning()
            : t(firstEverRun ? "home.morningFirst" : "home.morningFirstAgain")
```

`const morningFor = ...` 선언 **바로 위에**:

```ts
  /** the first morning of a later year, and the build it brought if any */
  const yearMorning = () => {
    const fresh = LATER_BUILDS.find((b) => b.year === yearAtStart);
    const scene = fresh ? SCENE_BY_ID[fresh.id] : undefined;
    const lines = [tp("home.morningYear", { n: String(yearAtStart) })];
    if (scene) lines.push(tp("home.newBuild", { name: t(scene.nameKey) }));
    return lines.join("\n");
  };
```

- [ ] **Step 3: 출시 화면 한 줄**

출시 화면에서 수첩 줄을 그리는 `{(() => { const book = codexTally(...); return (<p className="wb-tally wb-book">...</p>); })()}` 블록 **다음에**:

```tsx
        {(() => {
          /*
           * What the next run will be. Read from the device's set, which this
           * run was added to above — and which another device may have pushed
           * further on, in which case this says so.
           */
          const nextYear = yearOf(loadYears());
          const arriving = LATER_BUILDS.filter(
            (b) => b.year > yearAtStart && b.year <= nextYear
          )
            .map((b) => SCENE_BY_ID[b.id])
            // a type guard, not filter(Boolean): TypeScript does not narrow
            // through Boolean, and arriving[0].nameKey would not compile
            .filter((s): s is SceneSpec => s !== undefined);
          const line = arriving.length
            ? tp("ship.nextYearBuild", {
                n: String(nextYear),
                name: t(arriving[0].nameKey),
              })
            : tp("ship.nextYear", { n: String(nextYear) });
          return (
            <p className="wb-tally wb-year">
              {line}
              {yearAtStart < 2 && nextYear >= 2 && (
                <>
                  <br />
                  {t("ship.giftAhead")}
                </>
              )}
            </p>
          );
        })()}
```

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npm run lint && npx tsx scripts/checki18n.ts && npx tsx scripts/checkyears.ts && npx tsx scripts/checkrun.ts`
Expected: 오류 없음, 실패 0

- [ ] **Step 5: 커밋·푸시**

```bash
git add src/office/Office.tsx src/i18n
git commit -m "Say which year it is, on the first morning and on the ship screen

A later year's first morning names the year and the build it brought. The ship
screen says what the next run will be, and the first time that is year two it
says a gift is waiting.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 9: 검증 체인과 브라우저 확인

**Files:**
- Modify: `package.json` — `scripts.verify`

- [ ] **Step 1: verify 체인에 추가**

```bash
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
p.scripts.verify = p.scripts.verify.replace("tsx scripts/checkzoom.ts", "tsx scripts/checkzoom.ts && tsx scripts/checkyears.ts");
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
console.log(p.scripts.verify);
'
```

Expected: 출력 끝이 `&& tsx scripts/checkzoom.ts && tsx scripts/checkyears.ts`

- [ ] **Step 2: 검사가 실제로 실패할 수 있는지**

`src/office/schedule.ts`의 `YEAR_ONE_BUILDS`에서 `"stage04"`와 `"stage07"`의 순서를 잠깐 바꾼다.

Run: `npx tsx scripts/checkyears.ts; echo "exit=$?"`
Expected: `FAIL  all twelve days match — day 1 is ...`, `exit=1`

바꾼 순서를 되돌린다.

Run: `npx tsx scripts/checkyears.ts; echo "exit=$?"`
Expected: 실패 0, `exit=0`

- [ ] **Step 3: 전체 검증**

Run: `npm run verify; echo "exit=$?"` 그리고 `npm run lint`
Expected: `exit=0`, `FAIL` 줄 없음, lint 출력 없음

- [ ] **Step 4: 브라우저 — 1년차는 바뀌지 않았다**

미리보기(`find-bug-dev`)를 열고 콘솔에서 저장소 상태를 먼저 기록한다:

```js
JSON.stringify({ run: localStorage.getItem("fb_run"), years: localStorage.getItem("fb_years_v1"), codex: localStorage.getItem("fb_codex_v1") })
```

이 값을 그대로 적어 둔다 — Step 6에서 되돌린다.

```js
localStorage.removeItem("fb_run"); localStorage.removeItem("fb_years_v1"); location.reload();
```

Expected: 선물 창이 **안 뜬다**. 첫 아침 문구는 `home.morningFirst` 또는 `home.morningFirstAgain`.

- [ ] **Step 5: 브라우저 — 2년차는 선물부터**

```js
localStorage.removeItem("fb_run"); localStorage.setItem("fb_years_v1", JSON.stringify(["r000000000001"])); location.reload();
```

Expected:
- 제목 `2년차 첫 출근 — 하나 챙겨가자` 모달, 항목 다섯 개(재검토 없음), 닫기 버튼 없음, 배경 클릭으로 안 닫힘
- 하나를 고르면 모달이 닫히고 `2년차. 다시 12일이다.` 문구가 뜬다
- `JSON.parse(localStorage.getItem("fb_run")).gift`가 고른 id, `.yearAtStart`가 `2`, `.owned`에 그 id
- 새로고침해도 선물 창이 다시 뜨지 않는다
- 해당 상점에 가면 그 물건이 `보유 중`

- [ ] **Step 6: 저장소 되돌리기**

Step 4에서 적어 둔 세 값으로 되돌리고, **같은 호출 안에서** 새로고침한다 (열린 페이지가 자동저장으로 덮어쓰지 못하게):

```js
const saved = /* Step 4의 값을 붙여넣는다 */;
for (const [k, key] of [["run","fb_run"],["years","fb_years_v1"],["codex","fb_codex_v1"]]) {
  if (saved[k] === null) localStorage.removeItem(key); else localStorage.setItem(key, saved[k]);
}
location.reload();
```

새로고침 후 다시 읽어 Step 4 값과 같은지 확인한다. 계정이 연결된 환경이면 계정 사본이 더 새 값으로 이길 수 있다 — 같지 않으면 그 사실을 그대로 보고한다.

- [ ] **Step 7: 커밋·푸시**

```bash
git add package.json
git commit -m "Run checkyears with the rest of verify

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
git fetch origin && git rev-parse HEAD origin/develop
```

Expected: 두 해시가 같다
