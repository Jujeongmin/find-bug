# 광산·주방 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2년차에 열리는 광산(`stage08`)과 3년차에 열리는 주방(`stage09`)을 빌드 로테이션에 넣는다.

**Architecture:** 두 씬 모두 엔진 코드 없이 기존 행동으로만 만든다. 광산은 `links`+`trigger`(레버→철창), `patrol`, `pickup`, `damage`, `glow`를 쓴다. 주방은 `toggle`→`pressure`→`meter`(손잡이→온도계), `flagged`(불꽃·냄비), `pickup`, actor `patrol`을 쓴다. 등록은 `ENGINE_SCENES`와 뼈대 계획에서 만든 `SCENE_YEAR`에 한 줄씩 넣는다.

**Tech Stack:** React 18, TypeScript, Vite, tsx 검사 스크립트 (테스트 프레임워크 없음)

**Spec:** `docs/superpowers/specs/2026-09-15-years-and-new-builds-design.md` 섹션 4. **스펙의 좌표표 일부는 틀렸다** — 이 계획의 좌표가 실제 그림을 격자로 확대해 확인한 값이고, Task 5에서 스펙을 고친다.

## Global Constraints

- 브랜치는 `develop`만 쓴다. 모든 태스크는 커밋 **그리고** `git push origin develop`으로 끝난다
- 플랫폼은 푸시하면 빌드한다. **푸시하는 모든 커밋은 그대로 배포돼도 되는 상태여야 한다** — 씬 데이터·번역·CSS·제외 목록은 같은 커밋에 들어간다
- 타입 검사는 `npx tsc -b`다. `npx tsc --noEmit`은 이 저장소에서 아무것도 검사하지 않는다
- i18n은 `en.json`이 기준이다. 새 키는 다섯 언어(en, ko, ja, zh-Hans, zh-Hant)에 모두 넣는다. 다섯 파일은 `JSON.stringify(dict, null, 2) + "\n"`로 다시 써도 바이트가 같다(2026-09-15 확인). 그래서 키를 붙여 다시 쓰는 방식이 안전하다
- 번역어: 빌드 = ko `빌드`, ja `ビルド`, zh `版本`
- 씬 id는 서버 수첩 정규식 `^stage\d{2}` 형식이어야 한다
- 짝(`peerGroup`) 오브젝트는 **같은 그림, 같은 속도, 같은 범위**로 둔다. 시작 위치만 다르게 한다. 박쥐 둘의 속도가 달라서 "하나가 빠르다"는 신고가 무조건 오답이 됐던 전례가 있다
- 작은 줍기 아이템에는 그림자(`render.shadow`)를 달지 않는다. `floating` 결함이 생기는데, 이전 스테이지에서 전부 안 읽힌다는 이유로 제외됐다
- 씬에 `light`를 선언하지 않는다 → `mirrorShadow`가 생기지 않는다
- 엔티티를 CSS로 움직일 때는 `transform`을 쓰지 않는다. `.entity`는 `transform: translate(-50%,-100%)`로 제자리에 서 있어서, 덮어쓰면 발 위치가 깨진다. 개별 속성 `translate`·`rotate`를 쓴다
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## 확인된 좌표

| 쓰임 | 시트 | (col,row) | 확인 방법 |
|---|---|---|---|
| 철창 | dungeon | (7,5) | 격자 확대 |
| 레일 | dungeon | (7,6) | 격자 확대 |
| 닫힌 보물상자 | dungeon | (5,7) | 격자 확대 |
| 거미 | dungeon | (2,10) | 격자 확대 |
| 곡괭이 | dungeon | (11,10) | 격자 확대 |
| 레버 | platformer | (4,3) | 격자 확대, `docs/ASSETS.md`에도 기재 |
| 불꽃(빛 포함) | roguelike | (54,7) | stage03 촛불이 이미 사용 |
| 고기 | roguelike | (54,15) | stage02가 이미 사용 |
| 빵 | roguelike | (55,13) | stage02가 이미 사용 |
| 플레이어 | platchars | (0,1) | stage05가 이미 사용 |
| 광석 통 | 소품 `barrel` | — | `src/engine/props.ts` |
| 손님 | actor `personA`·`personB` | — | `streetActor()` |

**스펙과 달랐던 것:** dungeon (6,4)(7,4)는 광차가 아니라 제어 콘솔이다. (1,10)은 해골이 아니라 유령이다. roguelike (54,8)(55,8)은 화덕으로 확인되지 않았다. 그래서 광차는 기존 `barrel` 소품으로 바꾸고, 화구·냄비·손잡이·온도계는 자판기처럼 CSS로 그린다.

## 초안 검증 결과 (2026-09-15, 스크래치에서 실제 엔진으로)

- 광산 결함 21개 (제외 전), no-op 0, 모든 결함 2초 무사. 대역별: 1-2 대역 8개, 2-3 대역 14개, 3-4 대역 13개
- 주방 결함 19개, no-op 0, 모든 결함 2초 무사. 2-2 대역만 2개다
- 커리큘럼: 풀이 3개 미만인 (씬, 대역) 조합은 스케줄러가 건너뛴다. 그런데 그 풀은 **`exclusions.ts`에 실제로 적힌 제외를 반영해** 센다. 광산 통의 `teleportOnEnd` 둘은 바로 대역 2라서, 제외가 파일에 들어가면 광산의 2-2 대역은 2개가 되고 스케줄러가 그 슬롯을 건너뛴다. `exclusions.ts`에 두 줄을 넣은 상태로 확인했을 때 `checkcurriculum`과 같은 판정이 세 경우(오늘 그대로, 광산 추가, 광산+주방 추가) 모두 통과했고, 가장 작은 풀은 3이었다. **제외를 파일에 넣지 않고 판정할 때만 빼면 슬롯 #6·#13에서 풀이 2로 떨어진다** — Task 1은 Step 6(제외)을 반드시 Step 7(검사)보다 먼저 한다
- 동작: 레버 A는 철창 A만 연다. 배선이 꼬이면 B가 열린다. 죽은 레버는 아무것도 안 연다. 상자는 금 +10에 6초 뒤 재생성된다. 거미는 아프다. 통은 50~310을 왕복한다. 왼쪽 손잡이는 왼쪽만 켜고 2초에 60도 오르며, 끄면 내려간다. `invertMeter`는 계기판을 반전시킨다. 죽은 손잡이는 불을 안 켠다. 요리를 줍면 주문 +1이다. 손님은 걷는다

---

## File Structure

| 파일 | 할 일 | 책임 |
|---|---|---|
| `src/stages/stage08/scene.ts` | 새로 | 광산 씬 데이터 |
| `src/stages/stage09/scene.ts` | 새로 | 주방 씬 데이터 |
| `src/stages/registry.ts` | 수정 | import, `ENGINE_SCENES`, `SCENE_YEAR` |
| `src/engine/engine.css` | 수정 | `s8-*`, `s9-*` 스타일 (파일 끝에 추가) |
| `src/engine/exclusions.ts` | 수정 | 광산 통의 `teleportOnEnd` 두 개 제외 |
| `src/i18n/{en,ko,ja,zh-Hans,zh-Hant}.json` | 수정 | 씬 이름·브리핑·목표·오브젝트 이름 |
| `scripts/checkscenes.ts` | 수정 | 두 씬 동작 검사, 종료 코드 |
| `scripts/checkyears.ts` | 수정 | 실제 레지스트리의 연차 배치 |
| `docs/bug-review.{md,json,html}` | 재생성 | `npm run report` |
| `docs/superpowers/specs/2026-09-15-years-and-new-builds-design.md` | 수정 | 섹션 4 좌표 정정 |
| `docs/ASSETS.md` | 수정 | 적용 현황 두 줄 |

---

### Task 1: 광산 (`stage08`)

