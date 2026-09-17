# 직급 칭호 — 설계

날짜: 2026-09-17
선행: `2026-09-17-codex-mastery-design.md`, `2026-09-17-trophy-shelf-design.md`

## 1. 목적

숙련한 빌드 수를 직급으로 보여 준다. 보상은 표시뿐이다. 밸런스, 저장, 서버는 바꾸지 않는다. 랜덤 요소도 없다.

## 2. 직급

| 숙련 수 | 직급 | 키 |
|---|---|---|
| 0 | 신입 QA | `rank.0` |
| 1–2 | 주니어 QA | `rank.1` |
| 3–5 | 시니어 QA | `rank.2` |
| 6–8 | 리드 QA | `rank.3` |
| 9 | QA 팀장 | `rank.4` |

- 경계값은 `RANK_STEPS = [0, 1, 3, 6, 9]`이다.
- 숙련 수는 Office가 이미 계산한 `mastered.length`다. 이번 연차에 열린 빌드만 센다.

## 3. 표시

- **수첩 맨 위:** 숙련 줄을 "시니어 QA · 숙련 빌드 3/9"로 바꾼다. 직급 이름 뒤에 ` · `를 붙이고 기존 `mastery.tally`를 이어 쓴다.
- **첫 아침 (2년차부터):** 연차 문구와 새 빌드 문구 다음, 숙련 문구 앞에 `rank.morning`("직급: {rank}.")을 넣는다.
- **출시 화면:** `rankOf(현재 숙련 수) > rankOf(masteredAtStart.length)`이면 숙련 줄 아래에 `rank.promoted`("승진: {from} → {to}")를 띄운다.
- **개발자 첫인사** (`firstTalk`):
  - 신입: `office.dev.intro` (지금과 같음)
  - 주니어: `office.dev.introRank1` — "또 너구나. 빌드 네 개 올려놨어."
  - 시니어·리드: `office.dev.introRank2` — "왔네. 네가 보면 안심이야. 빌드 네 개 올려놨어."
  - 팀장: `office.dev.introRank3` — "팀장님 오셨네. 오늘 것도 부탁해."

## 4. 구조

- `src/office/rank.ts`(새 파일): `RANK_STEPS`, `rankOf(count): number`, `rankKey(rank): string`
- `src/office/devlines.ts`: `DevTalk.rank: number`, `firstTalk` 분기에서 직급별 인사를 고른다. `devKeys()`에 인사 3개를 추가한다.
- `src/office/Office.tsx`: 수첩, 첫 아침, 출시 화면, 개발자 대사 호출
- i18n 5개 언어: `rank.0`–`rank.4`, `rank.morning`, `rank.promoted`, `office.dev.introRank1`–`3`

## 5. 검사

- `scripts/checkrank.ts` (verify에 추가)
  - `rankOf`의 경계값: 0→0, 1→1, 2→1, 3→2, 5→2, 6→3, 8→3, 9→4
  - 모든 직급 키가 5개 언어에 있다.
  - 소스 검사: Office가 `devLine`에 `rank`를 넘기고, `rank.promoted`와 `rank.morning`을 쓴다.
- `scripts/checki18n.ts`: 직급별 첫인사 선택(신입/주니어/시니어/리드/팀장), 첫인사가 아니면 직급이 대사에 영향을 주지 않는다.
