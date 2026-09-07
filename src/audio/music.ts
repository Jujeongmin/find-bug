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
