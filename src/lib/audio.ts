// Web Audio engine: lookahead metronome scheduler, pluck synth, strum noise.
// One shared AudioContext, created lazily on first user gesture.

let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Short click. accent=true gives the "1". */
export function click(when: number, accent = false, gain = 1) {
  const ac = audioCtx();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.value = accent ? 1568 : 1046;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime((accent ? 0.5 : 0.28) * gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.09 : 0.05));
  osc.connect(g).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 0.1);
}

/** Guitar-ish pluck: triangle osc through a closing lowpass. */
export function pluck(midi: number, when?: number, dur = 0.9, vol = 0.5) {
  const ac = audioCtx();
  const t = when ?? ac.currentTime;
  const f = midiToFreq(midi);
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = f;
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = f * 2;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(f * 6, 8000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + dur * 0.7);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  osc.connect(lp);
  osc2.connect(g2).connect(lp);
  lp.connect(g).connect(ac.destination);
  osc.start(t); osc2.start(t);
  osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
}

/** Piano-style block chord: all notes struck together, not staggered. */
export function blockChord(midis: number[], when?: number, vol = 0.35) {
  const ac = audioCtx();
  const t = when ?? ac.currentTime;
  midis.forEach((m, i) => pluck(m, t, 1.3, vol * (1 - i * 0.04)));
}

/** Strummed chord: plucks slightly staggered. */
export function strumChord(midis: number[], when?: number, vol = 0.35, up = false) {
  const ac = audioCtx();
  const t = when ?? ac.currentTime;
  const order = up ? [...midis].reverse() : midis;
  order.forEach((m, i) => pluck(m, t + i * 0.014, 1.1, vol * (1 - i * 0.06)));
}

/** Percussive strum for rhythm practice: filtered noise burst. Down = fuller, up = lighter. */
export function strumNoise(when: number, up: boolean, accent = false) {
  const ac = audioCtx();
  const len = 0.09;
  const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = up ? 3200 : 1400;
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.value = (up ? 0.25 : 0.45) * (accent ? 1.7 : 1);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(when);
}

// ---------- Scheduler ----------

export interface Tick {
  /** index within the bar, in subdivision units */
  sub: number;
  subsPerBeat: number;
  beatsPerBar: number;
  /** AudioContext time this tick sounds */
  when: number;
  /** absolute tick count since start */
  count: number;
}

/**
 * Lookahead scheduler (the classic "A Tale of Two Clocks" pattern).
 * Calls schedule(tick) ~0.12s ahead of time; caller makes sounds at tick.when
 * and can setTimeout UI updates for (tick.when - ctx.currentTime).
 */
export class Metronome {
  bpm = 90;
  beatsPerBar = 4;
  subsPerBeat = 1; // 1 = quarters, 2 = eighths, 3 = triplets, 4 = sixteenths
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private count = 0;
  onTick: ((t: Tick) => void) | null = null;
  /** recent + upcoming BEAT times, for tap scoring */
  beatTimes: number[] = [];

  get running() { return this.timer !== null; }

  start() {
    const ac = audioCtx();
    this.stop();
    this.count = 0;
    this.beatTimes = [];
    this.nextTime = ac.currentTime + 0.15;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private pump() {
    const ac = audioCtx();
    const secPerSub = 60 / this.bpm / this.subsPerBeat;
    while (this.nextTime < ac.currentTime + 0.12) {
      const subsPerBar = this.beatsPerBar * this.subsPerBeat;
      const tick: Tick = {
        sub: this.count % subsPerBar,
        subsPerBeat: this.subsPerBeat,
        beatsPerBar: this.beatsPerBar,
        when: this.nextTime,
        count: this.count,
      };
      if (tick.sub % this.subsPerBeat === 0) {
        this.beatTimes.push(tick.when);
        if (this.beatTimes.length > 64) this.beatTimes.shift();
      }
      this.onTick?.(tick);
      this.nextTime += secPerSub;
      this.count++;
    }
  }

  /** Signed ms offset of a tap at audio time t from the nearest beat. */
  tapOffset(t: number): number | null {
    if (!this.beatTimes.length) return null;
    let best: number | null = null;
    for (const bt of this.beatTimes) {
      const d = (t - bt) * 1000;
      if (best === null || Math.abs(d) < Math.abs(best)) best = d;
    }
    return best;
  }
}