**Files:**
- Create: `src/stages/stage08/scene.ts`
- Modify: `src/stages/registry.ts`, `src/engine/engine.css`, `src/engine/exclusions.ts`, `src/i18n/*.json`, `scripts/checkscenes.ts`, `scripts/checkyears.ts`
- Regenerate: `docs/bug-review.md`, `docs/bug-review.json`, `docs/bug-review.html`

**Interfaces:**
- Consumes: `SCENE_YEAR`, `buildIdsFor` (뼈대 계획), `SceneRuntime.click`, `SceneRuntime.isTriggered`
- Produces: `export const stage08Scene: SceneSpec`. 오브젝트 id는 `leverA|B|C`, `gateA|B|C`, `lamp1|2`, `barrel1|2`, `chest1|2|3`, `spider1|2`, `pickaxe`, `goldHud`, `hpBar`, `player`. 링크 id는 `wireA|B|C`

- [ ] **Step 1: `checkscenes.ts`가 실패할 수 있게 한다**

지금 `scripts/checkscenes.ts`는 `FAIL`을 찍어도 종료 코드를 설정하지 않는다. 파일 맨 끝에 추가:

```ts
process.exitCode = fails ? 1 : 0;
```

실패하는지 확인한다. 파일 맨 위 `let fails = 0;`을 잠깐 `let fails = 1;`로 바꾼다.

Run: `npx tsx scripts/checkscenes.ts > /dev/null; echo "exit=$?"`
Expected: `exit=1`

`let fails = 0;`으로 되돌린다.

