/**
 * Tiny synthesised sound set.
 *
 * Everything is generated with WebAudio rather than shipped as files: the cues
 * are short retro blips that suit the pixel art, and it keeps the bundle free
 * of audio assets and licence bookkeeping. If sampled SFX are wanted later,
 * swap the bodies of the cue functions — callers only use `sfx.play("...")`.
 *
 * Browsers block audio until a user gesture, so the context is created lazily
 * on the first cue and resumed if it starts suspended.
 */

export type Cue = "click" | "pick" | "success" | "fail" | "death";

const MUTE_KEY = "fb_muted";
const VOL_KEY = "fb_vol";

/*
 * The loudest the game ever gets.
 *
 * The master gain was a literal 0.25 written in two places, and mute was the
 * only control over it — on, or off. A slider needs a ceiling to be a
 * fraction of, and both places need to be reading the same one.
 */
const FULL_GAIN = 0.25;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 0 to 1, and anything the browser will not store just starts at full */
function readVolume(): number {
  try {
    // Number(null) is 0, not NaN, so an absent setting read as silence and the
    // game started muted with the speaker still showing as on
    const raw = localStorage.getItem(VOL_KEY);
    if (raw === null) return 1;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
  } catch {
    return 1;
  }
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = readMuted();
  private volume = readVolume();

  getVolume() {
    return this.volume;
  }

  /**
   * Turning it all the way down is the same intent as muting, so it is the
   * same state: a slider at zero and a speaker crossed out disagreeing about
   * whether the game is silent is a settings panel arguing with itself.
   */
  setVolume(next: number) {
    this.volume = Math.min(1, Math.max(0, next));
    try {
      localStorage.setItem(VOL_KEY, String(this.volume));
    } catch {
      /* private browsing — the setting just will not persist */
    }
    if (this.volume > 0 && this.muted) this.setMuted(false);
    else this.applyGain();
  }

  private applyGain() {
    if (this.master) this.master.gain.value = this.gain();
  }

  private gain() {
    return this.muted ? 0 : FULL_GAIN * this.volume;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(next: boolean) {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* private browsing — the setting just won't persist */
    }
    this.applyGain();
  }

  /** created on first use so we never touch audio before a gesture */
  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.gain();
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null; // no audio available; the game plays fine without it
    }
  }

  /** one shaped tone */
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    delay = 0,
    peak = 1,
    endFreq?: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    }
    // quick attack, exponential tail — keeps blips from clicking
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  play(cue: Cue) {
    if (this.muted) return;
    if (!this.ensure()) return;

    switch (cue) {
      case "click":
        this.tone(880, 0.05, "square", 0, 0.5);
        break;

      case "pick":
        // two-step rise: "this one"
        this.tone(660, 0.06, "square", 0, 0.5);
        this.tone(990, 0.07, "square", 0.06, 0.45);
        break;

      case "success":
        // major arpeggio
        this.tone(523, 0.1, "triangle", 0, 0.7);
        this.tone(659, 0.1, "triangle", 0.09, 0.7);
        this.tone(784, 0.22, "triangle", 0.18, 0.7);
        break;

      case "fail":
        // falling buzz
        this.tone(340, 0.18, "sawtooth", 0, 0.5, 190);
        this.tone(170, 0.22, "square", 0.1, 0.3);
        break;

      case "death":
        // long drop
        this.tone(300, 0.5, "sawtooth", 0, 0.55, 60);
        break;
    }
  }
}

export const sfx = new Sfx();
