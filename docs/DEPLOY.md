# Verse8 배포

## 프로젝트 구조

Verse8(Agent8) 공식 문서 구조를 따른다.

```
find-the-bug/
├── src/              # React 클라이언트
│   ├── main.tsx      # GameServerProvider로 App을 감싼다
│   ├── App.tsx
│   ├── engine/       # 씬 엔진 · mutator · 커리큘럼
│   ├── stages/       # 씬 데이터
│   ├── net/          # 서버 연동 훅
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

```bash
npm install
npm run build
npx -y @agent8/deploy
```

`@agent8/deploy`가 `server.js`를 업로드하고 `.env`에 `VITE_AGENT8_VERSE`를 넣어준다.
서버 함수만 따로 확인하려면:

```bash
npx -y @agent8/cli call ping '[]'
```

## 서버 (`server.js`)

문서 규칙대로 **클래스를 정의만 하고 export 하지 않는다.** 게임 로직은 전부
클라이언트에서 돌고, 서버는 플레이어의 검증 완료 스테이지 번호만 보관한다.

| 함수 | 설명 |
|---|---|
| `ping()` | 연결 확인 |
| `getProgress()` | 저장된 진행도 조회 |
| `reportClear(stageNo)` | 클리어 기록. 값은 **앞으로만** 이동하므로 오래된 클라이언트가 진행도를 되돌릴 수 없다 |
| `resetProgress()` | 본인 기록 초기화 |

저장은 `$global.updateMyState()`, 조회는 `$global.getMyState()`를 쓴다.

## 클라이언트 연동

[src/net/useProgress.ts](../src/net/useProgress.ts) 한 곳에서만 서버를 만진다.

- 진행도는 **localStorage에 항상 저장**되고, 서버가 붙으면 그쪽에도 기록한다
- 접속 시 서버 값과 로컬 값 중 **큰 쪽을 채택**하고, 로컬이 앞서면 서버로 밀어 올린다
- 서버가 없거나 실패해도 게임은 그대로 돌아간다 (`npm run dev` 로컬 실행 포함)

이 구조라서 verse8 밖에서도 테스트할 수 있고, verse8 위에서는 기기가 바뀌어도
진행도가 따라온다.

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

## 배포 전 확인

```bash
npm run verify   # 커리큘럼 · 씬 · 런타임 회귀 테스트
npm run build    # 타입 체크 + 번들
npm run preview  # 프로덕션 번들 로컬 확인
```

## 개발용 플래그

`?playtest=1`을 붙이면 30스테이지 전체 해금 + 정답 공개 + 버그 재추첨이 켜진다.
**배포 후 공개 URL에서도 동작하므로**, 정식 공개 전에 제거할지 판단할 것
(제거하려면 [src/App.tsx](../src/App.tsx)의 `PLAYTEST` 상수를 `false`로 고정).
