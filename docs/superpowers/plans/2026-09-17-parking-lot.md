# 주차장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4년차에 열리는 새 엔진 빌드 `stage10`(주차장)을 추가한다.

**Architecture:** 광산(`stage08`)과 같은 틀이다. 데이터 씬 하나를 만들고, 레지스트리의 연차 표에 등록하고, 결함 제외 목록·i18n·CSS를 더한다. 빌드 수가 10개가 되면서 트로피 선반과 직급의 마지막 단계도 맞춘다.

**Tech Stack:** TypeScript 데이터 씬, 기존 엔진 동작. 검사는 tsx 스크립트다.

## Global Constraints

- `develop`만 쓰고 커밋마다 푸시한다. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 붙인다.
- 새 아트는 그리지 않는다. i18n은 5개 언어 모두에 넣는다.
- 스펙: `docs/superpowers/specs/2026-09-17-parking-lot-design.md`

---

### Task 1: 검사 먼저
- [ ] `checkscenes.ts`에 스펙 5절의 stage10 블록을 추가한다.
- [ ] `checkyears.ts`에 "4년차에 주차장"을 추가한다.
- [ ] 9개 빌드를 전제로 한 검사를 10개로 바꾼다.
- [ ] 돌려서 실패하는지 확인한다.

### Task 2: 씬과 등록
- [ ] `src/stages/stage10/scene.ts`를 스펙 2절의 표대로 작성한다.
- [ ] `registry.ts`에 등록하고 `SCENE_YEAR.stage10 = 4`를 넣는다.
- [ ] `exclusions.ts`에 달리는 차의 이동 결함을 추가한다.
- [ ] i18n, CSS, 트로피, 직급 마지막 단계를 반영한다.
- [ ] `npm run verify && npm run lint`를 돌리고, `npm run report`로 결함 리뷰 문서를 갱신한다.

### Task 3: 브라우저 확인과 마무리
- [ ] `?debug`의 10번 탭에서 화면, 그림 좌표, 차단기, 차, 동전을 확인한다.
- [ ] 4년차 집의 트로피 선반 10칸을 확인한다.
- [ ] `docs/ASSETS.md`에 행을 추가하고 커밋·푸시한다.
