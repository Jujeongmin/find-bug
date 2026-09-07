# 하루 구조 가르치기 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1일차 첫 사인오프 직후 하루 구조를 한 번 설명하고, 한 번도 켜진 적 없는 보고 버튼 튜토리얼 힌트를 살린다.

**Architecture:** 새 컴포넌트도 새 저장 키도 없다. `Office.tsx`의 `finish()`는 사인오프 직후 컨디션을 깎는 자리이므로, 거기서 "이 회차 첫 사인오프인가"를 보고 기존 `setNote` 경로로 두 줄을 띄운다. 튜토리얼 힌트는 `EngineStage`에 이미 완성돼 있고 `tutorial` prop만 넘기면 산다.

**Tech Stack:** React 18 + TypeScript, Vite. **단위 테스트 프레임워크가 이 저장소에 없다** — jest/vitest를 새로 들이지 말 것. 검증은 `npm run verify`(tsx 스크립트) + 브라우저 확인이다.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-09-07-teaching-the-day-design.md`
- 발동 조건은 **`day === 1 && caught + missed === 0`**. 컨디션 값으로 재지 말 것 — 출근길에 커피를 마신 플레이어는 4에서 시작하므로 첫 빌드를 놓치고 두 번째에 뜬다
- 새 localStorage 키를 만들지 않는다. 힌트 쪽이 쓰는 `fb_seen_tutorial`은 `EngineStage`에 이미 있는 것이고 새로 만드는 게 아니다
- 지원 언어 5개 전부에 키가 있어야 한다: `en`, `ko`, `ja`, `zh-Hant`, `zh-Hans`
- 마음(♥) 설명은 추가하지 않는다
- 커밋 메시지는 영어 산문, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 커밋과 push는 함께. 브랜치는 `develop`

---

### Task 1: 하루 구조를 첫 사인오프에서 한 번 말한다

**Files:**
- Modify: `src/i18n/en.json`, `ko.json`, `ja.json`, `zh-Hant.json`, `zh-Hans.json` (`office.firstBuildDone` 추가)
- Modify: `src/office/Office.tsx` (`finish()` 안)

**Interfaces:**
- Consumes: 없음
- Produces: i18n 키 `office.firstBuildDone`. Task 2는 이것에 의존하지 않는다.

- [ ] **Step 1: 지금 아무것도 안 뜨는지 확인한다 (기준점)**

```bash
node -e "for(const l of ['en','ko','ja','zh-Hant','zh-Hans']){const j=require('./src/i18n/'+l+'.json');console.log(l, JSON.stringify(j['office.firstBuildDone']))}"
grep -c "firstBuildDone" src/office/Office.tsx
```

Expected: 5줄 모두 `undefined`, grep 결과 `0`.

- [ ] **Step 2: 문구를 5개 언어에 넣는다**

스크래치패드에 스크립트를 만들어 실행한다(JSON을 손으로 편집하지 말 것 — 줄 끝과 인코딩이 깨진다). 앵커는 각 파일의 `"office.whatCondition"` 줄이다.

```javascript
// scratchpad/firstbuild.mjs
import { readFileSync, writeFileSync } from "fs";
const ROOT = "C:/Users/anjsh/OneDrive/Desktop/Find bug";

const COPY = {
  en: "That is one build looked at, and one point of condition gone.\nThree a day. Sleep brings them back. A fourth only comes from a coffee on the way in.",
  ko: "빌드 하나를 봤고, 컨디션이 1 줄었다.\n하루에 3개까지. 자고 나면 돌아온다. 4번째는 출근길에 커피를 사야 생긴다.",
  ja: "ビルドを一本見て、コンディションが一つ減った。\n一日に三本まで。寝れば戻る。四本目は出勤途中のコーヒーからしか出ない。",
  "zh-Hant": "看完一個版本，狀態少了一格。\n一天三個。睡一覺就回來。第四個只能靠上班路上那杯咖啡。",
  "zh-Hans": "看完一个版本，状态少了一格。\n一天三个。睡一觉就回来。第四个只能靠上班路上那杯咖啡。",
};