Run: `npx tsx scripts/checkscenes.ts > /dev/null; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Step 2: 광산 동작 검사를 먼저 쓴다**

`scripts/checkscenes.ts` import 목록의 `import { stage06Scene } from "../src/stages/stage06/scene";` 다음 줄에:

```ts
import { stage08Scene } from "../src/stages/stage08/scene";
```

`console.log(fails === 0 ? "\nALL PASS" : \`\n${fails} FAILURES\`);` 줄 **바로 위에**:

```ts
/* stage 8: the mine — each lever lifts the gate above it, and only that one */
{
  const r = new SceneRuntime(stage08Scene);
  r.click("leverA");
  ok("stage08: lever A lifts gate A and only gate A",
     r.isTriggered("gateA") && !r.isTriggered("gateB") && !r.isTriggered("gateC"));
  tick(r, 3);
  ok("stage08: the gate comes back down", !r.isTriggered("gateA"));

  const crossed = new SceneRuntime(applyMutation(stage08Scene, mut(stage08Scene, "wiringSwap:leverA:leverB")));
  crossed.click("leverA");
  ok("stage08: with the wires crossed, lever A lifts gate B",
     !crossed.isTriggered("gateA") && crossed.isTriggered("gateB"));

  const dead = new SceneRuntime(applyMutation(stage08Scene, mut(stage08Scene, "noAction:leverB")));
  dead.click("leverB");
  ok("stage08: a dead lever lifts nothing", !dead.isTriggered("gateB"));

  const rc = new SceneRuntime(stage08Scene);
  const chest = stage08Scene.objects.find((o) => o.id === "chest2")!;
  rc.state.objects.player.x = chest.x;
  rc.state.objects.player.y = chest.y;
  tick(rc, 0.1);
  ok("stage08: walking onto a chest takes it for 10 gold",
     rc.state.counters.gold === 10 && !rc.state.objects.chest2.alive);
  rc.state.objects.player.x = 180;
  rc.state.objects.player.y = 400;
  tick(rc, 6.2);
  ok("stage08: the chest is back six seconds later", rc.state.objects.chest2.alive);

  const rh = new SceneRuntime(stage08Scene);
  const spider = stage08Scene.objects.find((o) => o.id === "spider1")!;
  rh.state.objects.player.x = spider.x;
  rh.state.objects.player.y = spider.y + 10;
  tick(rh, 0.1);
  ok("stage08: a spider hurts", rh.state.counters.hp === 2);

  const rb = new SceneRuntime(stage08Scene);
  let lo = 999, hi = -999;
  for (let i = 0; i < 60 * 12; i++) {
    rb.tick(1 / 60);
    lo = Math.min(lo, rb.state.objects.barrel1.x);
    hi = Math.max(hi, rb.state.objects.barrel1.x);
  }
  ok(`stage08: an ore barrel rides the whole rail and stays on it (${lo.toFixed(0)}..${hi.toFixed(0)})`,
     lo >= 50 && hi <= 310 && hi - lo > 200);

  const pair = stage08Scene.objects.filter((o) => o.peerGroup === "barrel");
  const runs = pair.map((o) => JSON.stringify(o.behaviors));
  ok("stage08: the two barrels share one run and one speed", runs.length === 2 && runs[0] === runs[1]);
}
```

`scripts/checkyears.ts`에서 `\nawait (async () => {` 줄 **바로 위에**:

```ts
console.log("\nthe registry puts each new build in its own year");
{
  is(Object.keys(SCENE_YEAR).every((id) => /^stage\d{2}$/.test(id)),
     "every later build id passes the server's book pattern");
  is(!buildIdsFor(1).includes("stage08") && buildIdsFor(2).includes("stage08"),
     "the mine arrives in year two, and not before");
}
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx tsx scripts/checkscenes.ts; echo "exit=$?"`
Expected: `Cannot find module '../src/stages/stage08/scene'`, `exit=1`

- [ ] **Step 4: 씬을 만든다**

`src/stages/stage08/scene.ts`:

```ts
import type { ObjectSpec, SceneSpec } from "../../engine/types";

/**
 * Stage 8: the mine, the build that arrives in a player's second year.
 *
 * Three gates in the back wall, and a lever in front of each. Everybody knows
 * what a lever is for: you pull it and the thing in front of you opens. That
 * is the promise the crossed-wires fault breaks, the same way the drinks
 * machine's buttons do — and here the thing that answers is a gate you can
 * see lift, not a can you have to wait for.
 *
 * Everything else is the forage loop moved underground, because a second
 * year should not have to teach its verbs again: walk onto a chest for gold,
 * keep off the spiders. The two ore barrels on the rails are the moving parts,
 * so the floor is never safe to cross on memory.
 *
 * The art is the dungeon sheet, which the game had loaded since the start and
 * never used. It has no lever and no mine cart: the levers are the platformer
 * pack's, drawn with the same outline weight, and the carts are the barrel
 * prop — the sheet's cells that look like carts at a glance are control
 * consoles.
 */

/** the three gates along the back wall, each with the lever that lifts it */
const BAYS = [
  { id: "A", x: 70 },
  { id: "B", x: 180 },
  { id: "C", x: 290 },
];

/** the two rails the ore barrels ride, and where each barrel starts */
const RAILS = [
  { id: "1", y: 392, start: 70 },
  { id: "2", y: 486, start: 290 },
];

const RAIL_TILES = 8;
const RAIL_SCALE = 2.5;
const RAIL_W = 16 * RAIL_SCALE;

const CHESTS = [
  { id: "chest1", x: 64, y: 588 },
  { id: "chest2", x: 180, y: 560 },
  { id: "chest3", x: 296, y: 588 },
];

const SPIDERS = [
  { id: "spider1", x: 40, y: 318 },
  { id: "spider2", x: 320, y: 318 },
];

export const stage08Scene: SceneSpec = {
  id: "stage08",
  nameKey: "stage.stage08.name",
  introKey: "intro.stage08.line",
  goalKey: "goal.stage08",
  backgroundClass: "s8-mine",
  counters: [
    { id: "hp", nameKey: "counter.hp", initial: 3, max: 3, display: "hearts" },
    { id: "gold", nameKey: "counter.gold", initial: 0, display: "number" },
  ],
  /* one wire per lever: the lever you pull is a promise about which gate lifts */
  links: BAYS.map((b) => ({
    id: `wire${b.id}`,
    from: `lever${b.id}`,
    to: `gate${b.id}`,
    duration: 2.5,
  })),
  objects: [
    { id: "hpBar", nameKey: "object.hpBar", kind: "hud", x: 0, y: 0, counter: "hp", render: {}, behaviors: [] },
    { id: "goldHud", nameKey: "object.goldHud", kind: "hud", x: 0, y: 0, counter: "gold", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 430,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars", col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 330, maxY: 610 }],
    },

    /* the gates, set into the back wall */
    ...BAYS.map(
      (b): ObjectSpec => ({
        id: `gate${b.id}`,
        nameKey: `object.mineGate${b.id}`,
        kind: "decor",
        x: b.x,
        y: 214,
        z: 1,
        peerGroup: "gate",
        render: {
          className: "s8-gate",
          sprite: { sheet: "dungeon", col: 7, row: 5, scale: 3 },
        },
        behaviors: [],
      })
    ),

    /* and the lever under each one */
    ...BAYS.map(
      (b): ObjectSpec => ({
        id: `lever${b.id}`,
        nameKey: `object.mineLever${b.id}`,
        kind: "sprite",
        x: b.x,
        y: 282,
        z: 2,
        peerGroup: "lever",
        render: {
          className: "s8-lever",
          sprite: { sheet: "platformer", col: 4, row: 3, scale: 2.4 },
        },
        behaviors: [
          { t: "clickable", action: [{ a: "trigger", target: `lever${b.id}` }] },
        ],
      })
    ),

    /* two lamps on the wall between the gates */
    ...[
      { id: "lamp1", x: 125 },
      { id: "lamp2", x: 235 },
    ].map(
      (l): ObjectSpec => ({
        id: l.id,
        nameKey: `object.mineLamp${l.id.slice(-1)}`,
        kind: "decor",
        x: l.x,
        y: 170,
        z: 1,
        peerGroup: "lamp",
        render: {
          sprite: { sheet: "roguelike", col: 54, row: 7, scale: 2.2 },
          glow: { radius: 110, offsetX: 0, offsetY: -12 },
        },
        // not essential: a lamp that stops flickering is still a lamp, so this
        // is not offered to the frozen-animation fault
        behaviors: [{ t: "animate", name: "flicker", period: 0.6 }],
      })
    ),

    /* the rails, laid flat */
    ...RAILS.flatMap((r) =>
      Array.from(
        { length: RAIL_TILES },
        (_, i): ObjectSpec => ({
          id: `rail${r.id}_${i}`,
          nameKey: "object.rail",
          kind: "decor",
          x: 20 + RAIL_W * i + RAIL_W / 2,
          y: r.y,
          z: 0,
          render: {
            sprite: { sheet: "dungeon", col: 7, row: 6, scale: RAIL_SCALE },
          },
          behaviors: [],
        })
      )
    ),

    /* an ore barrel on each rail: the same run and the same speed */
    ...RAILS.map(
      (r): ObjectSpec => ({
        id: `barrel${r.id}`,
        nameKey: `object.barrel${r.id}`,
        kind: "sprite",
        x: r.start,
        y: r.y - 4,
        z: 2,
        peerGroup: "barrel",
        render: { prop: { id: "barrel", scale: 2 } },
        behaviors: [
          { t: "patrol", axis: "x", min: 50, max: 310, speed: 60, flipSprite: false },
        ],
      })
    ),

    /* what you came for */
    ...CHESTS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: c.y,
        peerGroup: "chest",
        render: {
          sprite: { sheet: "dungeon", col: 5, row: 7, scale: 2.5 },
        },
        behaviors: [
          {
            t: "pickup",
            radius: 30,
            respawn: 6,
            onPickup: [{ a: "increment", counter: "gold", by: 10 }],
          },
        ],
      })
    ),

    /* what hurts: the same spider twice, so one that does not is a fault */
    ...SPIDERS.map(
      (s): ObjectSpec => ({
        id: s.id,
        nameKey: `object.${s.id}`,
        kind: "sprite",
        x: s.x,
        y: s.y,
        peerGroup: "spider",
        render: {
          sprite: { sheet: "dungeon", col: 2, row: 10, scale: 2.4 },
        },
        behaviors: [{ t: "damage", counter: "hp", amount: 1, radius: 26 }],
      })
    ),

    {
      id: "pickaxe",
      nameKey: "object.pickaxe",
      kind: "decor",
      x: 330,
      y: 440,
      z: 1,
      render: { sprite: { sheet: "dungeon", col: 11, row: 10, scale: 2.4 } },
      behaviors: [],
    },
  ],
};
```

- [ ] **Step 5: 등록한다**

`src/stages/registry.ts`의 `import { stage07Scene } from "./stage07/scene";` 다음 줄에:

```ts
import { stage08Scene } from "./stage08/scene";
```

`ENGINE_SCENES` 배열에서 `stage07Scene,` 다음 줄에:

```ts
  stage08Scene,
```

`export const SCENE_YEAR: Readonly<Record<string, number>> = {};`를:

```ts
export const SCENE_YEAR: Readonly<Record<string, number>> = { stage08: 2 };
```

- [ ] **Step 6: 광산 통의 순간이동을 뺀다**

`src/engine/exclusions.ts`에서 `  "stage06:noAction:leverB",` 다음 줄에:

```ts
  /*
   * Wrapping round, on the mine's ore barrels.
   *
   * The same reasoning that took it off the shooting range's targets: a
   * thing riding a rail has no end behaviour the player already expects of
   * it. A barrel that reaches the end of the track and comes back on from
   * the other side reads as a loop line, not a broken one. The barrels keep
   * the recoil fault, which is wrong whichever way a rail runs.
   */
  "stage08:teleportOnEnd:barrel1:teleport",
  "stage08:teleportOnEnd:barrel2:teleport",
```

- [ ] **Step 7: 스크립트 검사**

Run: `npx tsc -b && npx tsx scripts/checkscenes.ts > /tmp/cs.txt; echo "exit=$?"; grep -E "^FAIL|stage08" /tmp/cs.txt`
Expected: `exit=0`. `stage08: no no-op mutations (19 bugs)`, `stage08: all mutations run 2s without throwing`, `stage08: has an intro line`, 그리고 Step 2의 동작 검사 9줄이 모두 `PASS`

Run: `npx tsx scripts/checkcurriculum.ts | grep -E "^FAIL|stage08|ALL PASS"; npx tsx scripts/checkyears.ts | grep -E "^FAIL|mine|years hold"`
Expected: `FAIL` 없음, `ALL PASS`, `the mine arrives in year two, and not before` PASS, `the years hold`

- [ ] **Step 8: 번역**

```bash
node <<'EOF'
const fs = require("fs");
const add = {
  en: {
    "stage.stage08.name": "The mine",
    "intro.stage08.line": "Mine build. Pull the levers, take the chests, mind the spiders. One thing is wrong.",
    "goal.stage08": "Pull a lever: the gate above it lifts. Chests give gold. Spiders hurt",
    "object.goldHud": "gold count",
    "object.mineGateA": "the left gate",
    "object.mineGateB": "the middle gate",
    "object.mineGateC": "the right gate",
    "object.mineLeverA": "the left lever",
    "object.mineLeverB": "the middle lever",
    "object.mineLeverC": "the right lever",
    "object.mineLamp1": "the left lamp",
    "object.mineLamp2": "the right lamp",
    "object.rail": "the rail",
    "object.barrel1": "the upper ore barrel",
    "object.barrel2": "the lower ore barrel",
    "object.chest1": "the left chest",
    "object.chest2": "the middle chest",
    "object.chest3": "the right chest",
    "object.spider1": "the left spider",
    "object.spider2": "the right spider",
    "object.pickaxe": "the pickaxe",
  },
  ko: {
    "stage.stage08.name": "광산 보물굴",
    "intro.stage08.line": "광산 빌드. 레버를 당기고, 상자를 줍고, 거미를 조심하라. 하나가 잘못됐다.",
    "goal.stage08": "레버를 당기면 그 위 철창이 올라간다. 상자는 금화, 거미는 아프다",
    "object.goldHud": "금화 수",
    "object.mineGateA": "왼쪽 철창",
    "object.mineGateB": "가운데 철창",
    "object.mineGateC": "오른쪽 철창",
    "object.mineLeverA": "왼쪽 레버",
    "object.mineLeverB": "가운데 레버",
    "object.mineLeverC": "오른쪽 레버",
    "object.mineLamp1": "왼쪽 등불",
    "object.mineLamp2": "오른쪽 등불",
    "object.rail": "레일",
    "object.barrel1": "위쪽 광석 통",
    "object.barrel2": "아래쪽 광석 통",
    "object.chest1": "왼쪽 상자",
    "object.chest2": "가운데 상자",
    "object.chest3": "오른쪽 상자",
    "object.spider1": "왼쪽 거미",
    "object.spider2": "오른쪽 거미",
    "object.pickaxe": "곡괭이",
  },
  ja: {
    "stage.stage08.name": "鉱山の宝物庫",
    "intro.stage08.line": "鉱山ビルド。レバーを引き、宝箱を拾い、クモに気をつけろ。どこか一つおかしい。",
    "goal.stage08": "レバーを引くと、その上の鉄格子が上がる。宝箱は金貨、クモは痛い",
    "object.goldHud": "金貨の数",
    "object.mineGateA": "左の鉄格子",
    "object.mineGateB": "真ん中の鉄格子",
    "object.mineGateC": "右の鉄格子",
    "object.mineLeverA": "左のレバー",
    "object.mineLeverB": "真ん中のレバー",
    "object.mineLeverC": "右のレバー",
    "object.mineLamp1": "左のランプ",
    "object.mineLamp2": "右のランプ",
    "object.rail": "レール",
    "object.barrel1": "上の鉱石樽",
    "object.barrel2": "下の鉱石樽",
    "object.chest1": "左の宝箱",
    "object.chest2": "真ん中の宝箱",
    "object.chest3": "右の宝箱",
    "object.spider1": "左のクモ",
    "object.spider2": "右のクモ",
    "object.pickaxe": "つるはし",
  },
  "zh-Hans": {
    "stage.stage08.name": "矿洞宝库",
    "intro.stage08.line": "矿洞版本。拉动拉杆、捡起宝箱、小心蜘蛛。有一处不对。",
    "goal.stage08": "拉下拉杆，上方的铁栅就会升起。宝箱给金币，蜘蛛会伤人",
    "object.goldHud": "金币数",
    "object.mineGateA": "左边的铁栅",
    "object.mineGateB": "中间的铁栅",
    "object.mineGateC": "右边的铁栅",
    "object.mineLeverA": "左边的拉杆",
    "object.mineLeverB": "中间的拉杆",
    "object.mineLeverC": "右边的拉杆",
    "object.mineLamp1": "左边的灯",
    "object.mineLamp2": "右边的灯",
    "object.rail": "轨道",
    "object.barrel1": "上面的矿石桶",
    "object.barrel2": "下面的矿石桶",
    "object.chest1": "左边的宝箱",
    "object.chest2": "中间的宝箱",
    "object.chest3": "右边的宝箱",
    "object.spider1": "左边的蜘蛛",
    "object.spider2": "右边的蜘蛛",
    "object.pickaxe": "镐",
  },
  "zh-Hant": {
    "stage.stage08.name": "礦洞寶庫",
    "intro.stage08.line": "礦洞版本。拉動拉桿、撿起寶箱、小心蜘蛛。有一處不對。",
    "goal.stage08": "拉下拉桿，上方的鐵柵就會升起。寶箱給金幣，蜘蛛會傷人",
    "object.goldHud": "金幣數",
    "object.mineGateA": "左邊的鐵柵",
    "object.mineGateB": "中間的鐵柵",
    "object.mineGateC": "右邊的鐵柵",
    "object.mineLeverA": "左邊的拉桿",
    "object.mineLeverB": "中間的拉桿",
    "object.mineLeverC": "右邊的拉桿",
    "object.mineLamp1": "左邊的燈",
    "object.mineLamp2": "右邊的燈",
    "object.rail": "軌道",
    "object.barrel1": "上面的礦石桶",
    "object.barrel2": "下面的礦石桶",
    "object.chest1": "左邊的寶箱",
    "object.chest2": "中間的寶箱",
    "object.chest3": "右邊的寶箱",
    "object.spider1": "左邊的蜘蛛",
    "object.spider2": "右邊的蜘蛛",
    "object.pickaxe": "鎬",
  },
};
let failed = false;
const out = {};
for (const [lang, keys] of Object.entries(add)) {
  const p = `src/i18n/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const k of Object.keys(keys)) if (k in dict) { console.error(`FAIL ${lang}: ${k} exists`); failed = true; }
  Object.assign(dict, keys);
  out[p] = JSON.stringify(dict, null, 2) + "\n";
}
if (failed) process.exit(1);
for (const [p, s] of Object.entries(out)) fs.writeFileSync(p, s);
console.log("written");
EOF
```

Run: `git diff --stat src/i18n && npx tsx scripts/checki18n.ts | grep -E "^FAIL|^PASS  (ko|ja|zh)"`
Expected: 다섯 파일 각각 +21줄 안팎이고, 수백 줄씩 바뀐 파일은 없다. `FAIL`도 없다

- [ ] **Step 9: 스타일**

`src/engine/engine.css` 맨 끝에 추가:

```css
/* ---- the mine ---- */
.s8-mine {
  background:
    /* stone courses in the back wall the gates are set into */
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0 2px, transparent 2px 40px) 0 60px / 100% 170px no-repeat,
    repeating-linear-gradient(rgba(0, 0, 0, 0.2) 0 2px, transparent 2px 28px) 0 60px / 100% 170px no-repeat,
    linear-gradient(#3b3346 0 60px, #4a4152 60px 230px, #2a2320 230px 238px, #5b4636 238px);
}
/*
 * A gate lifts while its lever's wire is live.
 *
 * `translate`, not `transform`: every entity already stands where it stands
 * by `transform: translate(-50%, -100%)`, and replacing that would lift the
 * gate off its own foot as well as up the wall.
 */
