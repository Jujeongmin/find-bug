# Verse8 배포

## 프로젝트 구조

Verse8(Agent8) 공식 문서 구조를 따른다.

```
find-the-bug/
├── src/              # React 클라이언트
│   ├── main.tsx      # GameServerProvider로 App을 감싼다
│   ├── App.tsx       # 로딩 화면 · 언어 · 개발용 화면 분기
│   ├── office/       # 하루 루프 (사무실 · 결함 수첩 · 이벤트 · 평점)
│   ├── street/       # 출퇴근 · 행인 · 포장마차, home/ 은 집
│   ├── engine/       # 씬 엔진 · mutator · 점수 · 커리큘럼
│   ├── stages/       # 씬 데이터 (stage01~07, stage04는 수기)
│   ├── core/         # 판정
│   ├── net/          # 서버 연동 (save.ts) · 광고 (ads.ts)
│   ├── debug/ repro/ regression/   # 개발용 화면 셋, 지연 로딩
│   ├── components/
│   ├── i18n/
│   └── styles/
├── public/
│   └── assets/       # 스프라이트 시트 (CC0, docs/ASSETS.md 참고)
├── server.js         # Agent8 서버 클래스 (루트, export 하지 않음)
├── package.json
└── .env              # 배포 시 VITE_AGENT8_VERSE 자동 생성
```

## 배포 절차

**이 프로젝트는 플랫폼이 git에서 직접 빌드한다.** push하면 Verse8이 그 커밋을
받아 `npm run build`를 돌리고 결과를 올린다. 손으로 할 일이 없다.

확인한 근거: 배포된 페이지의 iframe 주소에 커밋 SHA가 박혀 있는데
(`?sha=7c96bf65...`) `@agent8/deploy` CLI는 git을 전혀 모른다. push 1분 41초 뒤에
빌드가 돌았고(`buildAt`), CLI가 성공했으면 남겼을 `.deployed` 파일이 프로젝트에
없다.

**따라서 로컬에서 `npm run build:release`를 해도 배포본은 안 바뀐다.** 플랫폼은
`build:release`를 모르고 `build`만 돌린다. 개발도구를 끄고 켜는 것은
`.env`의 `VITE_DEV_TOOLS`이고, 그 파일이 `build`가 읽는 파일이다.

CLI로 직접 올려야 할 때만:

```bash
npm install
npm run build        # 또는 build:release
npx -y @agent8/deploy
```

`@agent8/deploy`는 빌드하지 않는다 — `dist/`에 있는 것을 올릴 뿐이고, 해시가 같은
파일은 건너뛴다(`--prod`로 강제 전체 업로드). `server.js`도 같이 올라간다.
서버 함수만 따로 확인하려면:

```bash
npx -y @agent8/cli call ping '[]'
```

## 서버 (`server.js`)

문서 규칙대로 **클래스를 정의만 하고 export 하지 않는다.** 게임 로직은 전부
클라이언트에서 돌고, 서버는 **회차 바깥까지 남는 것**만 보관한다 — 결함 수첩과
최고 평점. 하루·시간·컨디션·돈은 회차와 함께 사라지므로 올라가지 않는다.

| 함수 | 설명 |
|---|---|
| `syncBook(incoming)` | 결함 수첩을 양방향으로 병합하고 합집합을 돌려준다. `caught`는 `missed`를 항상 이기므로 나중 쓰기가 앞선 기록을 지우지 않는다 |
| `reportRun(rating)` | 회차가 끝날 때의 평점. 최고 기록과 회차 수만 남긴다 |
| `resetSave()` | 본인 기록 초기화. **구매는 지우지 않는다** |
| `getEntitlements()` | 이 계정이 산 것 조회 (`{ adsRemoved }`) |
| `$onItemPurchased(...)` | VXShop이 결제 완료 시 호출. 알 수 없는 productId는 거부한다 |

저장은 `$global.updateMyState()`, 조회는 `$global.getMyState()`를 쓴다.

## 클라이언트 연동

[src/net/save.ts](../src/net/save.ts) 한 곳에서만 서버를 만진다.