for (const [lang, value] of Object.entries(COPY)) {
  const path = `${ROOT}/src/i18n/${lang}.json`;
  const raw = readFileSync(path, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const out = [];
  let added = false;
  for (const line of raw.split(eol)) {
    out.push(line);
    const m = line.match(/^(\s*)"office\.whatCondition":/);
    if (m) {
      out.push(`${m[1]}"office.firstBuildDone": ${JSON.stringify(value)},`);
      added = true;
    }
  }
  if (!added) { console.error(`${lang}: anchor not found`); process.exit(1); }
  const text = out.join(eol);
  const parsed = JSON.parse(text);
  if (parsed["office.firstBuildDone"] !== value) { console.error(`${lang}: did not land`); process.exit(1); }
  writeFileSync(path, text);
  console.log(`${lang}: ok, ${Object.keys(parsed).length} keys`);
}
```

Run: `node <scratchpad>/firstbuild.mjs`
Expected: 5줄 모두 `ok`, 키 개수가 언어마다 동일.

- [ ] **Step 3: 5개 언어가 다 채워졌는지 검사가 확인하게 한다**

Run: `npm run verify 2>&1 | grep -E "translated|^FAIL"`
Expected: `PASS  ko: N/N translated` 형태로 4줄, N이 이전보다 1 큼. FAIL 없음.

- [ ] **Step 4: 첫 사인오프에서 띄운다**

`src/office/Office.tsx`의 `finish()` 안에서 재검사 분기가 끝나는 지점을 찾는다:

```tsx
    const retesting =
      result === "missed" && owned.includes("retest") && !retestUsed;
    if (retesting) {
      setRetestUsed(true);
      setNote(t("office.retested"));
    }
```

**그 닫는 괄호 바로 아래**에 넣는다 — `setCondition` 위가 아니라 여기인 이유는 위
분기도 `setNote`를 부르기 때문이다. 1일차에는 재검사 아이템(260원)을 살 돈이 없어
실제로 겹치지는 않지만, 순서로 정해두면 경제 계산에 기대지 않아도 된다.

```tsx
    /*
     * The day explains itself the first time it costs anything.
     *
     * What the pips mean, that sleep refills them, and what the coffee on the
     * walk in is for are all written down already — on the condition meter,
     * behind a tap whose only advertisement is a dotted underline, which on a
     * phone is no advertisement at all. So the sentence comes here instead, at
     * the moment the player has just watched three become two and has a reason
     * to want it explained.
     *
     * Counted in builds signed off rather than in condition: a player who
     * bought a coffee on the way in starts the day at four, so a test against
     * the starting value would skip the first build and fire on the second.
     * caught and missed are still pre-increment here, so this is exactly the
     * first one.
     *
     * After the retest branch, which is the other thing in here that can set a
     * note. On day one there is no money for the retest item, so the two never
     * actually meet — but ordering says so without relying on the economy.
     */
    if (day === 1 && caught + missed === 0) {
      setNote(t("office.firstBuildDone"));
    }
```

- [ ] **Step 5: 타입과 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 출력 없이 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/i18n src/office/Office.tsx
git commit -m "$(cat <<'EOF'
Let the day explain itself the first time it costs something

What the condition pips mean, that a night refills them, and what the coffee
on the walk in is for are all written down already — on the meter itself,
behind a tap advertised by a one-pixel dotted underline and a help cursor,
which on a phone is not an advertisement at all. The explanation was never
missing. The way to reach it was.

So it is said once, at the first sign-off of the run, when the player has
just watched three pips become two and has a reason to want them explained.
Not read out in advance: this describes something that has already happened.

Counted in builds signed off, not in condition. A player who bought a coffee
on the way in starts the day at four, so a test against the starting value
would miss the first build and fire on the second.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 2: 보고 버튼 힌트를 살린다

**Files:**
- Modify: `src/office/Office.tsx` (빌드용 `<EngineStage>` 호출)

**Interfaces:**
- Consumes: `EngineStage`의 기존 `tutorial?: boolean` prop (`src/engine/EngineStage.tsx:48`)
- Produces: 없음 (마지막 작업)

- [ ] **Step 1: 지금 아무도 안 넘기는지 확인한다 (기준점)**

```bash
grep -rn "tutorial" src/ --include="*.tsx" | grep -v "src/engine/EngineStage.tsx"
```

Expected: 출력 없음. `EngineStage` 바깥에서 `tutorial`을 쓰는 곳이 하나도 없다는 뜻이고, 기본값이 `false`라 힌트가 뜬 적이 없다는 뜻이다.

- [ ] **Step 2: 빌드 스테이지에 넘긴다**

`src/office/Office.tsx`에서 이 호출을 찾는다 — `scenesById[running.sceneId]`를 쓰는 쪽이다(카드 빌드용 호출이 따로 있으니 혼동하지 말 것):

```tsx
    const scene = scenesById[running.sceneId];
    return (
      <EngineStage
        key={build.key}
        scene={scene}
        stageNo={day}
        title={build.title}
        canZoom={owned.includes("magnifier")}
        playtest={PLAYTEST}
```

`playtest={PLAYTEST}` 줄 **바로 아래**에 한 줄 넣는다:

```tsx
        tutorial={day === 1}
```

- [ ] **Step 3: 타입과 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 통과.

- [ ] **Step 4: 브라우저로 세 상태를 확인한다**

개발 서버를 띄운다(`.claude/launch.json`의 `find-bug-dev`).

**(a) 1일차에 힌트가 뜨는가.** 콘솔에서 이전 흔적을 지우고 사무실로 간다:

```javascript
localStorage.removeItem('fb_seen_tutorial');
location.href = 'http://localhost:5173/?day=1&place=office';
```

기기까지 걸어가 스페이스로 빌드를 연다. 브리핑의 `빌드 실행`을 누른 뒤:

```javascript
JSON.stringify({
  hint: document.querySelector('.tutorial-hint')?.textContent ?? null,
  seenFlag: localStorage.getItem('fb_seen_tutorial'),
})
```

Expected: `hint`에 `⬇ 확신이 들면 눌러라. 보고는 한 번뿐이다.`, `seenFlag`는 `null`.

**(b) 한 번 누르면 사라지는가.** 보고 버튼을 누른 뒤:

```javascript
JSON.stringify({
  hint: document.querySelector('.tutorial-hint')?.textContent ?? null,
  seenFlag: localStorage.getItem('fb_seen_tutorial'),
})
```

Expected: `hint`는 `null`, `seenFlag`는 `"1"`.

**(c) 2일차에는 안 뜨는가.**

```javascript
localStorage.removeItem('fb_seen_tutorial');
location.href = 'http://localhost:5173/?day=2&place=office';
```

빌드를 열고 `빌드 실행`을 누른 뒤 `document.querySelector('.tutorial-hint')`
Expected: `null`.

- [ ] **Step 5: Task 1의 노트도 실제로 뜨는지 같이 확인한다**

1일차 첫 빌드를 **끝까지 사인오프**한다(대상을 지목하고 분류를 골라 보고 제출).
결과 화면을 닫은 뒤:

```javascript
document.querySelector('.modal p')?.textContent
```

Expected: `빌드 하나를 봤고, 컨디션이 1 줄었다.`로 시작하는 두 줄.

이어서 두 번째 빌드를 사인오프한 뒤 같은 것을 확인한다.
Expected: 그 문구가 **다시 뜨지 않는다**.

- [ ] **Step 6: 전체 검사와 커밋**

Run: `npm run verify && npm run build`
Expected: FAIL 줄 없음, 빌드 성공.

```bash
git add src/office/Office.tsx
git commit -m "$(cat <<'EOF'
Turn on the hint that has never once been drawn

EngineStage has an arrow that points at the report button and says the
report is the only one you get. The markup is there, the once-only flag in
local storage is there, and no caller has ever passed the prop that shows
it, so the default of false has held since the day it was written. The same
shape as the four intro lines deleted this morning, except this one is worth
keeping: the game is about spending a single report well.

On day one only. After that the player has made the decision at least three
times and the arrow is furniture.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

## 확인이 끝난 뒤

배포는 사용자가 직접 한다. **이 프로젝트는 플랫폼이 git에서 빌드하므로 push만으로
반영된다** — 로컬 빌드나 CLI 배포는 필요 없다. 자세한 건 `docs/DEPLOY.md`.