.entity.s8-gate {
  transition: translate 0.3s ease-out;
}
.entity.s8-gate.triggered {
  translate: 0 -42px;
}
.entity.s8-lever {
  cursor: pointer;
}
```

- [ ] **Step 10: 리뷰 문서 재생성과 전체 검사**

Run: `npm run report && node -e 'const j=require("./docs/bug-review.json"); const rows=Array.isArray(j)?j:(j.rows||j.bugs); console.log(rows.filter(r=>r.scene==="stage08").length)'`
Expected: `wrote docs/bug-review.md ...`, 그다음 줄 `19`

Run: `npm run verify > /tmp/v1.txt 2>&1; echo "exit=$?"; grep -E "^FAIL|error TS" /tmp/v1.txt; npm run lint`
Expected: `exit=0`, `FAIL` 없음, lint 출력 없음

- [ ] **Step 11: 커밋·푸시**

```bash
git add src/stages/stage08/scene.ts src/stages/registry.ts src/engine/engine.css src/engine/exclusions.ts src/i18n scripts/checkscenes.ts scripts/checkyears.ts docs/bug-review.md docs/bug-review.json docs/bug-review.html
git commit -m "Open the mine in a player's second year

Three gates and a lever under each, chests for gold, two spiders and two ore
barrels on rails, all from behaviours the engine already had. The dungeon
sheet has been loaded since the start and never drawn; the levers come from
the platformer pack and the carts are the barrel prop, because the cells that
look like carts are consoles.

checkscenes now sets its exit code - it printed FAIL and passed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 2: 광산을 브라우저에서 확인한다

**Files:** 확인에서 좌표를 고칠 때만 `src/stages/stage08/scene.ts`

- [ ] **Step 1: DebugLab에서 광산을 연다**

