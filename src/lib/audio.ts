// Web Audio engine: lookahead metronome scheduler, pluck synth, strum noise.
// One shared AudioContext, created lazily on first user gesture.
//
// Every sound goes through one master bus — a little headroom, then a
// limiter — rather than straight to the speakers. Click, strums and a riff
// stacked on one beat used to add up past full scale and crackle.

let ctx: AudioContext | null = null;
let master: AudioNode | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = buildMaster(ctx);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Where every sound connects: the master bus, not the speakers directly. */
function out(): AudioNode {
  audioCtx();
  return master!;
}

function buildMaster(ac: AudioContext): AudioNode {
  const trim = ac.createGain();
  trim.gain.value = 0.8;
  // A fast, hard compressor sitting just under full scale: a limiter. Quiet
  // passages pass untouched; only the stacked peaks get held down.
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -9;
  lim.knee.value = 6;
  lim.ratio.value = 16;
  lim.attack.value = 0.002;
  lim.release.value = 0.12;
  trim.connect(lim).connect(ac.destination);
  return trim;
}

/**
 * Bring a gain to silence from `at` without a jump. The envelope is held at
 * whatever it will actually be at that moment, then eased down — cutting it
 * from its present value instead clicked whenever the cut lay in the future,
 * as when the next riff note on a string silences the last.
 */
function fadeOut(g: GainNode, at: number, start: number, time = 0.03) {
  const p = g.gain;
  if (at <= start) {
    // Never started: nothing is sounding, so just keep it silent.
    p.cancelScheduledValues(0);
    p.setValueAtTime(0, 0);
    return;
  }
  // Firefox has no cancelAndHoldAtTime; there the cut is close, not exact.
  if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(at);
  else p.cancelScheduledValues(at);
  p.setTargetAtTime(0, at, time / 3);
}


export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** A sounding voice you can cut short (e.g. stopping a scheduled run). */
export interface Voice {
  stop: (when?: number) => void;
}

/** Short click. accent=true gives the "1". */
export function click(when: number, accent = false, gain = 1): Voice {
  const ac = audioCtx();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.value = accent ? 1568 : 1046;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime((accent ? 0.38 : 0.22) * gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.09 : 0.05));
  osc.connect(g).connect(out());
  osc.start(when);
  osc.stop(when + 0.1);
  return silencer(g, () => osc.stop(), when);
}

/**
 * Two drumsticks knocked together, for count-offs. A woody knock is mostly a
 * short, tight band of noise; a quick falling tone under it gives the wood.
 */
export function sticks(when: number, gain = 1): Voice {
  const ac = audioCtx();
  const len = 0.05;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600;
  bp.Q.value = 4;

  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1900, when);
  osc.frequency.exponentialRampToValueAtTime(1200, when + 0.03);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, when);
  og.gain.exponentialRampToValueAtTime(0.35, when + 0.001);
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);

  const g = ac.createGain();
  g.gain.value = 1.1 * gain;
  src.connect(bp).connect(g);
  osc.connect(og).connect(g);
  g.connect(out());
  src.start(when);
  osc.start(when);
  osc.stop(when + 0.05);
  return silencer(g, () => { src.stop(); osc.stop(); }, when);
}

/**
 * A stop handle for a scheduled one-shot. Anything already committed to the
 * audio graph keeps its appointment unless something cancels it, and the
 * metronome now schedules seconds ahead — so a stop has to reach into the
 * future and cut what has not sounded yet.
 */
function silencer(g: GainNode, kill: () => void, start = 0): Voice {
  return {
    stop(when?: number) {
      const ac = audioCtx();
      const at = Math.max(when ?? ac.currentTime, ac.currentTime);
      try {
        fadeOut(g, at, start, 0.01);
        if (at <= start) kill();
      } catch {
        /* already finished */
      }
    },
  };
}

/** Guitar-ish pluck: triangle osc through a closing lowpass. */
export function pluck(midi: number, when?: number, dur = 0.9, vol = 0.5): Voice {
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
  lp.connect(g).connect(out());
  osc.start(t); osc2.start(t);
  osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);

  return {
    stop(when?: number) {
      const at = Math.max(when ?? ac.currentTime, ac.currentTime);
      try {
        fadeOut(g, at, t, 0.04);
        osc.stop(at + 0.06); osc2.stop(at + 0.06);
      } catch {
        /* already stopped */
      }
    },
  };
}

/** A pitch change partway through a riff note. */
export interface Glide {
  /** AudioContext time the change starts. */
  at: number;
  /** Seconds it takes. */
  dur: number;
  /** Where the pitch ends up. */
  midi: number;
  /** A slide moves fret by fret; a bend moves smoothly. */
  stepped?: boolean;
}

/**
 * One note of a riff, played the way the hand plays it. A picked note gets
 * a sharp attack; a hammer-on or pull-off sounds from the fretting hand
 * alone, softer and rounder. Glides carry slides and bends, and vibrato
 * wavers the pitch once the note has settled.
 */
