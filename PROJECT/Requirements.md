# Requirements — find-the-bug

## Coding Patterns

- 함수 컴포넌트와 훅만. 클래스 컴포넌트 없음.
- 스타일은 손으로 쓴 CSS. **Tailwind를 도입하지 않는다** — 지금 CSS가 그렇게 되어 있다.
- 이미지 URL은 `src/assets.json`에 등록하고 하드코딩하지 않는다.
- 새 결함은 **씬을 고쳐서** 만든다. mutator와 물체가 교차해 풀이 생기므로,
  결함을 손으로 적어 넣는 자리는 없다. 빼는 것만 `engine/exclusions.ts`에서 한다.
- 새 씬은 `SceneSpec` 데이터로 쓰고 `stages/registry.ts`에 등록한다.
  `stage04`처럼 컴포넌트로 가는 것은 데이터 모델로 안 되는 규칙일 때뿐이다.
- 문자열은 전부 i18n 키. 5개 언어 전부 채워야 `npm run verify`가 통과한다.

## Invariants

- **React 18 고정.** `@agent8/gameserver@1.10.2`의 peer가 `react@^18.2.0`이다.
- **`vite.config.ts`의 `dedupe` / `optimizeDeps` 블록을 지우지 않는다.**
  지우면 개발 서버에서 `Invalid hook call`이 난다.
- **`server.js`의 클래스는 export하지 않는다.** 플랫폼이 이름으로 집어간다.
- **판정은 물체 + 분류 둘 다.** 어느 쪽이 틀렸는지 플레이어에게 보이지 않는다
  (`core/judge.ts`).
- **수첩은 병합만.** 잡은 것이 못 잡은 것으로 되돌아가지 않는다 — 서버·클라이언트 양쪽.
- **서버 없이도 게임이 돈다.** `net/save.ts`의 모든 호출은 조용히 실패해도 된다.
- 스테이지 풀이 `MIN_POOL`(3) 밑으로 떨어지면 `npm run verify`가 실패한다.

## Commands

```bash
npm run verify        # 커리큘럼 · 씬 · 런타임 · i18n · 퀘스트 · 카테고리 회귀
npm run lint          # oxlint, 경고 0이 정상
npm run typecheck     # tsc -b
npm run report        # docs/bug-review.{md,json,html} 재생성
npm run build         # 개발용 화면이 살아 있는 빌드
npm run build:release # 실제로 나가는 빌드 (.env.release가 DEV_TOOLS를 끈다)
```

씬·mutator·점수·커리큘럼을 건드렸으면 `npm run report`를 같이 돌려
`docs/bug-review.*`를 커밋한다. 안 그러면 검수 목록이 코드보다 뒤처진다.

## Known Issues / Constraints

- 배포본에 `VITE_DEV_TOOLS=1`이 **일부러** 켜져 있다. 켜진 빌드는 우상단에 `DEBUG`
  표를 단다. 실제 출시는 `npm run build:release`.
- 개발용 화면 셋은 지연 청크로 릴리스 번들에도 **파일은 남는다.** 런타임에서
  절대 요청되지 않으므로 받아지지는 않는다.
- 결제는 `remove-ads` 하나뿐이고, **게임 내 돈이나 진행을 파는 상품은 넣지 않는다.**
  이유는 `docs/MONETIZATION.md`.
- 광고와 구매는 `grantFree()` 한 곳에서 지급한다. 두 경로가 서로 다른 보상으로
  갈라지면 파는 것이 마찰이 아니라 힘이 된다.
- 광고는 보상형 두 자리뿐이고 둘 다 없어도 게임이 성립해야 한다.
- `remove-ads`는 Verse8 대시보드에 **평생 1회 제한**으로 등록해야 한다. 등록 전에는
  상점 줄이 아예 뜨지 않는다.
