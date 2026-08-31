# 사용 에셋 정리

모든 에셋 **CC0 (Creative Commons Zero)** — 저작자 표시 의무 없음, 상업적 이용·수정·재배포 자유.
법적으로 크레딧이 필요하진 않지만 관례상 아래에 출처를 남긴다.

## 출처

| 팩 | 제작자 | 라이선스 | 원본 링크 |
|---|---|---|---|
| Tiny Town | Kenney | CC0 1.0 | https://kenney.nl/assets/tiny-town |
| Pixel Platformer | Kenney | CC0 1.0 | https://kenney.nl/assets/pixel-platformer |
| Roguelike/RPG Pack | Kenney | CC0 1.0 | https://kenney.nl/assets/roguelike-rpg-pack |
| Generic Items | Kenney | CC0 1.0 | https://kenney.nl/assets/generic-items |
| UI Pack | Kenney | CC0 1.0 | https://kenney.nl/assets/ui-pack |
| Playing Cards Pack | Kenney | CC0 1.0 | https://kenney.nl/assets/playing-cards-pack |

라이선스 전문: https://creativecommons.org/publicdomain/zero/1.0/

## 저장소에 포함한 파일

`public/assets/` — 원본 zip에서 필요한 시트만 추린 것.

| 파일 | 출처 팩 | 크기 | 타일 | 용도 |
|---|---|---|---|---|
| `tinytown.png` | Tiny Town | 192×176 | 16px, 12×11 | 야외 지형·나무·우물·표지판·버섯 |
| `platformer.png` | Pixel Platformer | 360×162 | 18px, 20×9 | 발판·가시·레버·하트·열쇠·보석 |
| `platchars.png` | Pixel Platformer | 216×72 | 18px, 12×4 | 캐릭터·슬라임·박쥐 |
| `roguelike.png` | Roguelike/RPG Pack | 968×526 | 16px(+1 여백), 57×31 | 실내 소품·가구·시계·책·모닥불 |
| `grass.png` | Tiny Town | 16×16 | — | 잔디 배경 타일 |

시트 좌표 정의는 [src/engine/sheets.ts](../src/engine/sheets.ts)에 있다.

## 적용 현황

| 스테이지 | 상태 |
|---|---|
| 1 슬라임 사냥터 | **적용 완료** |
| 2 마법 상점 | **적용 완료** |
| 3 점프 던전 | **적용 완료** |
| 4 카드의 방 | 미적용 (수기 컴포넌트, Playing Cards 팩 대기) |
| 5 밤샘 연구실 | **적용 완료** |
| 6 지하 기계실 | **적용 완료** |

### 1탄 오브젝트별 매핑

| 오브젝트 | 시트 | 좌표 (col,row) | 배율 |
|---|---|---|---|
| 플레이어 | platchars | 0,1 | 2.4 |
| 슬라임 A/B/C | platchars | 0,0 | 2.1 |
| 나무 (좌/우) | tinytown | 5,0 | 3 |
| 우물 | tinytown | 9,4 | 3 |
| 표지판 | tinytown | 11,6 | 2.6 |
| 버섯(회복 아이템) | tinytown | 5,2 | 2.4 |
| 잔디 배경 | grass.png | — | 3배 반복 |
| 해 · 구름 | CSS 도형 | — | — |

해와 구름은 픽셀 팩에 대응물이 없어 CSS로 그린다. 이모지와 픽셀 스프라이트를 섞으면 스타일이 깨져서 이모지는 쓰지 않는다.

## 다음 단계에서 쓸 좌표 (확인 완료)

| 대상 | 시트 | 좌표 |
|---|---|---|
| 박쥐 (3탄) | platchars | 8,3 |
| 하트 (가득/절반/빈) | platformer | 4,2 / 5,2 / 6,2 |
| 가시 | platformer | 8,3 |
| 레버 | platformer | 4,3 · 5,3 · 6,3 |
| 열쇠 | platformer | 7,1 |
| 보석 | platformer | 7,3 |
| 숫자 폰트 0–9 | platformer | 0,8 – 9,8 |
| 벽시계 | roguelike | 26,8 |
| 모닥불 | roguelike | 54,6 – 54,10 |
| 액자 | roguelike | 29,10 · 30,10 · 31,10 |
| 책 | roguelike | 49,15 – 51,15 |
| 두루마리 | roguelike | 44,15 |
| 금화 | roguelike | 45,10 · 45,11 |