export function riffNote(o: {
  midi: number; when: number; dur: number; picked: boolean; glides?: Glide[]; vibrato?: boolean;
}): Voice {
  const ac = audioCtx();
  const { when: t, dur } = o;
  const f = midiToFreq(o.midi);
  const osc = ac.createOscillator();
  osc.type = "triangle";
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc.frequency.setValueAtTime(f, t);
  osc2.frequency.setValueAtTime(f * 2, t);

  // Pitch moves: both oscillators together, the harmonic an octave up.
  let cur = o.midi;
  for (const g of o.glides ?? []) {
    if (g.stepped) {
      const n = Math.abs(g.midi - cur);
      const dir = Math.sign(g.midi - cur);
      for (let k = 1; k <= n; k++) {
        const at = g.at + (g.dur * k) / n;
        osc.frequency.setValueAtTime(midiToFreq(cur + dir * k), at);
        osc2.frequency.setValueAtTime(midiToFreq(cur + dir * k) * 2, at);
      }
    } else {
      osc.frequency.setValueAtTime(midiToFreq(cur), g.at);
      osc2.frequency.setValueAtTime(midiToFreq(cur) * 2, g.at);
      osc.frequency.linearRampToValueAtTime(midiToFreq(g.midi), g.at + g.dur);
      osc2.frequency.linearRampToValueAtTime(midiToFreq(g.midi) * 2, g.at + g.dur);
    }
    cur = g.midi;
  }

  if (o.vibrato) {
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(midiToFreq(cur) * 0.018, t + dur * 0.4);
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
  }

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(f * (o.picked ? 7 : 4), 8000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 400), t + dur + 0.2);
  const g = ac.createGain();
  const peak = o.picked ? 0.36 : 0.26;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.picked ? 0.005 : 0.015));
  g.gain.exponentialRampToValueAtTime(peak * 0.5, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  osc.connect(lp);
  osc2.connect(g2).connect(lp);
  lp.connect(g).connect(out());
  osc.start(t); osc2.start(t);
  osc.stop(t + dur + 0.3); osc2.stop(t + dur + 0.3);

  return {
    stop(when?: number) {
      const at = Math.max(when ?? ac.currentTime, ac.currentTime);
      try {
        fadeOut(g, at, t, 0.03);
        osc.stop(at + 0.05); osc2.stop(at + 0.05);
      } catch {
        /* already stopped */
      }
    },
  };
}

/**
 * How a synthesized instrument is built: a few oscillators stacked as its
 * partials, a filter for its colour, an envelope for how it speaks and
 * dies, and the extras that make it itself — breath for a flute, tape wobble
 * for a mellotron, a hammer's knock for a piano.
 */
export interface InstrumentSpec {
  partials: { type: OscillatorType; ratio: number; gain: number; detune?: number }[];
  filter: { type: BiquadFilterType; from: number; to: number; q?: number; sweep: number };
  /** Seconds to full level: struck (picked) and legato (hammer, pull, slide in). */
  attack: number;
  legatoAttack: number;
  peak: number;
  /** Level held through the note, as a share of the peak; 0 decays like a struck string. */
  sustain: number;
  /** Time constant of the fall from peak to sustain (or to silence). */
  decay: number;
  release: number;
  /** Breath noise level, bandpassed near the pitch: a flute's air. */
  breath?: number;
  /** Slow and fast pitch wobble, in cents: tape. */
  wow?: { rate: number; cents: number }[];
  /** Vibrato it plays by itself as a note settles, in cents. */
  vibrato?: { rate: number; cents: number; delay: number };
  /** A short knock at the start, as a piano hammer. */
  knock?: number;
}

/**
 * One note on a synthesized instrument, with the same technique handling as
 * a guitar note: glides for slides and bends, a softer legato start where
 * the guitar would hammer or pull, and vibrato on request.
 */
