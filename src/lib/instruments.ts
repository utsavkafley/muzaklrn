// The voices a phrase can be played in. Guitar is the default and keeps its
// own voice (riffNote); the rest are built from InstrumentSpec. All of them
// honour the same techniques: slides and bends glide, hammers and pulls
// start legato, vibrato wavers.

import { InstrumentSpec } from "./audio";

export type InstrumentId = "guitar" | "synth" | "piano" | "mellotron" | "flute";

export const INSTRUMENTS: { id: InstrumentId; label: string; spec?: InstrumentSpec }[] = [
  { id: "guitar", label: "guitar" },
  {
    id: "synth",
    label: "synth",
    // Two saws a few cents apart and a square an octave down, through a
    // resonant low-pass that closes as the note goes on: a classic lead.
    spec: {
      partials: [
        { type: "sawtooth", ratio: 1, gain: 0.5, detune: -7 },
        { type: "sawtooth", ratio: 1, gain: 0.5, detune: 7 },
        { type: "square", ratio: 0.5, gain: 0.25 },
      ],
      filter: { type: "lowpass", from: 9, to: 4, q: 5, sweep: 0.12 },
      attack: 0.008, legatoAttack: 0.03, peak: 0.34,
      sustain: 0.75, decay: 0.15, release: 0.18,
    },
  },
  {
    id: "piano",
    label: "piano",
    // Partials a hair sharp of whole multiples, as real strings are, a
    // brightness that fades as the string settles, and the hammer's knock.
    spec: {
      partials: [
        { type: "sine", ratio: 1, gain: 1 },
        { type: "sine", ratio: 2.003, gain: 0.45 },
        { type: "sine", ratio: 3.009, gain: 0.22 },
        { type: "sine", ratio: 4.02, gain: 0.1 },
        { type: "triangle", ratio: 1, gain: 0.25 },
      ],
      filter: { type: "lowpass", from: 12, to: 4, sweep: 0.4 },
      attack: 0.003, legatoAttack: 0.02, peak: 0.22,
      sustain: 0, decay: 0.7, release: 0.35, knock: 0.12,
    },
  },
  {
    id: "mellotron",
    label: "mellotron",
    // The tape flute: a soft-edged tone that takes a moment to come up to
    // speed, wobbling slowly (wow) and quickly (flutter), with a little hiss.
    spec: {
      partials: [
        { type: "triangle", ratio: 1, gain: 1 },
        { type: "sawtooth", ratio: 1, gain: 0.18, detune: 4 },
        { type: "sine", ratio: 2, gain: 0.2 },
      ],
      filter: { type: "lowpass", from: 4, to: 3, q: 0.9, sweep: 0.3 },
      attack: 0.07, legatoAttack: 0.09, peak: 0.27,
      sustain: 0.85, decay: 0.3, release: 0.12,
      wow: [{ rate: 0.55, cents: 7 }, { rate: 7.5, cents: 3 }],
      breath: 0.012,
    },
  },
  {
    id: "flute",
    label: "flute",
    // Nearly a pure tone, a breathy chiff as each note starts, and vibrato
    // that arrives once the note has settled.
    spec: {
      partials: [
        { type: "sine", ratio: 1, gain: 1 },
        { type: "sine", ratio: 2, gain: 0.16 },
        { type: "sine", ratio: 3, gain: 0.05 },
      ],
      filter: { type: "lowpass", from: 6, to: 5, sweep: 0.2 },
      attack: 0.06, legatoAttack: 0.04, peak: 0.26,
      sustain: 0.9, decay: 0.2, release: 0.1,
      breath: 0.035,
      vibrato: { rate: 5, cents: 14, delay: 0.25 },
    },
  },
];

// ---------- The chosen voice, remembered in this browser ----------

const KEY = "muzaklrn.instrument";
let current: InstrumentId | null = null;
const listeners = new Set<() => void>();

export function currentInstrument(): InstrumentId {
  if (current) return current;
  try {
    const saved = localStorage.getItem(KEY) as InstrumentId | null;
    current = saved && INSTRUMENTS.some((x) => x.id === saved) ? saved : "guitar";
  } catch {
    current = "guitar";
  }
  return current;
}

export function setInstrument(id: InstrumentId) {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode: still switch */
  }
  listeners.forEach((fn) => fn());
}

export const subscribeInstrument = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const instrumentServerSnapshot = (): InstrumentId => "guitar";

export const specOf = (id: InstrumentId) => INSTRUMENTS.find((x) => x.id === id)?.spec;
