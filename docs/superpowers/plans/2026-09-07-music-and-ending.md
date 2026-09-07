# 배경음악 · 결말 소리 · 보이는 설정 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 집·골목·큰길에서만 아주 작게 도는 배경음악을 넣고, 12일차 결말의 무음을 없애고, 설정을 눈에 띄게 만든다.

**Architecture:** 음악은 `src/audio/music.ts` 한 파일에 갇힌다 — 파일을 한 번 받아 `decodeAudioData`로 디코드하고 `AudioBufferSourceNode`(`loop = true`)로 돌린다. MP3를 `<audio loop>`로 돌리면 인코더 패딩 때문에 25초마다 공백이 생기는데, 버퍼 루프는 샘플 단위라 그게 없다. 게인 노드는 `sfx`의 마스터와 분리해 슬라이더 둘이 독립이 되게 한다. 어느 화면에 음악이 있어야 하는지는 `Office.tsx`가 `place`를 보고 `music.wants()`로 알린다.

**Tech Stack:** React 18 + TypeScript, Vite, WebAudio. **단위 테스트 프레임워크가 이 저장소에 없다** — jest/vitest를 새로 들이지 말 것. 검증은 `npm run verify`(tsx 스크립트) + 브라우저 확인이다.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-09-07-music-and-ending-design.md`
- 음원: [JRPG Piano](https://opengameart.org/content/jrpg-piano), 저자 **Joth**, **CC0**. 실측값 24.89초 · MPEG1 Layer III · 44100 Hz · 160 kbps · joint stereo · 501,990 바이트
- 음악이 울리는 곳은 `place`가 `"home"` / `"lane"` / `"street"`일 때 **뿐**이다. 사무실 층, 기기로 여는 빌드, 출시 화면, 개발용 화면은 전부 무음
- 음악 볼륨 기본값은 **0.3**. 효과음 기본값 1은 건드리지 않는다
- 페이드 **600ms**
- 로딩 화면은 음악을 기다리지 않는다 (`preloadArt`에 넣지 말 것)
- 지원 언어 5개 전부에 키가 있어야 한다: `en`, `ko`, `ja`, `zh-Hant`, `zh-Hans`
- 커밋 메시지는 영어 산문, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 커밋과 push는 함께. 브랜치는 `develop`

## 스펙에서 한 곳 바뀐다

스펙은 결말 소리를 `sleep()`의 `setShipped(true)` 앞에 넣으라고 했다. **거기서는 안 된다** — 평점 `rating`은 출시 화면 렌더 안에서 계산되고, 그 재료인 `stake`도 거기서 `WORK_DAYS.reduce(...)`로 만들어진다. `sleep()`에서 소리를 내려면 그 계산을 통째로 복제해야 하고, 복제한 순간 둘이 어긋날 수 있다.

대신 **이미 있는 `if (!runReported.current)` 블록**에 넣는다. 그 블록은 출시 화면에서 정확히 한 번 돌고, `rating`이 이미 스코프에 있다. Task 4가 그렇게 한다.

---

### Task 1: 음원을 저장소에 넣고 출처를 남긴다

**Files:**
- Create: `public/audio/jrpg-piano.mp3` (`C:/Users/anjsh/Downloads/JRPG Piano.mp3`에서 복사)
- Modify: `docs/ASSETS.md` (오디오 표 신설)

**Interfaces:**
- Consumes: 없음
- Produces: `/audio/jrpg-piano.mp3` 경로. Task 2가 이 경로를 상수로 쓴다.

- [ ] **Step 1: 파일을 옮기고 이름의 공백을 없앤다**

```bash
mkdir -p "public/audio"
cp "C:/Users/anjsh/Downloads/JRPG Piano.mp3" "public/audio/jrpg-piano.mp3"
ls -l public/audio/
```

Expected: `jrpg-piano.mp3`, 501990 바이트.

- [ ] **Step 2: 옮긴 파일이 원본과 같은지 확인한다**

```bash
node -e "
const fs=require('fs'),c=require('crypto');
const h=p=>c.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const a=h('C:/Users/anjsh/Downloads/JRPG Piano.mp3'), b=h('public/audio/jrpg-piano.mp3');
console.log(a); console.log(b); console.log(a===b?'MATCH':'DIFFERENT');
"
```

Expected: 두 해시가 같고 `MATCH`.

- [ ] **Step 3: 출처를 적는다**

`docs/ASSETS.md`의 **맨 끝**에 붙인다. 지금 문서에는 시각 에셋만 있으므로 오디오 절을 새로 연다.

```markdown

