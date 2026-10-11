// Harmony: intervals above a root, the chords a scale builds, and the
// mood each chord carries in a progression.

import { NOTES, NoteName, chordShape, noteIndex, pitchAt, spellInterval } from "@/lib/theory";

/** Every interval above the root, by semitones. `steps` is how many letters
 *  it climbs, which is what spells it right. */
export const INTERVALS = [
  { semis: 1, label: "♭2", steps: 1 },
  { semis: 2, label: "2", steps: 1 },
  { semis: 3, label: "♭3", steps: 2 },
  { semis: 4, label: "3", steps: 2 },
  { semis: 5, label: "4", steps: 3 },
  { semis: 6, label: "♭5", steps: 4 },
  { semis: 7, label: "5", steps: 4 },
  { semis: 8, label: "♭6", steps: 5 },
  { semis: 9, label: "6", steps: 5 },
  { semis: 10, label: "♭7", steps: 6 },
  { semis: 11, label: "7", steps: 6 },
];
export type Interval = (typeof INTERVALS)[number];

/**
 * The tritone is spelled from what surrounds it: with the 4 gone and the 5
 * still there it is a raised 4 (Lydian), otherwise a flat 5 (Locrian, blues).
 */
export function spelled(semis: number, shown: number[]): Interval {
  const iv = INTERVALS.find((i) => i.semis === semis)!;
  if (semis === 6 && !shown.includes(5) && shown.includes(7)) return { ...iv, label: "♯4", steps: 3 };
  return iv;
}

/**
 * What a chord does in a progression, which is how it feels.
 *   home    at rest
 *   away    left home, open, in no hurry to get back
 *   tension leaning hard back toward home
 *
 * Read off the chord's own notes, not its position in the scale, so the same
 * numeral can feel different in different modes:
 *   - A chord sharing two notes with the home chord still sounds like home.
 *   - Otherwise, a chord holding a note a half step from the tonic (the 7
 *     rising, or the ♭2 falling) pulls — that half step is what makes V lean
 *     on I. Aeolian's v, Dorian's v and every ♭VII have no such note, which is
 *     why those modes never quite resolve.
 *   - Anything else has simply gone away.
 * This is about chords. A single note feels different (a 5 over the home
 * chord is as restful as it gets), which is why the colour lives on chords.
 */
export type Mood = "home" | "away" | "tension";
export const MOOD_FILL: Record<Mood, string> = {
  home: "#fbbf24",
  away: "#60a5fa",
  tension: "#fb7185",
};

/** The same moods, pale: notes in the key but not in the chord being played. */
export const MOOD_TINT: Record<Mood, string> = {
  home: "#fde68a",
  away: "#bfdbfe",
  tension: "#fecdd3",
};

/**
 * One note's mood, by the rule that colours chords, so the neck explains the
 * chord row: a note of the home chord is home, a note a half step from the
 * tonic is tension, anything else is away. A chord with two home notes is
 * home; one holding a tension note is tension; the rest are away.
 * `homeTones` are the home chord's notes in semitones above the tonic.
 */
export function noteMood(semis: number, homeTones: number[]): Mood {
  if (homeTones.includes(semis)) return "home";
  if (semis === 11 || semis === 1) return "tension";
  return "away";
}

/**
 * The kinds of chord a scale can build on each degree. Every kind is made of
 * scale notes only, picked by how many scale steps they sit above the root:
 *   triad   1 3 5      seventh 1 3 5 7
 *   sus2    1 2 5      sus4    1 4 5
 */
export type ChordKind = "triad" | "seventh" | "sus2" | "sus4";
export const KINDS: { kind: ChordKind; label: string }[] = [
  { kind: "triad", label: "triad" },
  { kind: "seventh", label: "7th" },
  { kind: "sus2", label: "sus2" },
  { kind: "sus4", label: "sus4" },
];
const STEPS: Record<ChordKind, number[]> = {
  triad: [0, 2, 4],
  seventh: [0, 2, 4, 6],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
};

