# 집의 트로피 선반 — 설계

날짜: 2026-09-17
선행: `2026-09-17-codex-mastery-design.md` (숙련 빌드)

## 1. 목적

숙련 빌드는 검사할 때 기운이 들지 않는다는 혜택만 있고, 눈에 남는 것이 없다. 플레이어가 매일 아침과 밤에 머무는 집 벽에 숙련 트로피를 걸어, 모은 것과 남은 것이 한눈에 보이게 한다.

원칙:
- 보상은 장식뿐이다. 밸런스, 저장, 서버는 바꾸지 않는다.
- 트로피는 확정 보상이다. 랜덤 요소는 없다.
- 새 아트를 그리지 않는다. 각 빌드 씬에 이미 있는 그림을 쓴다. 카드는 이미 번들에 있는 카드 이미지를 prop으로 등록한다.

## 2. 선반

- 집 벽(`home-wall`, 높이 96)의 창문(x 148–208) 양옆에 판자 두 개를 건다.
  - 왼쪽 판자: x 16–140, 5칸
  - 오른쪽 판자: x 216–344, 4칸
  - 칸 간격 24px, 트로피의 발밑 y = 70, 판자 윗면도 y = 70
- 칸 순서는 연차 순이다. 1년차 빌드 7개(`YEAR_ONE_BUILDS` 순서), 광산, 주방.
- **아직 열리지 않은 빌드**(이번 연차의 `buildIdsFor(year)`에 없는 것)는 칸을 비워 둔다. 트로피도 실루엣도 그리지 않는다.
- **열린 빌드 중 숙련하지 않은 것**은 회색 반투명 실루엣(`trophy-locked` 클래스)으로 그린다.
- **숙련한 빌드**는 원래 색(`trophy` 클래스)으로 그린다.
- 왼쪽 판자는 station이다(`labelKey: "home.trophies"`, 반경 90. 판자의 기준점이 왼쪽 끝이라 넉넉히 잡는다). 플레이어가 벽 아래(y ≥ 122)에 서면 닿는다. 누르면 문구를 띄운다.
  - 숙련 0개: "아직 선반이 비어 있다. 빌드의 결함을 전부 잡으면 하나씩 올라간다."
  - 1개 이상: "숙련 빌드 K/M: 슬라임 사냥터, 광산 보물굴"

## 3. 트로피 그림

| 빌드 | 그림 |
|---|---|
| stage01 슬라임 사냥터 | platchars (2,1) 슬라임 |
| stage02 마법 상점 | roguelike (54,12) 물약 |
| stage03 점프 던전 | platchars (7,2) 박쥐 |
| stage05 숲 채집 | critter (0,0) |
| stage06 사격장 | platchars (0,0) 과녁 캐릭터 |
| stage07 자판기 | platformer (11,7) 동전 |
| stage04 카드의 방 | prop `card` (`cards/card_hearts_A.png`, 32×32) |
| stage08 광산 보물굴 | dungeon (11,10) 곡괭이 |
| stage09 주방 | roguelike (55,13) 빵 |

크기는 한 변이 약 24px가 되도록 맞춘다. 16px 시트는 scale 1.5, 18px는 1.35, 24px는 1, 32px prop은 0.75다. 자판기의 동전 칸 좌표는 구현할 때 확대해서 확인한다.

## 4. 구조

- `src/home/trophies.ts` (새 파일)
  - `TROPHY_ORDER: readonly string[]`: 9개 빌드 id, 칸 순서
  - `TROPHY_ART: Record<string, RenderSpec>`
  - `trophySlots(): { sceneId, x }[]`: 칸 위치
  - `withTrophies(scene, mastered, open): SceneSpec`: 판자 2개와 열린 빌드의 트로피를 `objects`에 더한다. 트로피는 `kind: "sprite"`(카드는 prop), 행동 없음. 판자는 `kind: "decor"`와 `bar`.
  - `trophyLine(mastered, open, t, tp): string`: station 문구
- `src/engine/props.ts`, `src/engine/spriteStyle.ts`: `card` prop 등록
- `src/office/Office.tsx`
  - `homeHere`에서 `withTrophies(..., mastered, builds)`를 적용한다. 의존성에 `mastered`, `builds`를 더한다.
  - `onStation`에 `"trophyShelf"`를 추가하고 `trophyLine` 문구를 띄운다.
- `src/App.css`: `.trophy-shelf`(판자), `.trophy-locked`(`filter: grayscale(1) brightness(0.35); opacity: 0.55`)
- i18n 5개 언어: `home.trophies`, `object.trophyShelf`, `object.trophy`, `home.trophiesEmpty`, `home.trophiesLine`

## 5. 검사 — `scripts/checktrophies.ts` (`npm run verify`에 추가)

- `TROPHY_ORDER`는 `buildIdsFor(99)`와 같은 집합이고, 빌드마다 그림이 있다.
- 칸은 9개이고, 서로 겹치지 않으며, 창문(x 148–208)과도 겹치지 않고, 벽 안(0–360)에 있다.
- 1년차에 숙련 0개면 트로피 7개가 모두 `trophy-locked`이고, 광산·주방 트로피는 없다.
- 숙련한 빌드의 트로피만 `trophy-locked`가 아니다.
- 3년차면 9개가 모두 있다.
- 추가된 물건의 id가 집 씬의 기존 id와 겹치지 않는다.
- 추가된 물건 중 station은 판자 하나뿐이다.
- `trophyLine`은 숙련 0개일 때와 1개 이상일 때 맞는 문구를 쓴다.
- 소스 검사: Office의 `homeHere`가 `withTrophies`를 쓰고, `onStation`이 `trophyShelf`를 처리한다.

## 6. 범위 밖

- 트로피를 누르면 빌드별 설명을 보여주는 것
- 직급 칭호
- 트로피 획득 연출
