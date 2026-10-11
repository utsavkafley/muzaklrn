// Progressions to start from, a handful per mode. Written as scale degrees
// (0 = I … 6 = vii) and chord kinds, never as chord names, so every one of
// them plays in any key. A bar holds one chord, or two splitting it in half.

import { ChordKind, ChordRef } from "./harmony";
import { MODES, ModeId } from "./modes";

export type Bar = ChordRef[];

/** "0 3 4 0" → four one-chord bars; "1+4" splits a bar; "7" after a degree makes it a seventh. */
function bars(spec: string): Bar[] {
  const one = (t: string): ChordRef => {
    const kind: ChordKind = t.endsWith("7") && t.length > 1 ? "seventh" : t.endsWith("s4") ? "sus4" : t.endsWith("s2") ? "sus2" : "triad";
    return { degree: Number(t[0]), kind };
  };
  return spec.split(" ").map((b) => b.split("+").map(one));
}

/**
 * Hand-picked, beyond each mode's vamp (which comes first, from modes.ts):
 * the progressions people actually reach for in that mode, plus one with a
 * split bar so the strip shows what a split sounds like.
 */
const EXTRA: Record<ModeId, string[]> = {
  ionian: [
    "0 3 4 0",          // I IV V I — the round trip
    "0 4 5 3",          // I V vi IV — most of pop radio
    "0 5 3 4",          // I vi IV V — the fifties
    "17 47 07 07",      // ii7 V7 Imaj7 — jazz's home run
    "0 3 1+4 0",        // I IV ii-V I
  ],
  lydian: [
    "0 1 2 1",          // I II iii II
    "0 1 5 1",          // I II vi II
    "07 1 07 1+4",      // Imaj7 II Imaj7 II-V
  ],
  mixolydian: [
    "0 6 3 0",          // I ♭VII IV I — the classic rock turnaround
    "0 3 6 3",          // I IV ♭VII IV
    "0 4 3 0",          // I v IV I
    "0 0 6+3 0",        // I I ♭VII-IV I
  ],
  dorian: [
    "0 2 3 0",          // i ♭III IV i
    "0 6 3 0",          // i ♭VII IV i
    "07 37 07 37",      // i7 IV7 — Santana's groove
    "0 0 3+6 0",        // i i IV-♭VII i
  ],
  aeolian: [
    "0 5 2 6",          // i ♭VI ♭III ♭VII — minor-key pop
    "0 3 4 0",          // i iv v i
    "0 6 5 6",          // i ♭VII ♭VI ♭VII
    "0 3 5+6 0",        // i iv ♭VI-♭VII i — the "epic" climb home
  ],
  phrygian: [
    "0 1 2 1",          // i ♭II ♭III ♭II
    "0 6 5 1",          // i ♭vii ♭VI ♭II
    "0 3 1 0",          // i iv ♭II i
  ],
  locrian: [
    "0 1 2 1",          // i° ♭II ♭iii ♭II
    "0 3 1 0",          // i° iv ♭II i°
  ],
};

/** Every preset for a mode, its vamp first. */
export function presetsFor(id: ModeId): Bar[][] {
  const mode = MODES.find((m) => m.id === id)!;
  const vamp: Bar[] = mode.vamp.map((v) => [{
    degree: mode.intervals.indexOf(v.semitones),
    kind: v.quality === "maj" || v.quality === "min" ? "triad" : "seventh",
  }]);
  return [vamp, ...EXTRA[id].map(bars)];
}
