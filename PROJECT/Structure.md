# Structure — find-the-bug

## Entry

| 파일 | 하는 일 |
|---|---|
| `src/main.tsx` | `GameServerProvider`로 `App`을 감싸 `#root`에 마운트 |
| `src/App.tsx` | 아트 프리로드 → 로딩 화면 → `Office`. `?debug` `?lab` `?repro`면 개발용 화면으로 갈라진다 |
| `src/dev.ts` | `DEV_TOOLS` 플래그와 `devParam` / `devFlag`. 개발용 주소는 전부 여기를 통한다 |

## `src/office/` — 하루

`Office.tsx`가 게임 그 자체다. 12일, 09:00–18:00, 실제 1초에 게임 2.3분.

| 파일 | 하는 일 |
|---|---|
| `Office.tsx` | 하루 루프 · 큐 · 시계 · 컨디션 · 돈 · 상점 · 광고 제안 |
| `scene.ts` | 사무실 씬과 기기(`MACHINES`) 배치 |
| `codex.ts` | 결함 수첩. localStorage가 원본, 회차를 넘어 남는 유일한 것 |
| `events.ts` | 정해진 날의 사건 (5일 핫픽스, 9일 회식) |
| `rating.ts` | 출시 평점. `totalStake`가 놓친 것의 무게를 매긴다 |
| `devlines.ts` | 옆자리 개발자가 상황에 따라 하는 말 |

## `src/street/`, `src/home/` — 하루의 나머지

`scene.ts`(출근길) · `lane.ts`(퇴근길) · `passers.ts`(행인) · `pocha.ts`(포장마차) ·
`build.ts`(건물 파츠), 그리고 `home/scene.ts`(집).

## `src/engine/` — 씬 엔진

버그는 **쓰는 게 아니라 만들어진다.**

| 파일 | 하는 일 |
|---|---|
| `types.ts` | `SceneSpec` / `ObjectSpec` / `ActorSpec` — 씬을 서술하는 데이터 모델 |
| `runtime.ts` | 매 프레임 물리·이동·애니메이션. `ObjectState`가 한 물체의 전부 |
| `mutators.ts` | 19가지 결함 종류. 무엇을 바꾸고 무엇을 받는지 선언한다 |
| `generate.ts` | 씬 × mutator 교차로 결함 풀을 만든다 |
| `score.ts` | 각 결함을 난이도로 채점하고 밴드 1–4로 나눈다 |
| `curriculum.ts` | 밴드에서 30개 스테이지 슬롯을 배분. `MIN_POOL` 미만이면 `verify`가 실패 |
| `exclusions.ts` | 손으로 결함을 빼는 **유일한** 자리 |
| `EngineStage.tsx` | 씬 하나를 그리고 조작하고 판정까지 붙이는 컴포넌트 |
| `sheets.ts` `props.ts` `spriteStyle.ts` | 스프라이트 시트 · 소품 · 그리기 |

## `src/stages/`

`registry.ts`가 엔진이 도는 씬 6개(`stage01~03`, `05~07`)를 모은다.
`stage04`는 **문서화된 예외** — 카드 맞추기, 자체 컴포넌트와 손으로 쓴 결함 풀.

## `src/core/`

`judge.ts` — 지목한 물체와 고른 분류가 **둘 다** 맞아야 정답. 어느 쪽이 틀렸는지는
UI로 새지 않는다. `types.ts`는 `BugDef` / `Verdict`.

## `src/net/`

`save.ts` — 계정 쪽 수첩. 전부 병합이고 전부 실패해도 된다.
`ads.ts` — 보상형 광고 이음매. SDK가 없으면 `available()`이 false.

## `src/i18n/`

`index.ts` + 5개 사전. **한 언어만 가져온다** — 영어는 항상 있고 나머지는 고를 때
`loadLang()`으로 온다. 스크립트에서 `translate("ko", …)`를 쓰려면 먼저 await 해야 한다.

## `src/debug/`, `src/repro/`, `src/regression/`

개발용 화면 셋. `App.tsx`에서 지연 로딩되고 `DEV_TOOLS`가 꺼지면 열리지 않는다.
`DebugLab`은 빌드 7개·결함 118개 목록, `ReproLab`과 `Workbench`는 접어둔 시제품.

## `scripts/`

`check*.ts`가 `npm run verify`의 회귀 테스트다 (커리큘럼 · 씬 · 런타임 · i18n ·
퀘스트 · 카테고리). `report.ts` + `report-html.ts`가 `docs/bug-review.*`를 만들고,
`spritesheet.ts` / `spritelist.ts` / `recolor.ts` / `officeart.ts`가 아트를 굽는다.

## 스타일

`index.css`(전역) · `App.css`(프레임) · `styles/shared.css` · `engine/engine.css` ·
`stages/stage04/stage04.css`. Tailwind는 쓰지 않는다.