## 오디오

효과음은 파일이 아니라 `src/audio/sfx.ts`에서 WebAudio로 합성한다. 저장소에 있는
음원 파일은 배경음악 하나뿐이다.

| 파일 | 곡 | 제작자 | 라이선스 | 원본 링크 |
|---|---|---|---|---|
| `public/audio/jrpg-piano.mp3` | JRPG Piano | Joth | CC0 1.0 | https://opengameart.org/content/jrpg-piano |

24.89초 · MPEG1 Layer III · 44100 Hz · 160 kbps · joint stereo · 501,990 바이트.
받은 파일 이름의 공백만 없앴고 내용은 건드리지 않았다.

CC0라 표기 의무는 없지만 시각 에셋과 같은 이유로 남긴다.
```

- [ ] **Step 4: 커밋**

```bash
git add public/audio docs/ASSETS.md
git commit -m "$(cat <<'EOF'
Bring in the one piece of audio that is a file

Everything the game makes a noise with is synthesised in sfx.ts, which is
why the repository has no audio in it and says so. Background music is the
exception: twenty-five seconds of soft piano by Joth, CC0, from OpenGameArt.

Recorded in ASSETS.md beside the art for the same reason the art is recorded
there — CC0 asks for nothing, and a project should still be able to say
where its parts came from.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 2: `music.ts` — 받아서, 디코드하고, 이음매 없이 돌린다

**Files:**
- Create: `src/audio/music.ts`

**Interfaces:**
- Consumes: Task 1의 `/audio/jrpg-piano.mp3`
- Produces: `music` 싱글턴. Task 3(Office)과 Task 5(Settings)가 쓴다.
  - `music.wants(on: boolean): void`
  - `music.getVolume(): number` / `music.setVolume(v: number): void`
  - `music.isMuted(): boolean` / `music.setMuted(v: boolean): void`
  - `music.nudge(): void` — 사용자 조작이 있었으니 막혔던 재생을 다시 시도하라

- [ ] **Step 1: 파일을 만든다**