export function synthNote(spec: InstrumentSpec, o: {
  midi: number; when: number; dur: number; picked: boolean; glides?: Glide[]; vibrato?: boolean;
}): Voice {
  const ac = audioCtx();
  const { when: t, dur } = o;
  const f = midiToFreq(o.midi);
  const end = t + dur + spec.release + 0.1;

  const g = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = spec.filter.type;
  filter.Q.value = spec.filter.q ?? 0.7;
  filter.frequency.setValueAtTime(Math.min(f * spec.filter.from, 16000), t);
  filter.frequency.setTargetAtTime(Math.min(Math.max(f * spec.filter.to, 200), 16000), t + 0.01, spec.filter.sweep);
  filter.connect(g).connect(out());

  // Pitch wobble and vibrato ride on every partial's detune, in cents.
  const wobble = ac.createGain();
  wobble.gain.value = 1;
  const lfos: OscillatorNode[] = [];
  const addLfo = (rate: number, cents: number, from: number, rampTo: number) => {
    const lfo = ac.createOscillator();
    lfo.frequency.value = rate;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, from);
    depth.gain.linearRampToValueAtTime(cents, rampTo);
    lfo.connect(depth).connect(wobble);
    lfo.start(t);
    lfo.stop(end);
    lfos.push(lfo);
  };
  for (const w of spec.wow ?? []) addLfo(w.rate, w.cents, t, t + 0.05);
  if (spec.vibrato) addLfo(spec.vibrato.rate, spec.vibrato.cents, t + spec.vibrato.delay, t + spec.vibrato.delay + 0.3);
  if (o.vibrato) addLfo(5.5, 28, t + dur * 0.2, t + dur * 0.5);

  const oscs = spec.partials.map((p) => {
    const osc = ac.createOscillator();
    osc.type = p.type;
    osc.detune.value = p.detune ?? 0;
    wobble.connect(osc.detune);
    osc.frequency.setValueAtTime(f * p.ratio, t);
    let cur = o.midi;
    for (const gl of o.glides ?? []) {
      if (gl.stepped) {
        const n = Math.abs(gl.midi - cur);
        const dir = Math.sign(gl.midi - cur);
        for (let k = 1; k <= n; k++) osc.frequency.setValueAtTime(midiToFreq(cur + dir * k) * p.ratio, gl.at + (gl.dur * k) / n);
      } else {
        osc.frequency.setValueAtTime(midiToFreq(cur) * p.ratio, gl.at);
        osc.frequency.linearRampToValueAtTime(midiToFreq(gl.midi) * p.ratio, gl.at + gl.dur);
      }
      cur = gl.midi;
    }
    const pg = ac.createGain();
    pg.gain.value = p.gain;
    osc.connect(pg).connect(filter);
    osc.start(t);
    osc.stop(end);
    return osc;
  });

  // Breath: noise through a band near the note, loudest as the note starts.
  let noise: AudioBufferSourceNode | null = null;
  if (spec.breath) {
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.5), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = ac.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(f * 2, 9000);
    bp.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(spec.breath * (o.picked ? 3 : 1.5), t + 0.03);
    ng.gain.setTargetAtTime(spec.breath, t + 0.04, 0.08);
    noise.connect(bp).connect(ng).connect(g);
    noise.start(t);
    noise.stop(end);
  }

  // A hammer's knock: a very short, low thump under a struck note.
  if (spec.knock && o.picked) {
    const k = ac.createOscillator();
    k.type = "sine";
    k.frequency.setValueAtTime(f * 0.5 + 60, t);
    k.frequency.exponentialRampToValueAtTime(40, t + 0.04);
    const kg = ac.createGain();
    kg.gain.setValueAtTime(spec.knock, t);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    k.connect(kg).connect(out());
    k.start(t);
    k.stop(t + 0.06);
  }

  // The envelope: in, down to its sustain (or away, for a struck string),
  // held for the note, then released.
  const attack = o.picked ? spec.attack : spec.legatoAttack;
  const peak = spec.peak * (o.picked ? 1 : 0.85);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(Math.max(peak * spec.sustain, 0.0001), t + attack, spec.decay);
  g.gain.setTargetAtTime(0.0001, t + dur, spec.release / 3);

  return {
    stop(when?: number) {
      const at = Math.max(when ?? ac.currentTime, ac.currentTime);
      try {
        fadeOut(g, at, t, 0.04);
        const off = at + 0.08;
        oscs.forEach((x) => x.stop(off));
        lfos.forEach((x) => x.stop(off));
        noise?.stop(off);
      } catch {
        /* already stopped */
      }
    },
  };
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
export function strumNoise(when: number, up: boolean, accent = false): Voice {
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
  src.connect(bp).connect(g).connect(out());
  src.start(when);
  return silencer(g, () => src.stop(), when);
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
 * Calls schedule(tick) ~0.2s ahead of time; caller makes sounds at tick.when
 * and can setTimeout UI updates for (tick.when - ctx.currentTime).
 */
export class Metronome {
  bpm = 90;
  beatsPerBar = 4;
  subsPerBeat = 1; // 1 = quarters, 2 = eighths, 3 = triplets, 4 = sixteenths
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private count = 0;
  private onVisibility: (() => void) | null = null;
  onTick: ((t: Tick) => void) | null = null;
  /** recent + upcoming BEAT times, for tap scoring */
  beatTimes: number[] = [];

  get running() { return this.timer !== null; }

  /**
   * How far ahead to schedule. A hidden tab clamps setInterval to about a
   * second, so one pump has to cover more than that or the click stutters and
   * then dies the moment you switch away. While visible, stay tight: a tempo
   * change should be audible immediately rather than after a buffer drains.
   */
  private get horizon() {
    return typeof document !== "undefined" && document.hidden ? 1.5 : 0.2;
  }

  start() {
    const ac = audioCtx();
    this.stop();
    this.count = 0;
    this.beatTimes = [];
    this.nextTime = ac.currentTime + 0.15;
    this.timer = setInterval(() => this.pump(), 25);
    // Fill the buffer the instant the tab hides, before throttling starts —
    // waiting for the next tick would already be too late.
    if (typeof document !== "undefined") {
      this.onVisibility = () => { if (this.timer) this.pump(); };
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    this.pump();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.onVisibility && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    this.onVisibility = null;
  }

  private pump() {
    const ac = audioCtx();
    const secPerSub = 60 / this.bpm / this.subsPerBeat;
    const until = ac.currentTime + this.horizon;
    while (this.nextTime < until) {
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
