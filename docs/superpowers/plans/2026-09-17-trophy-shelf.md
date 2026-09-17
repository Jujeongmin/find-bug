# 트로피 선반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 숙련한 빌드마다 집 벽 선반에 트로피를 하나씩 건다.

**Architecture:** `src/home/trophies.ts`의 순수 함수가 집 씬에 판자와 트로피 물건을 더한다. Office는 `homeHere`에서 이미 계산해 둔 `mastered`와 `builds`를 넘기기만 한다. 저장과 서버는 바뀌지 않는다.

**Tech Stack:** React 18, TypeScript, Vite. 검사는 `scripts/*.ts`를 tsx로 돌린다.

## Global Constraints

- `develop`만 쓰고, 커밋마다 푸시한다. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 붙인다.
- 확률형 요소는 없다. 밸런스, 저장, 서버는 바꾸지 않는다.
- 타입 검사는 `npx tsc -b`. i18n은 5개 언어 모두에 넣는다.
- 스펙: `docs/superpowers/specs/2026-09-17-trophy-shelf-design.md`

---

### Task 1: 트로피 모듈과 검사

**Files:**
- Create: `src/home/trophies.ts`, `scripts/checktrophies.ts`
- Modify: `src/engine/props.ts`, `src/engine/spriteStyle.ts` (`card` prop), `package.json` (verify)

**Interfaces:**
- Produces:
  - `TROPHY_ORDER: readonly string[]`
  - `TROPHY_ART: Record<string, RenderSpec>`
  - `trophySlots(): { sceneId: string; x: number }[]`
  - `withTrophies(scene: SceneSpec, mastered: readonly string[], open: readonly string[]): SceneSpec`
  - `trophyLine(mastered, open, t, tp): string`, `t: (k: string) => string`, `tp: (k: string, p: Record<string, string>) => string`
  - 상수 `SHELF_ID = "trophyShelf"`

- [ ] **Step 1:** `scripts/checktrophies.ts`에 스펙 5절의 항목을 모두 검사로 작성한다(소스 검사 두 줄은 Task 2에서 통과).
- [ ] **Step 2:** `npx tsx scripts/checktrophies.ts` → 모듈이 없어서 실패하는지 확인한다.
- [ ] **Step 3:** `card` prop을 등록한다(`PROPS.card = { w: 32, h: 32 }`, `PROP_SRC.card`는 `../assets/cards/card_hearts_A.png`).
- [ ] **Step 4:** `src/home/trophies.ts`를 스펙 2·3·4절대로 작성한다.
- [ ] **Step 5:** `npx tsc -b && npx tsx scripts/checktrophies.ts`를 돌려 소스 검사 두 줄만 FAIL인지 확인한다.
- [ ] **Step 6:** Task 2와 함께 커밋한다. 소스 검사가 Task 2에 걸려 있어서다.

### Task 2: Office 연결, 문구, 스타일, 브라우저 확인

**Files:**
- Modify: `src/office/Office.tsx` (`homeHere`, `onStation`), `src/App.css`, `src/i18n/*.json`

- [ ] **Step 1:** `homeHere`의 두 반환값을 `withTrophies(..., mastered, builds)`로 감싸고, 의존성에 `mastered`와 `builds`를 더한다.
- [ ] **Step 2:** `onStation`의 `journal` 분기 앞에 `SHELF_ID` 분기를 넣는다. `sfx.play("click")`을 울리고 `setNote(trophyLine(mastered, builds, t, tp))`를 띄운다.
- [ ] **Step 3:** CSS(`.trophy-shelf`, `.trophy-locked`)와 i18n 키 5개를 넣는다.
- [ ] **Step 4:** `npm run verify && npm run lint`를 돌려 모두 통과하는지 확인한다.
- [ ] **Step 5:** 브라우저에서 확인한다.
  - 수첩이 빈 상태: 실루엣 7개와 "비어 있다" 문구
  - stage01을 숙련한 상태: 슬라임만 또렷하고, 문구가 "숙련 빌드 1/7: 슬라임 사냥터"
  - 3년차 세이브: 9칸 모두 있음
  - 자판기 동전 칸이 실제로 동전인지 확대해서 확인한다.
- [ ] **Step 6:** 커밋하고 푸시한다.