- 수첩은 **localStorage가 원본**이고, 서버가 붙으면 그쪽에도 병합해 둔다
- 접속 시 양쪽을 **합집합으로 병합**한다. 잡은 것은 못 잡은 것으로 돌아가지 않으므로
  어느 쪽이 최신인지 따질 필요가 없다
- 서버가 없거나 실패해도 게임은 그대로 돌아간다 (`npm run dev` 로컬 실행 포함)

이 구조라서 verse8 밖에서도 테스트할 수 있고, verse8 위에서는 기기가 바뀌어도
수첩이 따라온다.

## Vite 설정 주의

[vite.config.ts](../vite.config.ts)에 두 가지가 들어가 있다. 지우면 개발 서버에서
`Invalid hook call`이 난다.

```ts
resolve: { dedupe: ["react", "react-dom"] },
optimizeDeps: {
  include: ["@agent8/gameserver", "react", "react-dom", "react/jsx-runtime"],
},
```

SDK와 앱이 서로 다른 React 사본을 잡으면 훅이 깨진다. SDK를 `exclude` 하면
CJS 의존성(`lz4js`)이 로드되지 않으니 **제외가 아니라 함께 포함**해야 한다.

프로덕션 빌드(`npm run build`)는 이 설정 없이도 문제가 없었지만, 개발 환경을
맞춰두는 편이 안전하다.

## React 버전 고정

`@agent8/gameserver@1.10.2`의 peerDependency가 `react@^18.2.0`이라 **React 18에
고정**돼 있다. React 19로 올리면 설치가 실패한다.

## VXShop 상품 등록

코드는 붙어 있지만 상품은 **Verse8 대시보드에서 직접 등록해야 한다.** 등록 전에는
설정 패널의 상점 줄이 뜨지 않는다.

Product ID는 `remove-ads`, 구매 제한은 **평생 1회**. 자세한 건 [MONETIZATION.md](MONETIZATION.md).

## 배포 전 확인

```bash
npm run verify   # 커리큘럼 · 씬 · 런타임 회귀 테스트
npm run build    # 타입 체크 + 번들
npm run preview  # 프로덕션 번들 로컬 확인
```

## 출시 전 한 가지

지금은 **테스트용 화면이 배포본에도 들어간다.** 만드는 중이라 일부러 그렇게 해뒀다 —
서버에 올라간 사본이 확인할 값어치가 있는 사본이고, 켜는 걸 기억해야 하는 스위치는
잊어버리기 때문이다.

`.env`의 `VITE_DEV_TOOLS=1`이 그 스위치다. 켜져 있으면 이것들이 산다.

| 주소 | 하는 일 |
|---|---|
| `?debug` | 빌드 7개 · 결함 115개 목록. 누르면 그 결함이 심긴 채로 열린다 |
| `?playtest=1` | 지금 심긴 결함의 정답을 화면에 띄운다. 광고는 1.2초 스텁 |
| `?day=N` `?place=office\|street` `?at=HHMM` | 원하는 날 · 장소 · 시각에서 시작 |
| `?lab` `?repro` | 접어둔 시제품 둘 |

**끄는 것은 `.env`의 `VITE_DEV_TOOLS=0`이다.** 플랫폼이 `npm run build`를 돌리고
그 명령이 읽는 파일이 `.env`이므로, 여기가 실제로 효력이 있는 유일한 자리다.

`.env.release`와 `npm run build:release`는 CLI로 손수 올릴 때만 쓰인다. 한동안
이것이 출시용 경로라고 적혀 있었는데, 플랫폼 빌드에는 닿지 않으므로 틀린 말이었다.

개발 서버는 영향을 받지 않는다 — `import.meta.env.DEV`가 도구를 켜므로
`npm run dev`에서는 `VITE_DEV_TOOLS`와 무관하게 전부 살아 있다.

켜진 채로 빌드하면 **모든 화면 우상단에 `DEBUG` 표가 붙는다.** 개발 서버에는 안 붙는다 —
거기서는 그게 정상이라 표가 잡음이다. 배포한 화면에 저게 보이면 잘못 빌드한 것이다.
