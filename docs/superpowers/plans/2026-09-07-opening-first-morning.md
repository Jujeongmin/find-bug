# 도입부: 첫날 아침 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1일차 첫 화면의 규칙 카드를 도입부 문구로 바꾸고, 두 번째 회차부터는 짧은 버전이 나오게 한다.

**Architecture:** 새 컴포넌트도 새 모달도 없다. 기존 기상 모달이 읽는 i18n 키 하나를 다시 쓰고, 그 옆에 짧은 버전 키를 하나 만든다. `Office.tsx`의 `morningFor`에서 `d === 1` 가지를 저장된 결함 수첩이 비었는지에 따라 둘로 가른다.

**Tech Stack:** React 18 + TypeScript, Vite, 자체 i18n(`src/i18n/*.json`, 평평한 키-값), 검증은 `npm run verify`(tsx 스크립트) + 브라우저 확인. **단위 테스트 프레임워크는 이 저장소에 없다** — jest/vitest를 새로 들이지 말 것.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-09-07-opening-commute-design.md`
- 지원 언어 5개 전부에 키가 있어야 한다: `en`, `ko`, `ja`, `zh-Hant`, `zh-Hans`. `npm run verify`의 i18n 검사가 누락을 실패로 잡는다.
- `lane.intro` / `street.intro`는 죽은 키다. **이번 작업에서 건드리지 않는다.**
- 새 localStorage 키를 만들지 않는다. "처음인가" 판정은 `loadCodex()`가 빈 객체인지로만 한다.
- `codexRows()`를 이 판정에 쓰지 말 것 — 못 본 결함까지 121행을 항상 돌려주므로 개수가 상수다.
- 모달 본문의 줄바꿈(`\n`)은 그대로 렌더된다(`.modal p`의 계산된 `white-space`가 `pre-line`). CSS를 고치지 않는다.
- 커밋 메시지는 영어 산문, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- 커밋과 push는 함께 한다. 브랜치는 `develop`.

---

### Task 1: 도입부 문구를 5개 언어에 넣는다

**Files:**
- Modify: `src/i18n/en.json` (`home.morningFirst` 교체, `home.morningFirstAgain` 추가)
- Modify: `src/i18n/ko.json` (동일)
- Modify: `src/i18n/ja.json` (동일)
- Modify: `src/i18n/zh-Hant.json` (동일)
- Modify: `src/i18n/zh-Hans.json` (동일)
- Test: `npm run verify` (기존 `scripts/checki18n.ts`)

**Interfaces:**
- Consumes: 없음
- Produces: 키 `home.morningFirst`(긴 버전, 3줄, `\n` 구분)과 `home.morningFirstAgain`(짧은 버전, 1줄). Task 2가 이 두 키 이름을 그대로 쓴다.

- [ ] **Step 1: 지금 값이 규칙 안내인지 확인 (바꾸기 전 기준점)**

```bash
node -e "for(const l of ['en','ko','ja','zh-Hant','zh-Hans']){const j=require('./src/i18n/'+l+'.json');console.log(l,JSON.stringify(j['home.morningFirst']));console.log('  again:',JSON.stringify(j['home.morningFirstAgain']))}"
```

Expected: 5개 언어 모두 `home.morningFirst`가 "기기 4대…하루 3개…커피" 규칙 문장이고, `home.morningFirstAgain`은 `undefined`.

- [ ] **Step 2: 두 키를 5개 언어에 쓴다**

스크래치패드에 스크립트를 만들어 실행한다(JSON을 손으로 편집하지 말 것 — 줄 끝과 인코딩이 깨진다).

```javascript
// scratchpad/openingcopy.mjs
import { readFileSync, writeFileSync } from "fs";
const ROOT = "C:/Users/anjsh/OneDrive/Desktop/Find bug";