```typescript
/**
 * The background music: one short loop, kept quiet.
 *
 * Separate from sfx.ts on purpose. The cues there are synthesised on the
 * spot and last a fraction of a second; this is a file that is fetched,
 * decoded once, and then runs for the length of a working day. They share
 * nothing but the word "audio", and putting them in one file would make
 * both harder to read.
 *
 * It is decoded into a buffer rather than played from an <audio> tag,
 * because an MP3 cannot loop cleanly: the encoder pads the start and end of
 * the file, so every pass leaves a small gap. At twenty-five seconds that is
 * a gap every twenty-five seconds, and a gap is more noticeable than the
 * music when the music is meant to sit at the edge of hearing. A buffer
 * loops sample-accurately and has no seam.
 *
 * Its gain is its own node, not the one sfx.ts uses, so the two sliders in
 * the settings panel are actually independent.
 */

/** swapping the track is changing this line */
const TRACK = "/audio/jrpg-piano.mp3";

const VOL_KEY = "fb_music_vol";
const MUTE_KEY = "fb_music_muted";

/**
 * Quiet by default, which is the point.
 *
 * The effects default to full because a button that makes no sound reads as
 * broken. Music is the opposite: it is meant to be almost not there, so the
 * person who never opens the settings has to be the one hearing it as
 * intended.
 */
const DEFAULT_VOLUME = 0.3;

/** the loudest the music ever gets, before the slider divides it */
const FULL_GAIN = 0.5;

/** how long a room change takes to arrive or leave */
const FADE_MS = 600;

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

class Music {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  /** whether the screen we are on is one that has music */
  private wanted = false;
  private volume = readVolume();
  private muted = readMuted();

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  /**
   * All the way down is the same intent as off, so it is the same state —
   * the settings panel must not be able to disagree with itself about
   * whether the game is making a sound.
   */
  setVolume(next: number) {
    this.volume = Math.min(1, Math.max(0, next));
    try {
      localStorage.setItem(VOL_KEY, String(this.volume));
    } catch {
      /* private browsing — it just will not persist */
    }
    if (this.volume > 0 && this.muted) this.setMuted(false);
    else this.apply();
  }

  setMuted(next: boolean) {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* private browsing */
    }
    this.apply();
  }

  private target(): number {
    return this.muted || !this.wanted ? 0 : FULL_GAIN * this.volume;
  }

  /** ramp to wherever we should be, over the fade */
  private apply() {
    if (!this.ctx || !this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(this.target(), now + FADE_MS / 1000);
  }

  /**
   * Which screen we are on. Called on every room change; doing nothing when
   * the answer has not changed is what keeps it cheap enough for that.
   */
  wants(on: boolean) {
    if (on === this.wanted) return;
    this.wanted = on;
    if (on) void this.start();
    else this.apply();
  }

  /**
   * A user gesture happened, so a play that the browser refused can be tried
   * again. Silent and cheap when there is nothing to retry.
   */
  nudge() {
    if (this.wanted && !this.source) void this.start();
    else if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private async load(): Promise<void> {
    if (this.buffer || !this.ctx) return;
    if (!this.loading) {
      const ctx = this.ctx;
      this.loading = (async () => {
        const res = await fetch(TRACK);
        if (!res.ok) throw new Error(`music: ${res.status}`);
        this.buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      })();
    }
    await this.loading;
  }

  /**
   * Start, if the browser will let us.
   *
   * Audio before a user gesture is refused, and the music wants to begin in
   * a bedroom nobody has clicked on yet. A refusal is an ordinary outcome
   * here, not an error: it leaves everything in place and waits for nudge().
   */
  private async start(): Promise<void> {
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        this.ctx = ctx;
        this.gain = gain;
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      await this.load();
      // the room may have changed again while the file was arriving
      if (!this.wanted || !this.buffer || !this.gain || this.source) {
        this.apply();
        return;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      source.connect(this.gain);
      source.start();
      this.source = source;
      this.apply();
    } catch {
      /* no audio, or the browser said not yet. nudge() tries again. */
    }
  }
}

export const music = new Music();
```

- [ ] **Step 2: 타입과 린트를 통과시킨다**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 출력 없이 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/audio/music.ts
git commit -m "$(cat <<'EOF'
Loop the music in a buffer, where there is no seam to hear

An MP3 will not loop cleanly. The encoder pads the head and tail of the
file, so an <audio loop> tag leaves a small silence on every pass — every
twenty-five seconds, for this track. That gap is the one thing louder than
the music itself when the music is meant to sit at the edge of hearing: on a
quiet bed, stopping is what gets noticed. Decoded into a buffer and looped
there, it is sample-accurate and there is nothing to hear.

Its own gain node rather than the one sfx.ts owns, so the two sliders that
are about to appear in the settings panel are independent for real and not
just on screen.

Being refused by the browser is an ordinary outcome rather than a failure.
The music wants to start in a bedroom nobody has clicked yet, so start()
leaves everything standing and nudge() tries again on the first gesture,
which in practice is the button on the morning card.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 3: 어느 방에 음악이 있는지 Office가 알린다

**Files:**
- Modify: `src/office/Office.tsx` (21번 줄 근처의 import, 그리고 `place` 상태 아래)

