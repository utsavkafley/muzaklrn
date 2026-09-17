import { Chord, ChordQuality, NoteName, ScaleKind, noteAt, noteIndex } from "./theory";

export interface RomanChord {
  numeral: string;
  semitones: number; // from key root
  quality: ChordQuality;
  beats?: number; // default 4
}

export interface Progression {
  id: string;
  name: string;
  minor?: boolean; // key is treated as minor
  /** Which pentatonic sits naturally over this, with the key as tonic. */
  fits: ScaleKind[];
  chords: RomanChord[];
}

export const PROGRESSIONS: Progression[] = [
  {
    id: "axis",
    fits: ["majorPent"],
    name: "I – V – vi – IV",
    chords: [
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
    ],
  },
  {
    id: "axis-min",
    fits: ["majorPent", "minorPent"],
    name: "vi – IV – I – V",
    chords: [
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
  },
  {
    id: "50s",
    fits: ["majorPent"],
    name: "I – vi – IV – V",
    chords: [
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
  },
  {
    id: "blues",
    fits: ["minorPent", "majorPent"],
    name: "I7 – IV7 – V7",
    chords: [
      { numeral: "I7", semitones: 0, quality: "7", beats: 16 },
      { numeral: "IV7", semitones: 5, quality: "7", beats: 8 },
      { numeral: "I7", semitones: 0, quality: "7", beats: 8 },
      { numeral: "V7", semitones: 7, quality: "7", beats: 4 },
      { numeral: "IV7", semitones: 5, quality: "7", beats: 4 },
      { numeral: "I7", semitones: 0, quality: "7", beats: 4 },
      { numeral: "V7", semitones: 7, quality: "7", beats: 4 },
    ],
  },
  {
    id: "andalusian",
    fits: ["minorPent"],
    name: "i – ♭VII – ♭VI – V",
    minor: true,
    chords: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
      { numeral: "♭VI", semitones: 8, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
  },
  {
    id: "251",
    fits: ["majorPent"],
    name: "ii – V – I",
    chords: [
      { numeral: "iim7", semitones: 2, quality: "min7" },
      { numeral: "V7", semitones: 7, quality: "7" },
      { numeral: "Imaj7", semitones: 0, quality: "maj7", beats: 8 },
    ],
  },
  {
    id: "minor-lift",
    fits: ["minorPent"],
    name: "i – ♭VI – ♭III – ♭VII",
    minor: true,
    chords: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭VI", semitones: 8, quality: "maj" },
      { numeral: "♭III", semitones: 3, quality: "maj" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
    ],
  },
  {
    id: "i-iv-v-min",
    name: "i – iv – v",
    minor: true,
    fits: ["minorPent"],
    chords: [
      { numeral: "i", semitones: 0, quality: "min", beats: 8 },
      { numeral: "iv", semitones: 5, quality: "min" },
      { numeral: "v", semitones: 7, quality: "min" },
    ],
  },
  {
    id: "dorian-vamp",
    name: "i – IV",
    minor: true,
    fits: ["minorPent"],
    chords: [
      { numeral: "i", semitones: 0, quality: "min7", beats: 8 },
      { numeral: "IV", semitones: 5, quality: "maj", beats: 8 },
    ],
  },
  {
    id: "i-bvii",
    name: "i – \u266dVII",
    minor: true,
    fits: ["minorPent"],
    chords: [
      { numeral: "i", semitones: 0, quality: "min", beats: 8 },
      { numeral: "\u266dVII", semitones: 10, quality: "maj", beats: 8 },
    ],
  },
  {
    id: "i-iv-v",
    name: "I – IV – V",
    fits: ["majorPent"],
    chords: [
      { numeral: "I", semitones: 0, quality: "maj", beats: 8 },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
  },
  {
    id: "i-iii-iv-v",
    name: "I – iii – IV – V",
    fits: ["majorPent"],
    chords: [
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "iii", semitones: 4, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
  },
  {
    id: "i-v-min",
    name: "I – V",
    fits: ["majorPent"],
    chords: [
      { numeral: "I", semitones: 0, quality: "maj", beats: 8 },
      { numeral: "V", semitones: 7, quality: "maj", beats: 8 },
    ],
  },
];

export interface ProgChord {
  chord: Chord;
  numeral: string;
  beats: number;
}

export function realize(p: Progression, key: NoteName): ProgChord[] {
  return p.chords.map((rc) => ({
    chord: { root: noteAt(noteIndex(key) + rc.semitones), quality: rc.quality },
    numeral: rc.numeral,
    beats: rc.beats ?? 4,
  }));
}

/** Progressions whose tonic behaviour matches the scale being practised. */
export function progressionsFor(kind: ScaleKind): Progression[] {
  return PROGRESSIONS.filter((p) => p.fits.includes(kind));
}

/** n distinct items, chosen at random. Call from an effect — not during render. */
export function sample<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