const COPY = {
  en: {
    "home.morningFirst":
      "Two weeks to ship.\nI am the last person to look at a build before it goes out.\nWhat I miss goes out with it.",
    "home.morningFirstAgain": "Two weeks to ship.",
  },
  ko: {
    "home.morningFirst":
      "출시까지 2주.\n나가는 빌드를 마지막으로 보는 사람이 나다.\n놓친 건 그대로 나간다.",
    "home.morningFirstAgain": "출시까지 2주.",
  },
  ja: {
    "home.morningFirst":
      "リリースまで二週間。\n出ていくビルドを最後に見るのは私だ。\n見落としたものは、そのまま出ていく。",
    "home.morningFirstAgain": "リリースまで二週間。",
  },
  "zh-Hant": {
    "home.morningFirst":
      "距離上線兩週。\n送出去的版本，最後看過的人是我。\n我漏掉的，就這樣送出去。",
    "home.morningFirstAgain": "距離上線兩週。",
  },
  "zh-Hans": {
    "home.morningFirst":
      "距离上线两周。\n送出去的版本，最后看过的人是我。\n我漏掉的，就这样送出去。",
    "home.morningFirstAgain": "距离上线两周。",
  },
};

for (const [lang, keys] of Object.entries(COPY)) {
  const path = `${ROOT}/src/i18n/${lang}.json`;
  const raw = readFileSync(path, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(eol);
  const out = [];
  let replaced = false;
  let added = false;
  for (const line of lines) {
    const m = line.match(/^(\s*)"home\.morningFirst":/);
    if (m) {
      out.push(`${m[1]}"home.morningFirst": ${JSON.stringify(keys["home.morningFirst"])},`);
      out.push(`${m[1]}"home.morningFirstAgain": ${JSON.stringify(keys["home.morningFirstAgain"])},`);
      replaced = true;
      added = true;
      continue;
    }
    out.push(line);
  }
  if (!replaced || !added) { console.error(`${lang}: anchor not found`); process.exit(1); }
  const text = out.join(eol);
  const parsed = JSON.parse(text);
  for (const k of Object.keys(keys)) {
    if (parsed[k] !== keys[k]) { console.error(`${lang}: ${k} did not land`); process.exit(1); }
  }
  writeFileSync(path, text);
  console.log(`${lang}: ok, ${Object.keys(parsed).length} keys`);
}
```

Run: `node <scratchpad>/openingcopy.mjs`
Expected: 5줄 모두 `ok`, 키 개수가 언어마다 동일.

- [ ] **Step 3: 5개 언어가 다 채워졌는지 검사가 확인하게 한다**

Run: `npm run verify 2>&1 | grep translated`
Expected: `PASS  ko: N/N translated` 형태로 4줄, N이 이전보다 1 큼. FAIL 없음.

- [ ] **Step 4: 줄바꿈이 문자열에 실제로 들어갔는지 확인**

```bash
node -e "const j=require('./src/i18n/ko.json');console.log(JSON.stringify(j['home.morningFirst']));console.log('lines:', j['home.morningFirst'].split('\n').length)"
```

Expected: `lines: 3`

- [ ] **Step 5: 커밋**

```bash
git add src/i18n
git commit -m "$(cat <<'EOF'
Say what the job is before saying what the limits are

The first thing a new player read was three constraints — four machines,
three a day, a coffee for the fourth — none of which mean anything before
you know what a build is or why you are looking at one. Both rules already
teach themselves where they can be used: the coffee on the vending machine
and in the quest line, the daily limit on the condition pips. So the card
was not misplaced, it was redundant, and it was spending the one screen
nobody skips on information nobody could use yet.

It now says who you are and what is at stake, and nothing else. A second
key holds the one line that is still worth saying to somebody who has done
this before.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 2: 처음인 사람과 다시 하는 사람을 가른다

**Files:**
- Modify: `src/office/Office.tsx` (2번 줄 근처의 codex import, 그리고 `morningFor`)
- Test: 브라우저 확인 (아래 Step 4–6)

**Interfaces:**
- Consumes: Task 1의 `home.morningFirst`, `home.morningFirstAgain`
- Produces: 없음 (마지막 작업)

- [ ] **Step 1: `loadCodex`를 import에 추가**

현재 2번 줄:

```tsx
import { recordBug, codexRows, codexTally } from "./codex";
```

이렇게 바꾼다:

```tsx
import { recordBug, codexRows, codexTally, loadCodex } from "./codex";
```

- [ ] **Step 2: 첫 회차인지 한 번만 읽는다**

`morningFor` 정의 **바로 위**에 넣는다(`const morningFor = (d: number) =>` 앞).

```tsx
/*
 * Whether this is anyone's first run.
 *
 * The defect book is the only thing that outlives a run, so an empty one is
 * a player who has never finished a day — which is exactly who the long
 * version of the first morning is for. It reads the stored book rather than
 * codexRows(), which answers with all hundred and twenty-one faults whether
 * they have been met or not and so can never be empty.
 *
 * Read once at mount: it must not change to "returning" underneath a player
 * halfway through the run that is making it true.
 */
const [firstEverRun] = useState(() => Object.keys(loadCodex()).length === 0);
```

- [ ] **Step 3: `d === 1` 가지를 둘로 가른다**

현재:

```tsx
          : d === 1
          ? t("home.morningFirst")
```

이렇게 바꾼다:

```tsx
          : d === 1
          ? t(firstEverRun ? "home.morningFirst" : "home.morningFirstAgain")
```

- [ ] **Step 4: 타입과 린트가 통과하는지 확인**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 출력 없이 통과. `useState` import는 이미 있으므로 새로 추가할 것 없음.

- [ ] **Step 5: 처음인 사람 화면을 브라우저로 확인**

개발 서버를 띄우고(`.claude/launch.json`의 `find-bug-dev`), 수첩을 비운 뒤 1일차 아침을 연다.

브라우저 콘솔에서:

```javascript
localStorage.removeItem('fb_codex_v1');
location.href = 'http://localhost:5173/?day=1&place=home';
```

로드된 뒤:

```javascript
document.querySelector('.modal p').textContent
```

Expected: 세 줄짜리 도입부. 규칙 문장("기기 4대", "하루 3개", "커피")이 **하나도** 없어야 한다.

- [ ] **Step 6: 다시 하는 사람 화면을 브라우저로 확인**

수첩에 기록을 하나 넣고 다시 연다.

```javascript
localStorage.setItem('fb_codex_v1', JSON.stringify({'stage01/floating:tree1':'caught'}));
location.href = 'http://localhost:5173/?day=1&place=home';
```

로드된 뒤:

```javascript
document.querySelector('.modal p').textContent
```

Expected: `출시까지 2주.` 한 줄만.

확인이 끝나면 원래대로 되돌린다:

```javascript
localStorage.removeItem('fb_codex_v1');
```

- [ ] **Step 7: 2일차가 안 망가졌는지 확인 (회귀)**

```javascript
location.href = 'http://localhost:5173/?day=2&place=home';
```

로드된 뒤:

```javascript
document.querySelector('.modal p').textContent
```

Expected: `2일차`가 들어간 평소 문장(`home.morning` / `morningBright` / `morningFlat` 계열). 도입부 문구가 아니어야 한다.

- [ ] **Step 8: 전체 검사**

Run: `npm run verify && npm run build`
Expected: FAIL 줄 없음, 빌드 성공.

- [ ] **Step 9: 커밋**

```bash
git add src/office/Office.tsx
git commit -m "$(cat <<'EOF'
Give the long version only to somebody who has not heard it

The opening says who you are and what is at stake, which is worth a screen
once and is furniture on the fifth run. The defect book already knows which
of those a player is: it is the only thing that survives a run, so an empty
one means nobody has finished a day yet. Read once at mount, so a run that
fills it in cannot turn its own morning into a returning player's.

Not codexRows() — that answers with all hundred and twenty-one faults
whether they have been met or not, so its length is a constant and would
have called every player a veteran.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

## 확인이 끝난 뒤

배포는 사용자가 직접 한다. 빌드 명령만 전달할 것:

- 개발도구 켠 빌드: `npm run build && npx -y @agent8/deploy`
- 릴리스 빌드: `npm run build:release && npx -y @agent8/deploy`