**Interfaces:**
- Consumes: Task 2의 `music.wants(on)`, `music.nudge()`
- Produces: 없음

- [ ] **Step 1: import를 추가한다**

현재 21번 줄:

```tsx
import { sfx } from "../audio/sfx";
```

이렇게 바꾼다:

```tsx
import { sfx } from "../audio/sfx";
import { music } from "../audio/music";
```

- [ ] **Step 2: `place`가 바뀔 때마다 음악에 알린다**

`const [place, setPlace] = useState<Place>(START_PLACE);` 바로 **아래**에 넣는다.

```tsx
  /*
   * Music belongs to the parts of the day that are not work.
   *
   * The walk and the flat have it; the floor and the builds opened from it
   * do not. Looking for a defect means watching for something that stopped
   * moving or a sound that did not come, and a tune over the top of that is
   * the game arguing with its own subject. The builds need no case of their
   * own — they are opened while place is "office", so they are already
   * silent, and so is the shipping screen, which is why the last cue of the
   * run lands in the clear.
   */
  useEffect(() => {
    music.wants(place === "home" || place === "lane" || place === "street");
  }, [place]);

  /*
   * The first sound a browser allows is one that follows a press. The music
   * wants to start in a bedroom nobody has touched, so it asks again after
   * anything the player does.
   */
  useEffect(() => {
    const wake = () => music.nudge();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);
```

- [ ] **Step 3: 타입과 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 통과.

- [ ] **Step 4: 장소별로 실제 확인**

개발 서버를 띄운다(`.claude/launch.json`의 `find-bug-dev`). 각 주소를 열고, 화면을 한 번 클릭해 브라우저 차단을 푼 뒤 콘솔에서 확인한다.

```javascript
// 각 place에서 실행. 지금 소리가 나야 하는 상태인지를 gain으로 읽는다.
const m = await import('/src/audio/music.ts');
JSON.stringify({ vol: m.music.getVolume(), muted: m.music.isMuted() })
```

귀로 듣는 것은 실행자가 못 하는 확인이다. **관측 가능한 신호는 음원 요청**이다 —
음악이 필요한 화면에서만 `/audio/jrpg-piano.mp3`를 받아온다. 브라우저의 네트워크
기록으로 본다.

각 주소를 새로 열고(캐시가 아니라 새 로드여야 한다) 화면을 한 번 클릭한 뒤, 네트워크
요청에 `jrpg-piano.mp3`가 있는지 확인한다:

| 주소 | `jrpg-piano.mp3` 요청 |
|---|---|
| `?day=1&place=home` | **있어야 함** |
| `?day=1&place=lane` | **있어야 함** |
| `?day=1&place=street` | **있어야 함** |
| `?day=1&place=office` | **없어야 함** |

사무실에서 요청이 잡히면 실패다. 소리 크기와 곡이 어울리는지는 사용자에게 들려주고
확인받는다.

- [ ] **Step 5: 루프 이음매 확인**

집에서 **60초 이상** 그대로 둔다. 트랙이 24.89초이므로 두 번 이상 넘어간다. 넘어가는 지점에 끊김이나 딸깍 소리가 없어야 한다.

- [ ] **Step 6: 커밋**