/** A chord in a progression: which degree, which kind. Survives key changes. */
export interface ChordRef {
  degree: number;
  kind: ChordKind;
}

export interface DiatonicChord extends ChordRef {
  /** Semitones of the chord's root above the key's root. */
  semis: number;
  /** Semitones above the key's root of each chord tone, root first. */
  tones: number[];
  /** Interval shape above its own root, e.g. "m7" — what a chord chart calls it. */
  shape: string;
  numeral: string;
  name: string;
  mood: Mood;
  /** One line on why it has that mood, in note names. */
  why: string;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/**
 * Chord-chart names, keyed by the intervals above the root. `upper` is
 * whether the numeral is upper case (a major third, or no third at all);
 * `num` is what follows the numeral, `sym` what follows the letter name.
 */
const SHAPES: Record<string, { shape: string; upper: boolean; num: string; sym: string }> = {
  "4,7": { shape: "maj", upper: true, num: "", sym: "" },
  "3,7": { shape: "min", upper: false, num: "", sym: "m" },
  "3,6": { shape: "dim", upper: false, num: "°", sym: "°" },
  "4,8": { shape: "aug", upper: true, num: "+", sym: "+" },
  "4,7,11": { shape: "maj7", upper: true, num: "maj7", sym: "maj7" },
  "4,7,10": { shape: "7", upper: true, num: "7", sym: "7" },
  "3,7,10": { shape: "m7", upper: false, num: "7", sym: "m7" },
  "3,6,10": { shape: "m7♭5", upper: false, num: "ø7", sym: "m7♭5" },
  "3,6,9": { shape: "dim7", upper: false, num: "°7", sym: "°7" },
  "3,7,11": { shape: "mMaj7", upper: false, num: "(maj7)", sym: "m(maj7)" },
  "4,8,11": { shape: "augMaj7", upper: true, num: "+maj7", sym: "+maj7" },
  "2,7": { shape: "sus2", upper: true, num: "sus2", sym: "sus2" },
  "5,7": { shape: "sus4", upper: true, num: "sus4", sym: "sus4" },
};

/** The seven notes, in semitones above the root, or null without seven. */
export function scaleOf(shown: number[]): number[] | null {
  return shown.length === 6 ? [0, ...[...shown].sort((a, b) => a - b)] : null;
}

/**
 * Build one chord on one degree of a seven-note scale. Null when the kind
 * doesn't fit there: a sus chord needs its 2nd or 4th and its 5th to be the
 * plain ones (Lydian's I has a ♯4, so no Isus4; nothing sus sits on a °).
 */
export function buildChord(keyName: string, scale: number[], { degree, kind }: ChordRef): DiatonicChord | null {
  const degs = STEPS[kind].map((st) => (degree + st) % 7);
  const above = STEPS[kind].map((st) => scale[(degree + st) % 7] + (degree + st >= 7 ? 12 : 0) - scale[degree]);
  const spec = SHAPES[above.slice(1).join(",")];
  if (!spec) return null;
  if ((kind === "sus2" || kind === "sus4") && above[2] !== 7) return null;

  const semis = scale[degree];
  const off = semis - MAJOR[degree];
  const acc = off < 0 ? "♭" : off > 0 ? "♯" : "";
  const noteName = (d: number) => spellInterval(keyName, scale[d], d);

  const chord = {
    degree, kind, semis,
    tones: degs.map((d) => scale[d]),
    shape: spec.shape,
    numeral: acc + (spec.upper ? ROMAN[degree] : ROMAN[degree].toLowerCase()) + spec.num,
    name: noteName(degree) + spec.sym,
  };

  // The mood rule, on scale degrees: the home chord is degrees 1, 3 and 5.
  if (degree === 0) return { ...chord, mood: "home", why: "is home" };
  const shared = degs.filter((d) => d === 0 || d === 2 || d === 4);
  if (shared.length >= 2) {
    return { ...chord, mood: "home", why: `shares ${shared.map(noteName).join(" and ")} with home` };
  }
  const pull = degs.find((d) => scale[d] === 11 || scale[d] === 1);
  if (pull !== undefined) {
    const dir = scale[pull] === 11 ? "below" : "above";
    return { ...chord, mood: "tension", why: `${noteName(pull)}, a half step ${dir} ${noteName(0)}, pulls home` };
  }
  return {
    ...chord, mood: "away",
    why: `no half-step pull, ${shared.length ? `only ${noteName(shared[0])} in common with home` : "nothing in common with home"}`,
  };
}

/**
 * Build a chord, settling for the plain triad when its kind doesn't fit — a
 * progression saved in one mode still plays in another.
 */
export function buildOrTriad(keyName: string, scale: number[], ref: ChordRef): DiatonicChord {
  return buildChord(keyName, scale, ref) ?? buildChord(keyName, scale, { degree: ref.degree, kind: "triad" })!;
}

/** All seven chords of one kind; a slot is null where the kind doesn't fit. */
export function diatonicChords(keyName: string, shown: number[], kind: ChordKind = "triad"): (DiatonicChord | null)[] | null {
  const scale = scaleOf(shown);
  return scale && scale.map((_, degree) => buildChord(keyName, scale, { degree, kind }));
}

/**
 * A strummable voicing: root in the guitar's low register (A2 up to G♯3),
 * the other chord tones stacked above it, then the root an octave up.
 */
export function voicing(key: NoteName, c: DiatonicChord): number[] {
  const pc = (noteIndex(key) + c.semis) % 12;
  const root = 45 + ((pc - 9 + 12) % 12); // 45 = A2, pitch class 9
  const rest = c.tones.slice(1).map((t) => root + ((t - c.semis + 12) % 12));
  return [root, ...rest, root + 12];
}

/** A fingering: one fret per string, low E first; -1 is a string not played. */
export type Grip = number[];

/** Chord-chart shapes the fingering library knows, by our shape name. */
const LIBRARY: Record<string, Parameters<typeof chordShape>[0]["quality"]> = {
  maj: "maj", min: "min", maj7: "maj7", "7": "7", m7: "min7", "m7♭5": "m7b5", sus4: "sus4",
};

/**
 * The shape most people learn for the chord: the open chord when there is
 * one, otherwise the E- or A-shape barre lowest on the neck. Null for chords
 * the library has no shape for (diminished, augmented, sus2); those get the
 * three-string grip alone.
 */
export function fullGrip(key: NoteName, c: DiatonicChord): Grip | null {
  const quality = LIBRARY[c.shape];
  if (!quality) return null;
  const root = NOTES[(noteIndex(key) + c.semis) % 12];
  return chordShape({ root, quality }).frets;
}

/**
 * The chord as three notes on three neighbouring strings, nothing to mute
 * around. A seventh drops its 5th and keeps root, 3rd and 7th — the shell
 * voicing, which is all the chord needs to sound like itself. Searches G-B-e,
 * D-G-B and A-D-G for the grip lowest on the neck, the fingers no more than
 * three frets apart.
 */
export function minimalGrip(key: NoteName, c: DiatonicChord): Grip | null {
  const tones = c.tones.length === 4 ? [c.tones[0], c.tones[1], c.tones[3]] : c.tones;
  const pcs = tones.map((t) => (noteIndex(key) + t) % 12);
  let best: Grip | null = null;
  let bestScore = Infinity;
  for (const [rank, low] of [3, 2, 1].entries()) {
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 12; b++) for (let d = 0; d <= 12; d++) {
      const fr = [a, b, d];
      const got = fr.map((f, i) => pitchAt(low + i, f));
      if (new Set(got).size !== 3 || !got.every((p) => pcs.includes(p))) continue;
      const pressed = fr.filter((f) => f > 0);
      const span = pressed.length ? Math.max(...pressed) - Math.min(...pressed) : 0;
      if (span > 3) continue;
      // Lowest on the neck first, then the tightest hand, then the higher strings.
      const score = Math.max(...fr) * 10 + span + rank * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = Array.from({ length: 6 }, (_, s) => (s >= low && s < low + 3 ? fr[s - low] : -1));
      }
    }
  }
  return best;
}