미리보기(`find-bug-dev`)에서 `http://localhost:5177/?debug`로 간다. 탭 글자는 씬 id에서 `stage`를 뗀 숫자다 — `08` 탭을 누른다. 결함 행은 `title`이 결함 id인 버튼이라, 콘솔에서 연다:

```js
document.querySelector('button[title="wiringSwap:leverA:leverB"]').click();
```

플레이 화면이 열리면 브리핑을 닫는다.

- [ ] **Step 2: 보이는지 본다 (스크린샷)**

한 장으로 다음을 확인한다:
- 뒷벽 띠 안에 철창 세 개가 서 있고, 각 철창 바로 아래에 레버가 있다
- 두 등불이 철창 사이 벽에 있고 빛이 퍼진다
- 레일 두 줄이 화면을 가로지르고, 각 레일 위에 통이 있다
- 상자 세 개가 아래쪽에, 거미 둘이 좌우 가장자리에 있다
- 금화 HUD와 체력 하트가 보인다

하나라도 겹치거나 화면 밖이면, 해당 오브젝트의 `x`/`y`를 스크린샷에서 잰 만큼 옮기고 Task 1 Step 7 검사를 다시 돌린다.

- [ ] **Step 3: 동작을 본다**

콘솔에서 레버를 누른 직후 클래스를 읽는다:

```js
[...document.querySelectorAll('.entity.s8-lever')][0].click();
await new Promise((r) => setTimeout(r, 400));
[...document.querySelectorAll('.entity.s8-gate')].map((g) => g.classList.contains('triggered'))
```

Expected: 이 빌드에는 `wiringSwap`이 심어져 있으므로 `[false, true, false]` — 왼쪽 레버에 가운데 철창이 올라간다. 올라간 상태로 스크린샷을 한 장 찍어 철창이 벽 위로 42px 올라갔는지 본다.

같은 방법으로 결함 표의 `noPickup:chest1` 행을 열고, 레버를 눌러 `[true, false, false]`가 나오는지 본다. 결함이 없는 배선이다.

- [ ] **Step 4: 고친 게 있으면 커밋·푸시**

좌표를 고쳤다면:

```bash
git add src/stages/stage08/scene.ts
git commit -m "Place the mine's pieces where they read on screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

고친 게 없으면 커밋하지 않는다.

---

### Task 3: 주방 (`stage09`)

**Files:**
- Create: `src/stages/stage09/scene.ts`
- Modify: `src/stages/registry.ts`, `src/engine/engine.css`, `src/i18n/*.json`, `scripts/checkscenes.ts`, `scripts/checkyears.ts`
- Regenerate: `docs/bug-review.*`

**Interfaces:**
- Consumes: `streetActor(sheet)` from `src/street/scene.ts`, `SceneRuntime.click`
- Produces: `export const stage09Scene: SceneSpec`. 오브젝트 id는 `stoveL|R`, `potL|R`, `flameL|R`, `knobL|R`, `gaugeL|R`, `pass`, `dish1|2|3`, `customer1|2`, `ordersHud`, `player`. 카운터는 `served`, `heatL`, `heatR`. 플래그는 `fireL`, `fireR`

- [ ] **Step 1: 주방 동작 검사를 먼저 쓴다**

`scripts/checkscenes.ts` import에서 `import { stage08Scene } ...` 다음 줄에:

```ts
import { stage09Scene } from "../src/stages/stage09/scene";
```

Task 1에서 넣은 `/* stage 8: the mine ... */` 블록 **다음에**:

```ts
/* stage 9: the kitchen — a knob lights its own burner, and its thermometer climbs */
{
  const r = new SceneRuntime(stage09Scene);
  r.click("knobL");
  ok("stage09: the left knob lights the left burner only",
     r.state.flags.fireL === true && !r.state.flags.fireR);
  tick(r, 2);
  const h = r.state.counters.heatL;
  ok(`stage09: the left heat rises, the right does not (${h.toFixed(1)})`,
     h > 55 && h < 65 && r.state.counters.heatR === 0);
  r.click("knobL");
  tick(r, 2);
  ok("stage09: the heat falls again when the burner is off", r.state.counters.heatL < h);

  const inverted = applyMutation(stage09Scene, mut(stage09Scene, "invertMeter:gaugeL"));
  const meter = inverted.objects.find((o) => o.id === "gaugeL")!.behaviors.find((b) => b.t === "meter");
  ok("stage09: invertMeter turns the left thermometer backwards",
     !!meter && meter.t === "meter" && meter.invert === true);

  const dead = new SceneRuntime(applyMutation(stage09Scene, mut(stage09Scene, "noAction:knobR")));
  dead.click("knobR");
  tick(dead, 1);
  ok("stage09: a dead knob lights nothing", !dead.state.flags.fireR && dead.state.counters.heatR === 0);

  const rp = new SceneRuntime(stage09Scene);
  const dish = stage09Scene.objects.find((o) => o.id === "dish1")!;
  rp.state.objects.player.x = dish.x;
  rp.state.objects.player.y = dish.y;
  tick(rp, 0.1);
  ok("stage09: taking a dish serves an order", rp.state.counters.served === 1);

  const rw = new SceneRuntime(stage09Scene);
  const x0 = rw.state.objects.customer1.x;
  tick(rw, 3);
  ok("stage09: the customers walk", rw.state.objects.customer1.x !== x0);

  const pairs = ["gauge", "knob", "customer"].map((g) => {
    const runs = stage09Scene.objects
      .filter((o) => o.peerGroup === g)
      .map((o) => JSON.stringify(o.behaviors).replace(/"(fire|heat)[LR]"/g, '"$1"'));
    return runs.length === 2 && runs[0] === runs[1];
  });
  ok("stage09: each left-and-right pair behaves identically", pairs.every(Boolean));
}
```

`scripts/checkyears.ts`에서 Task 1이 넣은 `the mine arrives in year two, and not before` 줄 다음에:

```ts
  is(!buildIdsFor(2).includes("stage09") && buildIdsFor(3).includes("stage09"),
     "the kitchen arrives in year three, and not before");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx scripts/checkscenes.ts; echo "exit=$?"`
Expected: `Cannot find module '../src/stages/stage09/scene'`, `exit=1`

- [ ] **Step 3: 씬을 만든다**

`src/stages/stage09/scene.ts`:

```ts
import type { ObjectSpec, SceneSpec } from "../../engine/types";
import { streetActor } from "../../street/scene";

/**
 * Stage 9: the kitchen, the build that arrives in a player's third year.
 *
 * It exists for one rule everybody already holds: turn the heat on and the
 * thing gets hotter. The engine has had a thermometer that can read
 * backwards since the fault list was written, and no scene ever put one on
 * screen, so that fault had never once been planted. Here it sits beside a
 * burner you light yourself, with a pot on top that boils while the fire is
 * lit — so a needle falling while the pot boils is wrong at a glance.
 *
 * Everything comes in pairs, left and right, so each piece has its twin a
 * hand's width away to be judged against. The dishes on the pass and the two
 * customers in the queue are the parts that do not need the burners.
 *
 * The flame and the food are sprites the shop and the dungeon builds already
 * use. No pack here has a stove, a knob or a thermometer, so those are drawn
 * in CSS, the way the drinks machine is.
 */

/** the two burners, left and right, each a complete set */
const STOVES = [
  { id: "L", x: 60, gaugeX: 4 },
  { id: "R", x: 190, gaugeX: 306 },
];
const STOVE_W = 110;

const DISHES = [
  { id: "dish1", x: 70, col: 54, row: 15 },
  { id: "dish2", x: 180, col: 55, row: 13 },
  { id: "dish3", x: 290, col: 54, row: 15 },
];

const CUSTOMERS = [
  { id: "customer1", x: 60, sheet: "personA" as const },
  { id: "customer2", x: 300, sheet: "personB" as const },
];

