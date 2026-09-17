# 4년차 빌드: 주차장 — 설계

날짜: 2026-09-17
선행: `2026-09-15-years-and-new-builds-design.md`, `2026-09-17-codex-mastery-design.md`

## 1. 목적

4년차에 새로 열리는 빌드. 광산·주방과 같은 방식으로 기존 시트 그림과 기존 엔진 동작만 쓴다.

## 2. 장면 `stage10` (위에서 본 시점, 폭 360)

| 물건 | id | 위치 | 그림 | 동작 |
|---|---|---|---|---|
| 출구 차단기 2 | `barrierA`, `barrierB` | x 110 / 250, y 176 | city (24,5) scale 2.6 | 연결 대상. `triggered`면 위로 올라감(`s10-barrier`) |
| 정산기 2 | `payA`, `payB` | x 110 / 250, y 236 | city (27,7) scale 2.4 | 클릭하면 같은 줄의 차단기 trigger(`links`, 2.5초) |
| 가로등 2 | `lampL`, `lampR` | x 30 / 330, y 220 | city (5,16) spanY 2 scale 2 | glow |
| 달리는 차 2 | `car1`, `car2` | x 40 / 320 | city (33,22) spanX 2 spanY 2 scale 1.8 | patrol y 290–590 speed 70, damage hp 1 (반경 28) |
| 주차된 차 3 | `parked1`–`parked3` | x 115 / 180 / 245, y 500 | city (31,18)/(31,22)/(31,26) spanX 2 spanY 2 scale 1.8 | blocker 반경 24 |
| 동전 3 | `coin1`–`coin3` | (180,340), (120,600), (240,600) | platformer (11,7) scale 1.6 | pickup 반경 26, respawn 6, coins +1 |
| 플레이어 | `player` | (180, 300) | 광산과 같음 | playerTopDown minY 262 maxY 610 |

- 카운터: `hp`(하트 3), `coins`(숫자). HUD `hpBar`, `coinHud`.
- `car1`은 y 290, `car2`는 y 590에서 출발한다. 두 차의 행동은 같다(`peerGroup: "car"`).
- 주차된 차 3대는 `peerGroup: "parked"`, 차단기 `barrier`, 정산기 `pay`, 가로등 `lamp`, 동전 `coin`.
- 배경 `s10-lot`: 위쪽(0–150) 부스 벽, 아래는 아스팔트. 주차칸 흰 선은 CSS로 그린다.

## 3. 결함

- 생성기가 만드는 결함을 그대로 쓰되, **달리는 차의 이동 결함**(`teleportOnEnd`, `bounceOnEnd`, `speedScale`, `freezeAnimation` 중 `car1`/`car2` 대상)은 `exclusions.ts`에서 뺀다. 광석 통과 같은 이유다.
- 빌드 결함 수가 `MIN_POOL`(3) 이상이어야 한다.

## 4. 함께 바뀌는 것

- `SCENE_YEAR`에 `stage10: 4`를 추가하고 `ENGINE_SCENES`에 등록한다.
- 트로피: `TROPHY_ART.stage10 = city (33,22) spanX 2 spanY 2 scale 0.75`. 오른쪽 판자는 5칸, 너비 124.
- 직급: 마지막 단계(QA 팀장)는 "모든 빌드 숙련"으로 바꾼다. `RANK_STEPS`의 마지막 값을 `buildIdsFor(MAX).length`(10)로 계산한다.
- 검사 중 빌드 9개를 전제로 한 곳은 10개로 고친다(`checkmastery`, `checktrophies`, `checkrank`).
- i18n 5개 언어: `stage.stage10.name`("주차장"), `intro.stage10.line`, `goal.stage10`, 물건 이름, `counter.coins`, `object.coinHud`.
- CSS `.s10-*`, `docs/ASSETS.md` 행 추가, `npm run report`로 결함 리뷰 문서 갱신.

## 5. 검사 (`scripts/checkscenes.ts`에 stage10 블록)

- 정산기 A를 누르면 차단기 A만 올라가고, 3초 뒤 내려온다.
- `wiringSwap:payA:payB`가 있으면 A가 B를 올리고, `noAction:payB`면 아무것도 올리지 않는다.
- 동전을 밟으면 coins 1이 되고, 6초 뒤 다시 생긴다.
- 달리는 차에 닿으면 hp가 2가 된다. 차는 290–590 안에서만 움직이고, 두 차의 행동은 같다.
- 주차된 차는 플레이어를 막는다(차 중심으로 걸어가도 반경 밖에 머문다).
- 달리는 차의 이동을 바꾸는 결함은 없다.
- `checkyears`: 4년차에 stage10이 나오고 3년차에는 나오지 않는다.