```bash
git add src/office/Office.tsx
git commit -m "$(cat <<'EOF'
Let the music belong to the half of the day that is not work

The walk and the flat have it, the floor does not, and neither do the builds
opened from the floor. Inspecting one means watching for the thing that
stopped moving and listening for the cue that did not come; music over that
is the game talking through its own subject. The builds need no rule of
their own — they open while place is "office" and are silent by inheritance,
and so is the shipping screen, which is how the last sound of the run gets a
clear field.

The retry on the first press is there because the music wants to start in a
bedroom nobody has clicked on, and browsers refuse audio until somebody has.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 4: 결말에 소리를 준다

**Files:**
- Modify: `src/office/Office.tsx` (출시 화면의 `if (!runReported.current)` 블록)

**Interfaces:**
- Consumes: 이미 스코프에 있는 `rating` (`shipRating(shipped_, late, stake)`의 결과, 0~5)
- Produces: 없음

- [ ] **Step 1: 지금 그 자리가 조용한지 확인한다**

```bash
sed -n '/if (!runReported.current) {/,/}/p' src/office/Office.tsx
```

Expected: `runReported.current = true;`, `reportRun(...)`, `syncBook(...)` 세 줄뿐이고 `sfx.play`가 없다.

- [ ] **Step 2: 평점에 따라 소리를 낸다**

현재:

```tsx
    if (!runReported.current) {
      runReported.current = true;
      void reportRun(connected ? server : null, rating);
      void syncBook(server);
    }
```

이렇게 바꾼다:

```tsx
    if (!runReported.current) {
      runReported.current = true;
      /*
       * Twelve days end here, and until now they ended in silence: sleep()
       * returns before its own click on the last night, and this screen
       * played nothing. It is the one moment in the run that is only a
       * result, so it gets a sound — and a different one either way, because
       * the same noise for a build that shipped clean and one that shipped
       * broken is a page turning, not an answer.
       *
       * It lives here rather than in sleep() because this is where the
       * rating exists. Computing it early would mean copying the stake sum
       * out of the render, and two copies of that can disagree.
       */
      sfx.play(rating >= 3 ? "success" : "fail");
      void reportRun(connected ? server : null, rating);
      void syncBook(server);
    }
```

- [ ] **Step 3: 타입과 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 통과.

- [ ] **Step 4: 결말을 실제로 들어본다**

개발 서버에서 마지막 날 저녁으로 점프해 침대로 간다.

```
http://localhost:5173/?day=12&place=home&at=1900
```

침대에 걸어가 잠들면 출시 화면이 뜬다. **소리가 나야 한다.** 별점이 3 이상이면 올라가는 아르페지오(`success`), 미만이면 떨어지는 버즈(`fail`).

같은 화면에서 새로고침해 두 번 소리가 나지 않는 것도 확인한다 — `runReported`가 막아야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/office/Office.tsx
git commit -m "$(cat <<'EOF'
Give the end of the run a sound, and let it say which end it was

Every night of the run made a noise going to bed except the last one:
sleep() returns on day twelve before reaching its own click, and the screen
it hands over to played nothing. Twelve days of deciding what was worth
looking at resolved in silence.

It is one line, and it is two lines' worth of decision: the same sound for a
clean ship and a broken one would be a page turning rather than an answer,
so the rating picks which. Three out of five is the line.

In the render's once-guard rather than in sleep(), because that is where the
rating exists — the stake it is a share of is summed there. Reaching for it
early would mean a second copy of that sum, and two copies can disagree
about what the run was worth.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

### Task 5: 음악 슬라이더와 눈에 띄는 설정

**Files:**
- Modify: `src/i18n/en.json`, `ko.json`, `ja.json`, `zh-Hant.json`, `zh-Hans.json` (`settings.music` 추가)
- Modify: `src/components/Settings.tsx` (음악 줄)
- Modify: `src/App.css` (기어 버튼, 패널 폭·라벨)

**Interfaces:**
- Consumes: Task 2의 `music.getVolume()`, `music.setVolume()`, `music.isMuted()`, `music.setMuted()`
- Produces: 없음 (마지막 작업)

- [ ] **Step 1: `settings.music`을 5개 언어에 넣는다**

스크래치패드에 스크립트를 만들어 실행한다(JSON을 손으로 편집하지 말 것 — 줄 끝과 인코딩이 깨진다).

```javascript
// scratchpad/musickey.mjs
import { readFileSync, writeFileSync } from "fs";
const ROOT = "C:/Users/anjsh/OneDrive/Desktop/Find bug";

