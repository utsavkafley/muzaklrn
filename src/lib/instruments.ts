// The voice phrases play in: a mellotron's tape flute. A soft-edged tone
// that takes a moment to come up to speed, wobbling slowly (wow) and quickly
// (flutter), with a little hiss. It honours the same techniques a guitar
// line uses: slides and bends glide, hammers and pulls start legato.

import { InstrumentSpec } from "./audio";

export const MELLOTRON: InstrumentSpec = {
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
};
