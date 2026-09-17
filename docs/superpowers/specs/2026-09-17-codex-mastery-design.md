# 수첩 완성과 숙련 빌드 — 설계

날짜: 2026-09-17
선행: `2026-09-15-years-and-new-builds-design.md` (연차, 새 씬, 시작 선물)

## 1. 목적

4년차부터는 새로 열리는 것이 없다. 연차 숫자와 시작 선물만 남는다. 이 설계는 이미 있는 결함 수첩을 **완성 목표**로 바꿔 계속 플레이할 이유를 만든다.

원칙:
- 보상은 모두 **확정**이다. 뽑기, 강화, 합성 같은 확률형 요소는 넣지 않는다.
- 새 아트가 필요 없다.
- 서버는 회차 세이브 필드 하나(`masteredAtStart`)만 늘린다. 수첩 동기화(`syncBook`)가 이미 있어서 숙련 상태는 따로 올리지 않는다.

## 2. 숙련 빌드

- 한 빌드에서 심어질 수 있는 결함을 **모두 잡으면**(수첩 상태 `caught`) 그 빌드는 **숙련**된다.
  - 판정에는 수첩 기록을 쓴다. 이 기기 기록과 계정 기록을 합친 것이다.
  - 대상 결함은 `codexRows`가 그 빌드에 대해 내놓는 행 전체다. 엔진 빌드는 `generateMutations`의 결과이고, 제외 목록이 이미 반영돼 있다. 카드 빌드(stage04)는 `stage04.bugPool`이다.
  - 아직 열리지 않은 빌드(`SCENE_YEAR` 기준 해당 연차 전)는 숙련 대상이 아니다. 목록에도 넣지 않는다.
- **혜택:** 숙련 빌드는 검사해도 기운(`INSPECT_COST`)이 줄지 않는다.
  - 기운이 `INSPECT_COST`보다 적어도 숙련 빌드는 열 수 있다. 하루에 검사할 수 있는 양은 시간이 정한다.
  - 숙련 여부는 **검사 화면을 여는 순간** 정해서 그 검사에 붙여 둔다. 마지막 결함을 잡은 그 검사는 기운이 그대로 줄고, 다음 검사부터 공짜다.
  - 이 값은 Office의 화면 상태 `runningFree`에 둔다. `running`은 세이브되는 `Assignment`라서 필드를 붙이지 않는다. 검사 화면은 세이브되지 않는다(`RunFields` 주석 참고).
- 초기화하면 수첩이 비고, 숙련도 함께 사라진다. 따로 지울 저장소가 없다.

## 3. 못 잡은 결함부터 배정

- 기기에서 검사 화면을 처음 열 때 결함을 고르는 곳은 두 군데다. `EngineStage`의 `pickMutation`과 `Stage04`의 `pickBug`.
- 두 곳 모두 새 prop `prefer?: readonly string[]`(결함 id 목록)을 받는다.
  - `prefer`와 겹치는 후보가 있으면 그 안에서 무작위로 고른다.
  - 겹치는 후보가 없거나 `prefer`가 비어 있으면 지금처럼 전체에서 고른다.
- 오피스는 빌드마다 `prefer`에 **`caught`가 아닌 결함 id**(`unseen`과 `missed`)를 넘긴다. 숙련 빌드는 이 목록이 비어 있으니 자연스럽게 전체에서 고르게 된다.
- 연차와 상관없이 1년차부터 적용한다.
- 이미 결함이 정해진 기기(`bugId`가 있음)는 바뀌지 않는다. 다시 뽑기(`excludeId`)도 `prefer`를 먼저 따르고, 직전 결함은 뺀다.
- 오피스 밖 화면(`?debug`, 연습 화면)은 `prefer`를 넘기지 않으므로 동작이 그대로다.

## 4. 화면