const COPY = {
  en: "Music",
  ko: "음악",
  ja: "音楽",
  "zh-Hant": "音樂",
  "zh-Hans": "音乐",
};

for (const [lang, value] of Object.entries(COPY)) {
  const path = `${ROOT}/src/i18n/${lang}.json`;
  const raw = readFileSync(path, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const out = [];
  let added = false;
  for (const line of raw.split(eol)) {
    out.push(line);
    const m = line.match(/^(\s*)"settings\.sound":/);
    if (m) {
      out.push(`${m[1]}"settings.music": ${JSON.stringify(value)},`);
      added = true;
    }
  }
  if (!added) { console.error(`${lang}: anchor not found`); process.exit(1); }
  const text = out.join(eol);
  const parsed = JSON.parse(text);
  if (parsed["settings.music"] !== value) { console.error(`${lang}: did not land`); process.exit(1); }
  writeFileSync(path, text);
  console.log(`${lang}: ok, ${Object.keys(parsed).length} keys`);
}
```

Run: `node <scratchpad>/musickey.mjs`
Expected: 5줄 모두 `ok`, 키 개수가 언어마다 같음.

- [ ] **Step 2: 5개 언어가 채워졌는지 검사가 확인하게 한다**

Run: `npm run verify 2>&1 | grep -E "translated|^FAIL"`
Expected: `PASS  ko: N/N translated` 형태로 4줄, N이 이전보다 1 큼. FAIL 없음.

- [ ] **Step 3: Settings에 음악 상태를 들인다**

`src/components/Settings.tsx`에서 두 곳을 바꾼다.

import에 추가:

```tsx
import { music } from "../audio/music";
```

`const [vol, setVol] = useState(() => sfx.getVolume());` 바로 아래에 추가:

```tsx
  const [mvol, setMvol] = useState(() => music.getVolume());
  const [mmuted, setMmuted] = useState(() => music.isMuted());
  /* the same rule the effects use: all the way down is off */
  const mSilent = mmuted || mvol === 0;
```

- [ ] **Step 4: 음악 줄을 그린다**

소리 블록이 끝나는 `</div>` **바로 뒤**, 상점 줄(`<Suspense>`)보다 **앞**에 넣는다. 그래야 패널 순서가 언어 · 소리 · 음악 · 상점 · 기록이 된다. `settings.data` 앞에 넣으면 상점 줄 뒤로 밀린다.

찾을 앵커는 이 주석이다:

```tsx
          {/* nothing rendered until it arrives; it is one row in a panel and
              a spinner for it would be louder than the row */}
          <Suspense fallback={null}>
```

이 주석 **위**에 아래를 넣는다.

```tsx
          <label>
            {t("settings.music")}
            <b>{mSilent ? "—" : `${Math.round(mvol * 100)}%`}</b>
          </label>
          <div className="settings-sound">
            <button
              className={`settings-mute ${mSilent ? "off" : ""}`}
              aria-pressed={mSilent}
              title={mSilent ? t("sound.on") : t("sound.off")}
              onClick={() => {
                // pressing the speaker while the slider is at nothing has to
                // bring the music back, not toggle a flag nobody can hear
                if (mSilent) {
                  if (mvol === 0) {
                    music.setVolume(0.3);
                    setMvol(0.3);
                  }
                  music.setMuted(false);
                  setMmuted(false);
                  sfx.play("click");
                  return;
                }
                music.setMuted(true);
                setMmuted(true);
              }}
            >
              {mSilent ? <SpeakerMutedIcon /> : <SpeakerIcon />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(mvol * 100)}
              aria-label={t("settings.music")}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                music.setVolume(next);
                setMvol(next);
                setMmuted(music.isMuted());
              }}
            />
          </div>