## 주의사항

- **그림자는 에셋에 없다.** 픽셀 팩 스프라이트에는 그림자가 포함돼 있지 않아, 게임이 CSS 타원으로 직접 그린다. `mirrorShadow`(그림자 방향) 버그는 이 CSS 그림자에 의존하므로, 씬에 광원(`light`)이 선언돼 있어야만 생성된다.
- **난이도 점수는 스프라이트 크기를 읽는다.** [score.ts](../src/engine/score.ts)의 `displaySize()`가 시트 타일 크기 × 배율로 화면 크기를 계산한다. 배율을 바꾸면 난이도 밴드가 움직이므로 `npm run verify`로 확인할 것.
- **시각 판정 플래그 재확인 필요.** `orientable`(상하 반전이 보이는가) / `directional`(좌우 반전이 보이는가)은 이모지 기준으로 붙여둔 값이다. 스프라이트로 교체한 오브젝트는 다시 판단해야 한다.
- **에셋 교체 후에는 반드시 `npx tsx scripts/audit.ts`로 버그 풀을 확인할 것.** 이모지를 전제로 짠 판정 조건이 스프라이트에서 조용히 실패한 사례가 두 번 있었다 (난이도 공식의 `fontSize`, 색상 변형의 `emoji` 조건).

## Kenney — Tiny Dungeon (CC0)

https://kenney.nl/assets/tiny-dungeon

`src/assets/sheets/dungeon.png` is the pack's `Tilemap/tilemap_packed.png`.
192x176 — a 12x11 grid of 16px tiles, identical geometry to Tiny Town and
drawn with the same outline weight, so the two can share a scene. Carries the
walls, floors, doors, crates, shelves and 16px people the office needs.

## Rejected: Kenney — Toon Characters

Downloaded and not used. The sheet is 864x640, roughly 96x128 per frame, and
the art is smooth vector rather than pixel. Dropping it beside 16px tiles
would repeat the mismatch that made stage 1's Tiny Town trees read as holes in
the field, only far worse. People stay on `platchars` (24px), and the office
can use Tiny Dungeon's own 16px characters where the scale has to match props.

## Puny Characters (CC0)

https://merchant-shade.itch.io/16x16-puny-characters

`src/assets/sheets/worker.png` and `worker2.png` are Human-Worker-Cyan and
Human-Worker-Red. 32px frames on a 24x8 grid: rows are the eight facings
counter-clockwise from down, so rows 0/2/4/6 are down/right/up/left. Column 0
is idle and 1-4 are the walk cycle.

## Fantasy Interior Tiles (CC0)

https://cardinalzebra.itch.io/fantasy-interior-tiles

By Rostislav Gnatovsky. Credits are not required but are given here anyway.
The pack ships loose PNGs at their own sizes rather than a grid, which is why
`props.ts` exists beside `sheets.ts`. Only the office uses these.

## Why the office and the builds look different

The office is drawn from Puny and Fantasy Interior (32px, thin outlines); the
builds under test stay on Kenney (16px, heavy outlines). Mixing those two
within one screen is what made stage 1 trees read as holes, but the office and
a build never share a screen — and the player is meant to be looking at
somebody else's game when a build is running.

## Messy Furniture (free, not CC0)

https://0-mem0ry.itch.io/messy-furniture-set-free

`src/assets/sheets/furniture.png` is the pack's 32x32 sheet, 13x14 cells.
Pieces span more than one cell — a bed is one column by two rows, a sofa two
by two — so they are drawn through spanX/spanY rather than as single tiles.
Only the home uses it, for the bed and the sofa, which no CC0 pack we could
find had at this scale and view.

Licence: free forever, commercial and non-commercial use allowed, may be
modified. May NOT be resold or redistributed, and may not be used to train AI
models.

Decided: the repository is private, so keeping the raw sheet in it is not
redistribution and the pack ships with the game as normal use. If this
repository is ever made public, that decision has to be revisited — either
keep the sheet out of source control and inject it at build time, or go back
to drawing the bed and sofa in CSS.