export const stage09Scene: SceneSpec = {
  id: "stage09",
  nameKey: "stage.stage09.name",
  introKey: "intro.stage09.line",
  goalKey: "goal.stage09",
  backgroundClass: "s9-kitchen",
  counters: [
    { id: "served", nameKey: "counter.orders", initial: 0, display: "number" },
    // no HUD widget reads these: the thermometers are how heat is shown
    { id: "heatL", nameKey: "counter.heat", initial: 0, max: 100, display: "number" },
    { id: "heatR", nameKey: "counter.heat", initial: 0, max: 100, display: "number" },
  ],
  flags: ["fireL", "fireR"],
  objects: [
    { id: "ordersHud", nameKey: "object.ordersHud", kind: "hud", x: 0, y: 0, counter: "served", render: {}, behaviors: [] },

    {
      id: "player",
      nameKey: "object.player",
      kind: "player",
      x: 180,
      y: 560,
      z: 3,
      render: {
        facesLeft: true,
        sprite: { sheet: "platchars", col: 0, row: 1, scale: 1.9 },
        shadow: { offsetX: 14, width: 30 },
      },
      behaviors: [{ t: "playerTopDown", speed: 140, minY: 380, maxY: 600 }],
    },

    ...STOVES.flatMap((s): ObjectSpec[] => [
      /* the range itself */
      {
        id: `stove${s.id}`,
        nameKey: `object.stove${s.id}`,
        kind: "decor",
        x: s.x,
        y: 180,
        z: 0,
        render: { className: "s9-stove", bar: { width: STOVE_W, height: 110 } },
        behaviors: [],
      },
      /* the pot on it, which boils while the fire under it is lit */
      {
        id: `pot${s.id}`,
        nameKey: `object.pot${s.id}`,
        kind: "decor",
        x: s.x + 20,
        y: 142,
        z: 1,
        render: { className: "s9-pot", bar: { width: 70, height: 40 } },
        behaviors: [{ t: "flagged", flag: `fire${s.id}`, onClass: "boiling" }],
      },
      /* the flame, drawn only while lit */
      {
        id: `flame${s.id}`,
        nameKey: `object.flame${s.id}`,
        kind: "decor",
        x: s.x + STOVE_W / 2,
        y: 214,
        z: 2,
        peerGroup: "flame",
        render: {
          className: "s9-flame",
          sprite: { sheet: "roguelike", col: 54, row: 7, scale: 2.2 },
          glow: { radius: 90, offsetX: 0, offsetY: -12 },
        },
        behaviors: [
          { t: "flagged", flag: `fire${s.id}`, onClass: "lit" },
          { t: "animate", name: "flicker", period: 0.6 },
        ],
      },
      /* the knob that lights it */
      {
        id: `knob${s.id}`,
        nameKey: `object.knob${s.id}`,
        kind: "sprite",
        x: s.x + STOVE_W / 2 - 15,
        y: 300,
        z: 2,
        peerGroup: "knob",
        render: { className: "s9-knob", bar: { width: 30, height: 30 } },
        behaviors: [
          { t: "clickable", action: { a: "toggle", flag: `fire${s.id}` } },
          { t: "flagged", flag: `fire${s.id}`, onClass: "on" },
        ],
      },
      /* and the thermometer beside it: the heat rises while the flame is lit */
      {
        id: `gauge${s.id}`,
        nameKey: `object.gauge${s.id}`,
        kind: "decor",
        x: s.gaugeX,
        y: 206,
        z: 2,
        peerGroup: "gauge",
        render: { className: "s9-gauge", bar: { width: 50, height: 50 } },
        behaviors: [
          { t: "pressure", counter: `heat${s.id}`, flag: `fire${s.id}`, rise: 30, fall: 15 },
          { t: "meter", counter: `heat${s.id}`, max: 100, invert: false },
        ],
      },
    ]),

    /* the pass, and the plates on it */
    {
      id: "pass",
      nameKey: "object.pass",
      kind: "decor",
      x: 20,
      y: 452,
      z: 0,
      render: { className: "s9-pass", bar: { width: 320, height: 22 } },
      behaviors: [],
    },
    ...DISHES.map(
      (d): ObjectSpec => ({
        id: d.id,
        nameKey: `object.${d.id}`,
        kind: "sprite",
        x: d.x,
        y: 470,
        z: 1,
        peerGroup: "dish",
        render: { sprite: { sheet: "roguelike", col: d.col, row: d.row, scale: 2.4 } },
        behaviors: [
          {
            t: "pickup",
            radius: 30,
            respawn: 6,
            onPickup: [{ a: "increment", counter: "served", by: 1 }],
          },
        ],
      })
    ),

    /* the queue, walking the same line at the same pace */
    ...CUSTOMERS.map(
      (c): ObjectSpec => ({
        id: c.id,
        nameKey: `object.${c.id}`,
        kind: "sprite",
        x: c.x,
        y: 626,
        z: 2,
        peerGroup: "customer",
        render: { actor: streetActor(c.sheet) },
        behaviors: [
          { t: "patrol", axis: "x", min: 40, max: 320, speed: 40, flipSprite: false },
        ],
      })
    ),
  ],
};
```

- [ ] **Step 4: 등록한다**

`src/stages/registry.ts`의 `import { stage08Scene } from "./stage08/scene";` 다음 줄에:

```ts
import { stage09Scene } from "./stage09/scene";
```

`ENGINE_SCENES`에서 `stage08Scene,` 다음 줄에:

```ts
  stage09Scene,