```

- [ ] **Step 5: 기어 버튼과 패널을 보이게 만든다**

`src/App.css`에서 세 곳.

`.settings-btn`의 쉬는 상태(42번 줄 근처):

```css
.settings-btn {
  opacity: 0.5;
  transition: opacity 0.15s;
}
```

이렇게 바꾼다:

```css
/*
 * Faint, but not invisible.
 *
 * Half opacity was the resting state and full only arrived on hover — and
 * the note above already knew what that costs on a phone, where hover never
 * comes. So the resting state carries most of the way, and a chip behind it
 * keeps it legible over a floor that is sometimes wood and sometimes tarmac.
 */
.settings-btn {
  opacity: 0.85;
  transition: opacity 0.15s;
  background: rgba(20, 22, 30, 0.7);
  border: 1px solid #556;
  border-radius: 6px;
}
```

`.settings-panel`의 폭:

```css
  width: 186px;
```

이렇게 바꾼다:

```css
  width: 210px;
```

`.settings-panel label`의 글자 크기:

```css
.settings-panel label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 1px;
  color: #7e879a;
}
```

이렇게 바꾼다:

```css
.settings-panel label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  letter-spacing: 1px;
  color: #98a1b4;
}
```

- [ ] **Step 6: 타입과 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 통과.

- [ ] **Step 7: 두 슬라이더가 독립인지 확인**

개발 서버에서 `?day=1&place=home`을 열고 기어를 눌러 패널을 연다.

```javascript
// 음악만 0으로 내려도 효과음은 그대로여야 한다
const m = await import('/src/audio/music.ts');
const s = await import('/src/audio/sfx.ts');
m.music.setVolume(0);
JSON.stringify({ musicVol: m.music.getVolume(), sfxVol: s.sfx.getVolume(), sfxMuted: s.sfx.isMuted() })
```

Expected: `musicVol` 0, `sfxVol`은 1 그대로, `sfxMuted` false.

반대도 확인한다:

```javascript
const m = await import('/src/audio/music.ts');
const s = await import('/src/audio/sfx.ts');
s.sfx.setMuted(true);
JSON.stringify({ musicVol: m.music.getVolume(), musicMuted: m.music.isMuted() })
```

Expected: 음악 쪽은 안 변함.

끝나면 되돌린다:

```javascript
localStorage.removeItem('fb_music_vol');
localStorage.removeItem('fb_music_muted');
localStorage.removeItem('fb_muted');
```

- [ ] **Step 8: 기본값이 30%인지 확인**

```javascript
['fb_music_vol','fb_music_muted'].forEach(k=>localStorage.removeItem(k));
location.reload();
```

새로고침 뒤 패널을 열어 음악 줄이 **30%**로 시작하는지 본다.

- [ ] **Step 9: 눈으로 확인**

패널을 열어 다섯 구획(언어 · 소리 · 음악 · 상점 · 기록)이 210px 안에서 겹치거나 줄바꿈으로 깨지지 않는지 본다. 기어 버튼이 바닥 위에서 읽히는지도 본다.

- [ ] **Step 10: 전체 검사와 커밋**

Run: `npm run verify && npm run build`
Expected: FAIL 줄 없음, 빌드 성공.

```bash
git add src/i18n src/components/Settings.tsx src/App.css
git commit -m "$(cat <<'EOF'
Two sliders, and a gear you can see without hovering

Music gets its own control rather than riding the one the effects use.
Wanting the tune off and the cues on is the ordinary request, and it is
more ordinary here than most: the effects are not decoration in this game,
they are how a build tells you it was judged.

The gear was faint on purpose and the comment above it had already written
down the flaw — the fade only lifted on hover, "which on a phone is never".
So the resting state carries most of the way now and sits on a chip, which
also stops it disappearing into a floor that changes colour between rooms.
The panel gained a fifth section today and needed the width and a legible
label size to hold it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push origin develop
```

---

## 확인이 끝난 뒤

배포는 사용자가 직접 한다. 빌드 명령만 전달할 것:

- 개발도구 켠 빌드: `npm run build && npx -y @agent8/deploy`
- 릴리스 빌드: `npm run build:release && npx -y @agent8/deploy`
