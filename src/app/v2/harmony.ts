// Harmony for v2: intervals above a root, the chords a scale builds, and the
// mood each chord carries in a progression.

import { NoteName, noteIndex, spellInterval } from "@/lib/theory";

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

export type TriadQuality = "maj" | "min" | "dim" | "aug";
const SUFFIX: Record<TriadQuality, string> = { maj: "", min: "m", dim: "°", aug: "+" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export interface DiatonicChord {
  /** 0-6: which degree of the scale it is built on. */
  degree: number;
  /** Semitones of the chord's root above the key's root. */
  semis: number;
  /** Semitones above the key's root of each chord tone, root first. */
  tones: number[];
  quality: TriadQuality;
  numeral: string;
  name: string;
  mood: Mood;
  /** One line on why it has that mood, in note names. */
  why: string;
}

/**
 * The seven triads a seven-note scale builds by stacking every other note.
 * Works for any seven-note set, not only the modes. Null for anything else,
 * since "every other note" means nothing without seven of them.
 */
export function diatonicChords(keyName: string, shown: number[]): DiatonicChord[] | null {
  if (shown.length !== 6) return null;
  const scale = [0, ...[...shown].sort((a, b) => a - b)];
  const noteName = (deg: number) => spellInterval(keyName, scale[deg % 7], deg % 7);
  const home = [0, 2, 4]; // degrees of the home chord
  const built = scale.map((semis, i) => {
    const third = scale[(i + 2) % 7] + (i + 2 >= 7 ? 12 : 0);
    const fifth = scale[(i + 4) % 7] + (i + 4 >= 7 ? 12 : 0);
    const t = third - semis, f = fifth - semis;
    const quality: TriadQuality =
      t === 4 && f === 8 ? "aug" : t === 4 ? "maj" : t === 3 && f === 6 ? "dim" : "min";
    const off = semis - MAJOR[i];
    const acc = off < 0 ? "♭" : off > 0 ? "♯" : "";
    const roman = quality === "maj" || quality === "aug" ? ROMAN[i] : ROMAN[i].toLowerCase();
    const q = quality === "dim" ? "°" : quality === "aug" ? "+" : "";
    return {
      degree: i,
      semis,
      tones: [semis, third % 12, fifth % 12],
      quality,
      numeral: acc + roman + q,
      name: spellInterval(keyName, semis, i) + SUFFIX[quality],
      degrees: [i, (i + 2) % 7, (i + 4) % 7],
    };
  });
  return built.map(({ degrees, ...c }) => {
    if (c.degree === 0) return { ...c, mood: "home", why: "is home" };
    const shared = degrees.filter((d) => home.includes(d));
    if (shared.length >= 2) {
      return { ...c, mood: "home", why: `shares ${shared.map(noteName).join(" and ")} with home` };
    }
    const pull = degrees.find((d) => scale[d] === 11 || scale[d] === 1);
    if (pull !== undefined) {
      const dir = scale[pull] === 11 ? "below" : "above";
      return { ...c, mood: "tension", why: `${noteName(pull)}, a half step ${dir} ${noteName(0)}, pulls home` };
    }
    return {
      ...c, mood: "away",
      why: `no half-step pull, ${shared.length ? `only ${noteName(shared[0])} in common with home` : "nothing in common with home"}`,
    };
  });
}

/**
 * A strummable voicing: root in the guitar's low register (A2 up to G♯3),
 * then third, fifth, octave, and the third again on top.
 */
export function voicing(key: NoteName, c: DiatonicChord): number[] {
  const pc = (noteIndex(key) + c.semis) % 12;
  const root = 45 + ((pc - 9 + 12) % 12); // 45 = A2, pitch class 9
  const third = (c.tones[1] - c.semis + 12) % 12;
  const fifth = (c.tones[2] - c.semis + 12) % 12;
  return [root, root + third, root + fifth, root + 12, root + 12 + third];
}