```

`SCENE_YEAR`를:

```ts
export const SCENE_YEAR: Readonly<Record<string, number>> = { stage08: 2, stage09: 3 };
```

- [ ] **Step 5: 스크립트 검사**

Run: `npx tsc -b && npx tsx scripts/checkscenes.ts > /tmp/cs9.txt; echo "exit=$?"; grep -E "^FAIL|stage09" /tmp/cs9.txt`
Expected: `exit=0`. `stage09: no no-op mutations (19 bugs)`, `stage09: all mutations run 2s without throwing`, 그리고 Step 1의 동작 검사 8줄이 모두 `PASS`

Run: `npx tsx scripts/checkcurriculum.ts | grep -E "^FAIL|ALL PASS"; npx tsx scripts/checkyears.ts | grep -E "^FAIL|kitchen|years hold"`
Expected: `FAIL` 없음, `ALL PASS`, `the kitchen arrives in year three, and not before` PASS

- [ ] **Step 6: 번역**

```bash
node <<'EOF'
const fs = require("fs");
const add = {
  en: {
    "stage.stage09.name": "The kitchen",
    "intro.stage09.line": "Kitchen build. Light the burners, watch the thermometers, fill the orders. One thing is wrong.",
    "goal.stage09": "Turn a knob: that burner lights and its thermometer climbs. Take a dish to fill an order",
    "counter.orders": "Orders",
    "counter.heat": "Heat",
    "object.ordersHud": "order count",
    "object.stoveL": "the left stove",
    "object.stoveR": "the right stove",
    "object.potL": "the left pot",
    "object.potR": "the right pot",
    "object.flameL": "the left flame",
    "object.flameR": "the right flame",
    "object.knobL": "the left knob",
    "object.knobR": "the right knob",
    "object.gaugeL": "the left thermometer",
    "object.gaugeR": "the right thermometer",
    "object.pass": "the pass",
    "object.dish1": "the left dish",
    "object.dish2": "the middle dish",
    "object.dish3": "the right dish",
    "object.customer1": "the first customer",
    "object.customer2": "the second customer",
  },
  ko: {
    "stage.stage09.name": "주방",
    "intro.stage09.line": "주방 빌드. 화구를 켜고, 온도계를 보고, 주문을 채워라. 하나가 잘못됐다.",
    "goal.stage09": "손잡이를 돌리면 그 화구에 불이 붙고 옆 온도계가 오른다. 요리를 집으면 주문이 찬다",
    "counter.orders": "주문",
    "counter.heat": "온도",
    "object.ordersHud": "주문 수",
    "object.stoveL": "왼쪽 화구",
    "object.stoveR": "오른쪽 화구",
    "object.potL": "왼쪽 냄비",
    "object.potR": "오른쪽 냄비",
    "object.flameL": "왼쪽 불꽃",
    "object.flameR": "오른쪽 불꽃",
    "object.knobL": "왼쪽 손잡이",
    "object.knobR": "오른쪽 손잡이",
    "object.gaugeL": "왼쪽 온도계",
    "object.gaugeR": "오른쪽 온도계",
    "object.pass": "배식대",
    "object.dish1": "왼쪽 요리",
    "object.dish2": "가운데 요리",
    "object.dish3": "오른쪽 요리",
    "object.customer1": "첫 번째 손님",
    "object.customer2": "두 번째 손님",
  },
  ja: {
    "stage.stage09.name": "キッチン",
    "intro.stage09.line": "キッチンビルド。コンロに火をつけ、温度計を見て、注文をこなせ。どこか一つおかしい。",
    "goal.stage09": "つまみを回すとそのコンロに火がつき、横の温度計が上がる。料理を取ると注文が進む",
    "counter.orders": "注文",
    "counter.heat": "温度",
    "object.ordersHud": "注文数",
    "object.stoveL": "左のコンロ",
    "object.stoveR": "右のコンロ",
    "object.potL": "左の鍋",
    "object.potR": "右の鍋",
    "object.flameL": "左の火",
    "object.flameR": "右の火",
    "object.knobL": "左のつまみ",
    "object.knobR": "右のつまみ",
    "object.gaugeL": "左の温度計",
    "object.gaugeR": "右の温度計",
    "object.pass": "配膳台",
    "object.dish1": "左の料理",
    "object.dish2": "真ん中の料理",
    "object.dish3": "右の料理",
    "object.customer1": "一人目の客",
    "object.customer2": "二人目の客",
  },
  "zh-Hans": {
    "stage.stage09.name": "厨房",
    "intro.stage09.line": "厨房版本。点燃炉灶、看温度计、完成订单。有一处不对。",
    "goal.stage09": "转动旋钮，那个炉灶就会点火，旁边的温度计上升。拿起菜品完成订单",
    "counter.orders": "订单",
    "counter.heat": "温度",
    "object.ordersHud": "订单数",
    "object.stoveL": "左边的炉灶",
    "object.stoveR": "右边的炉灶",
    "object.potL": "左边的锅",
    "object.potR": "右边的锅",
    "object.flameL": "左边的火焰",
    "object.flameR": "右边的火焰",
    "object.knobL": "左边的旋钮",
    "object.knobR": "右边的旋钮",
    "object.gaugeL": "左边的温度计",
    "object.gaugeR": "右边的温度计",
    "object.pass": "出餐台",
    "object.dish1": "左边的菜",
    "object.dish2": "中间的菜",
    "object.dish3": "右边的菜",
    "object.customer1": "第一位客人",
    "object.customer2": "第二位客人",
  },
  "zh-Hant": {
    "stage.stage09.name": "廚房",
    "intro.stage09.line": "廚房版本。點燃爐灶、看溫度計、完成訂單。有一處不對。",
    "goal.stage09": "轉動旋鈕，那個爐灶就會點火，旁邊的溫度計上升。拿起菜品完成訂單",
    "counter.orders": "訂單",
    "counter.heat": "溫度",
    "object.ordersHud": "訂單數",
    "object.stoveL": "左邊的爐灶",
    "object.stoveR": "右邊的爐灶",
    "object.potL": "左邊的鍋",
    "object.potR": "右邊的鍋",
    "object.flameL": "左邊的火焰",
    "object.flameR": "右邊的火焰",
    "object.knobL": "左邊的旋鈕",
    "object.knobR": "右邊的旋鈕",
    "object.gaugeL": "左邊的溫度計",
    "object.gaugeR": "右邊的溫度計",
    "object.pass": "出餐台",
    "object.dish1": "左邊的菜",
    "object.dish2": "中間的菜",
    "object.dish3": "右邊的菜",
    "object.customer1": "第一位客人",
    "object.customer2": "第二位客人",
  },
};
let failed = false;
const out = {};
for (const [lang, keys] of Object.entries(add)) {
  const p = `src/i18n/${lang}.json`;
  const dict = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const k of Object.keys(keys)) if (k in dict) { console.error(`FAIL ${lang}: ${k} exists`); failed = true; }
  Object.assign(dict, keys);
  out[p] = JSON.stringify(dict, null, 2) + "\n";
}
if (failed) process.exit(1);
for (const [p, s] of Object.entries(out)) fs.writeFileSync(p, s);
console.log("written");
EOF
```

Run: `git diff --stat src/i18n && npx tsx scripts/checki18n.ts | grep -E "^FAIL|^PASS  (ko|ja|zh)"`
Expected: 다섯 파일 각각 +22줄 안팎, `FAIL` 없음

- [ ] **Step 7: 스타일**

`src/engine/engine.css` 맨 끝(Task 1의 광산 스타일 다음)에 추가:

```css
/* ---- the kitchen ---- */
.s9-kitchen {
  background:
    /* tiles behind the range */
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0 2px, transparent 2px 30px) 0 60px / 100% 280px no-repeat,
    repeating-linear-gradient(rgba(255, 255, 255, 0.35) 0 2px, transparent 2px 30px) 0 60px / 100% 280px no-repeat,
    linear-gradient(#c9d6d8 0 340px, #8a6a4f 340px);
}
/* the shared prop rule paints a wooden gradient over every bar; each of these
   is its own material, so the whole background is replaced */