- **HUD 기기 칩:** 숙련 빌드 칩에 `mastered` 클래스와 작은 도장(★)을 붙인다. 칩을 누르면 나오는 설명에 "숙련 — 기운이 들지 않는다"를 덧붙인다.
- **수첩:** 빌드 제목 줄의 `x/N` 옆에 숙련 도장을 단다. 수첩 맨 위 집계 아래에 "숙련 빌드 K/M"을 넣는다. M은 이번 연차에 열린 빌드 수다.
- **아침 문구 (4년차부터 첫 아침):** 지금 문구("N년차. 다시 12일이다.") 뒤에 "숙련 빌드 K/M." 한 줄을 붙인다.
- **출시 화면:**
  - 이번 회차에 새로 숙련된 빌드가 있으면 "새로 숙련: 박쥐 동굴, 광산 보물굴" 한 줄을 띄운다.
  - 열린 빌드를 모두 숙련했고 모든 빌드가 열려 있다면(9/9) 완주 문구를 한 줄 띄운다.
  - "새로 숙련"을 계산하려면 회차 시작 때 숙련 목록이 필요하다. 회차 세이브에 `masteredAtStart: string[]`을 넣는다. `codexAtStart`처럼 회차 시작 때 한 번 정하는 값이다. 없으면(예전 세이브) `codexAtStart`와 같이 불러오는 시점에 계산한다.
- 문구는 i18n 5개 언어 모두에 넣는다.

## 5. 구조

- `src/office/mastery.ts` (새 파일, 저장소 없음)
  - `buildProgress(rows: CodexRow[]): Map<sceneId, { caught, total }>`
  - `masteredBuilds(rows): string[]`: `total > 0 && caught === total`인 빌드
  - `preferFor(rows, sceneId): string[]`: 그 빌드에서 `caught`가 아닌 결함 id
  - `rows`는 `codexRows(book, year)`로 만들기 때문에 연차 제한이 그대로 따라온다.
- `src/engine/generate.ts`: `pickMutation(mutations, excludeId?, prefer?)`
- `src/core/judge.ts`: `pickBug(pool, excludeId?, prefer?)`
- `src/engine/EngineStage.tsx`, `src/stages/stage04/Stage04.tsx`: `prefer` prop을 받아 위 두 함수에 넘긴다.
- `src/office/Office.tsx`
  - 검사 화면을 열 때(`setRunning`) 그 빌드가 숙련인지를 `runningFree`에 기록한다.
  - `tooTired` 검사와 기운 차감은 `runningFree`면 건너뛴다.
  - 수첩 행은 `useMemo`로 한 번 계산해서 칩, 배정, 숙련 판정에 같이 쓴다. 시계가 돌 때마다 150개 결함을 다시 만들지 않기 위해서다.
  - 빌드 컴포넌트에 `prefer`를 넘긴다.
  - HUD 칩, 수첩, 아침 문구, 출시 화면을 고친다.
- `src/office/run.ts`: `masteredAtStart` 필드와 검증을 추가한다.
- `server.js`: `RUN_FIELDS`에 `masteredAtStart: ["scenes"]`를 넣는다. 새 규칙 `scenes`는 빌드 id 목록이다(`stage` 뒤 숫자 두 자리, 길이는 다른 목록과 같은 `RUN_LIST` 제한).

## 6. 검사

`scripts/checkmastery.ts`를 새로 만들고 `npm run verify`에 넣는다.
- 빈 수첩에서는 숙련 빌드가 0개다. 한 빌드의 결함을 전부 `caught`로 채우면 그 빌드만 숙련된다. `missed`가 하나라도 있으면 숙련이 아니다.
- 1년차 행으로 계산하면 광산과 주방이 목록에 없다.
- `preferFor`는 `caught`를 빼고 돌려주고, 숙련 빌드에 대해서는 빈 목록을 돌려준다.
- `pickMutation`과 `pickBug`는 `prefer`가 있으면 그 안에서만 고른다(여러 번 뽑아서 확인). `prefer`가 비었거나 겹치는 게 없으면 전체에서 고른다. `excludeId`와 함께 줘도 직전 결함은 나오지 않는다.
- 모든 빌드에서 `codexRows`의 결함 id와 오피스가 실제로 배정할 수 있는 결함 id가 **같다**. 달라지면 영영 숙련할 수 없는 빌드가 생긴다.
- 소스 검사: Office가 `runningFree`일 때 기운 차감과 `tooTired`를 건너뛰고, 빌드 컴포넌트 두 곳 모두에 `prefer`를 넘긴다.
- `checkrun`의 `FULL`에 `masteredAtStart`를 추가한다.

## 7. 범위 밖

- 칭호, 트로피 같은 장식 보상
- 숙련 빌드의 보수 인상이나 힌트
- 새 씬 추가 (반응을 보고 따로 설계)