.s9-stove {
  background: linear-gradient(#5b6270 0 14px, #3a3f49 14px);
  border: 3px solid #23262d;
  border-radius: 6px;
}
.s9-pot {
  background: linear-gradient(#aab3bf, #6d7684);
  border: 2px solid #2b2f36;
  border-radius: 4px 4px 14px 14px;
}
.s9-pot.boiling {
  animation: s9-boil 0.5s steps(2) infinite;
}
@keyframes s9-boil {
  50% { translate: 0 -2px; }
}
/*
 * A burner that is off draws neither its flame nor its light.
 *
 * `visibility`, not `opacity`: the flicker animation drives opacity, and an
 * animation wins over a rule. The light is a sibling of the flame rather
 * than inside it, so it is reached through :has.
 */
.sprite-emoji.s9-flame:not(.lit) {
  visibility: hidden;
}
.entity.s9-flame:has(> .sprite-emoji:not(.lit)) > .eng-glow {
  visibility: hidden;
}
.s9-knob {
  background: radial-gradient(circle, #e9e2d0 0 45%, #7a6a55 46%);
  border: 2px solid #2b2f36;
  border-radius: 50%;
  cursor: pointer;
  transition: rotate 0.2s;
}
.s9-knob.on {
  rotate: 90deg;
}
/* a dial: the shared needle turns from left (cold) through up to right (hot) */
.s9-gauge {
  background: radial-gradient(circle, #fffdf5 0 60%, #d9d2c0 61%);
  border: 3px solid #3a3f49;
  border-radius: 50%;
}
.s9-pass {
  background: linear-gradient(#b08a60, #7a5a3a);
  border-top: 2px solid #d4b184;
}
```

- [ ] **Step 8: 리뷰 문서 재생성과 전체 검사**

Run: `npm run report && node -e 'const j=require("./docs/bug-review.json"); const rows=Array.isArray(j)?j:(j.rows||j.bugs); console.log(rows.filter(r=>r.scene==="stage09").length)'`
Expected: `19`

Run: `npm run verify > /tmp/v3.txt 2>&1; echo "exit=$?"; grep -E "^FAIL|error TS" /tmp/v3.txt; npm run lint`
Expected: `exit=0`, `FAIL` 없음, lint 출력 없음

- [ ] **Step 9: 커밋·푸시**

```bash
git add src/stages/stage09/scene.ts src/stages/registry.ts src/engine/engine.css src/i18n scripts/checkscenes.ts scripts/checkyears.ts docs/bug-review.md docs/bug-review.json docs/bug-review.html
git commit -m "Open the kitchen in a player's third year

Two burners, each with its knob, its pot, its flame and its thermometer, the
dishes on the pass and a queue of two. It is the first scene to put a meter on
screen, so it is the first place the backwards-thermometer fault can ever be
planted - next to a pot that is plainly boiling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

---

### Task 4: 주방을 브라우저에서 확인한다

**Files:** 확인에서 좌표나 스타일을 고칠 때만 `src/stages/stage09/scene.ts`, `src/engine/engine.css`

- [ ] **Step 1: DebugLab에서 주방을 연다**

`http://localhost:5177/?debug` → `09` 탭 → 콘솔에서 행을 연다:

```js
document.querySelector('button[title="invertMeter:gaugeL"]').click();
```

플레이 화면이 열리면 브리핑을 닫는다.

- [ ] **Step 2: 꺼진 상태를 본다 (스크린샷)**

- 화구 둘이 위쪽에, 각 화구 위에 냄비, 앞에 손잡이, 바깥쪽에 둥근 온도계가 있다
- **불꽃도 빛도 보이지 않는다**
- 두 온도계 바늘이 모두 왼쪽(차가움)을 가리킨다 — 단, 이 빌드에서 왼쪽 온도계는 반전돼 있어 **오른쪽 끝**을 가리킨다
- 배식대 위에 요리 셋, 아래에 손님 둘이 걷는다. 주문 HUD가 보인다

- [ ] **Step 3: 켠 상태를 본다**

콘솔에서 두 손잡이를 누르고 3초 기다린다:

```js
document.querySelectorAll('.eng-bar.s9-knob').forEach((k) => k.click());
await new Promise((r) => setTimeout(r, 3000));
JSON.stringify({
  flamesLit: [...document.querySelectorAll('.sprite-emoji.s9-flame')].map((f) => f.classList.contains('lit')),
  potsBoiling: [...document.querySelectorAll('.eng-bar.s9-pot')].map((p) => p.classList.contains('boiling')),
  needles: [...document.querySelectorAll('.eng-bar.s9-gauge .eng-needle')].map((n) => n.style.transform),
})
```

Expected: `flamesLit: [true, true]`, `potsBoiling: [true, true]`. 바늘은 오른쪽 계기판이 `rotate(` 양수로 올라가고, 왼쪽(반전)은 음수 쪽으로 내려간다. 스크린샷 한 장으로 불꽃과 빛이 보이는지, 한쪽 바늘만 거꾸로 가는 게 한눈에 보이는지 확인한다.

- [ ] **Step 4: 고친 게 있으면 커밋·푸시**

```bash
git add src/stages/stage09/scene.ts src/engine/engine.css
git commit -m "Place the kitchen's pieces where they read on screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
```

고친 게 없으면 커밋하지 않는다.

---

### Task 5: 스펙 좌표 정정, ASSETS.md, 전체 검증

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-years-and-new-builds-design.md`, `docs/ASSETS.md`

- [ ] **Step 1: 스펙 섹션 4의 두 표를 실제 좌표로 바꾼다**

스펙에서 `### 2년차 · 광산 보물굴 (\`stage08\`) — 새 아트 없음`부터 `### 두 씬 공통` **직전**까지를 아래로 통째로 바꾼다:

```markdown
### 2년차 · 광산 보물굴 (`stage08`) — 새 아트 없음

`dungeon.png`는 저장소에 있지만 어느 씬도 쓰지 않던 시트다. 레버와 광차는 이 시트에
없다. 레버는 `platformer.png`에서 가져오고, 광차는 기존 `barrel` 소품으로 대신한다.
처음 적었던 dungeon (6,4)(7,4)는 격자로 확대해 보니 광차가 아니라 제어 콘솔이었다.

| 오브젝트 | 그림 (col,row) | 행동 | 나오는 결함 |
|---|---|---|---|
| 레버 3 ↔ 철창 3 | platformer (4,3) / dungeon (7,5) | `clickable`의 `trigger`, `links`, `.s8-gate.triggered`가 42px 올라감 | `wiringSwap`, `noAction` ×3 |
| 광석 통 2 (한 쌍, 같은 속도·범위) | 소품 `barrel`, 레일 dungeon (7,6) | `patrol` | `bounceOnEnd` ×2 (`teleportOnEnd`는 과녁 전례로 제외) |
| 보물상자 3 + 금화 HUD | dungeon (5,7) | `pickup`, 재생성 6초 | `noPickup`·`noRespawn`·`counterSkew` 각 ×3 |
| 등불 2 | roguelike (54,7) | `glow`, 필수 아닌 `animate` | `offsetGlow` ×2 |
| 거미 2 (같은 그림) | dungeon (2,10) | `damage` | `noDamage` ×2 |
| 곡괭이 | dungeon (11,10) | 없음 | 없음 |

결함 19개(제외 후).

### 3년차 · 주방 (`stage09`) — CSS 조금

화덕 그림은 확인되지 않았다(처음 적은 roguelike (54,8)(55,8)은 화덕이 아니다). 불꽃은
stage03 촛불이 이미 쓰는 roguelike (54,7)을, 음식은 stage02가 이미 쓰는 고기·빵을 쓴다.
화구·냄비·손잡이·온도계·배식대는 자판기처럼 CSS로 그린다.

| 오브젝트 | 그림 | 행동 | 나오는 결함 |
|---|---|---|---|
| 손잡이 2 → 온도계 2 | CSS, 공용 `.eng-needle` | `clickable`로 `toggle`, `pressure`(초당 +30, 꺼지면 −15), `meter` | `invertMeter` ×2 (첫 등장), `noAction` ×2 |
| 불꽃 2 | roguelike (54,7) | `flagged`로 켜졌을 때만 보임, `glow` | `offsetGlow` ×2 |
| 냄비 2 | CSS | `flagged`, 불이 켜지면 끓음 | 없음 — 비교 단서 |
| 요리 3 + 주문 HUD | roguelike 고기 (54,15), 빵 (55,13) | `pickup`, 재생성 6초 | `noPickup`·`noRespawn`·`counterSkew` 각 ×3 |
| 손님 2 (같은 속도·범위) | actor `personA`·`personB` | `patrol` | `teleportOnEnd` ×2, `bounceOnEnd` ×2 |

결함 19개.
```

- [ ] **Step 2: ASSETS.md 적용 현황**

`docs/ASSETS.md`에서 `| 6 지하 기계실 | **적용 완료** |` 줄 다음에:

```markdown
| 8 광산 보물굴 (2년차) | **적용 완료** — dungeon 철창 (7,5)·레일 (7,6)·상자 (5,7)·거미 (2,10)·곡괭이 (11,10), platformer 레버 (4,3), roguelike 등불 (54,7), 소품 barrel |
| 9 주방 (3년차) | **적용 완료** — roguelike 불꽃 (54,7)·고기 (54,15)·빵 (55,13). 화구·냄비·손잡이·온도계·배식대는 CSS |
```

- [ ] **Step 3: 전체 검증**

Run: `npm run verify > /tmp/v5.txt 2>&1; echo "exit=$?"; grep -E "^FAIL|error TS" /tmp/v5.txt; npm run lint`
Expected: `exit=0`, `FAIL` 없음, lint 출력 없음

- [ ] **Step 4: 커밋·푸시·원격 확인**

```bash
git add docs/superpowers/specs/2026-09-15-years-and-new-builds-design.md docs/ASSETS.md
git commit -m "Correct the design's sprite table to the art that is actually there

The mine's carts were consoles and its skeleton a ghost; the kitchen's oven
was never found. The tables now name the cells that were checked on a grid.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin develop
git fetch origin && git rev-parse HEAD origin/develop
```

Expected: 두 해시가 같다
