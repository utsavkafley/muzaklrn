import { Chord, ChordQuality, NoteName, noteAt, noteIndex } from "./theory";

export interface RomanChord {
  numeral: string;
  semitones: number; // from key root
  quality: ChordQuality;
  beats?: number; // default 4
}

export interface Progression {
  id: string;
  name: string;
  vibe: string;
  minor?: boolean; // key is treated as minor
  chords: RomanChord[];
  tip: string;
}

export const PROGRESSIONS: Progression[] = [
  {
    id: "axis",
    name: "I – V – vi – IV",
    vibe: "The pop workhorse",
    chords: [
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
    ],
    tip: "Major pentatonic of the key works over everything. The vi chord is your relative minor — same five notes.",
  },
  {
    id: "axis-min",
    name: "vi – IV – I – V",
    vibe: "Same four chords, sadder order",
    chords: [
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
    tip: "Start licks on the vi root and this feels minor. Try the minor pentatonic of the vi chord.",
  },
  {
    id: "50s",
    name: "I – vi – IV – V",
    vibe: "Doo-wop / 50s",
    chords: [
      { numeral: "I", semitones: 0, quality: "maj" },
      { numeral: "vi", semitones: 9, quality: "min" },
      { numeral: "IV", semitones: 5, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
    tip: "Classic turnaround. Practice walking your lick down as the chords fall.",
  },
  {
    id: "blues",
    name: "12-bar blues (I7 IV7 V7)",
    vibe: "Where the pentatonic lives",
    chords: [
      { numeral: "I7", semitones: 0, quality: "7", beats: 16 },
      { numeral: "IV7", semitones: 5, quality: "7", beats: 8 },
      { numeral: "I7", semitones: 0, quality: "7", beats: 8 },
      { numeral: "V7", semitones: 7, quality: "7", beats: 4 },
      { numeral: "IV7", semitones: 5, quality: "7", beats: 4 },
      { numeral: "I7", semitones: 0, quality: "7", beats: 4 },
      { numeral: "V7", semitones: 7, quality: "7", beats: 4 },
    ],
    tip: "Minor pentatonic over dominant chords = the blues sound. Bend the ♭3 toward the 3.",
  },
  {
    id: "andalusian",
    name: "i – ♭VII – ♭VI – V",
    vibe: "Andalusian / flamenco descent",
    minor: true,
    chords: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
      { numeral: "♭VI", semitones: 8, quality: "maj" },
      { numeral: "V", semitones: 7, quality: "maj" },
    ],
    tip: "Minor pentatonic all the way; on the V chord the ♭7 rubs — resolve to the root.",
  },
  {
    id: "251",
    name: "ii – V – I",
    vibe: "The jazz handshake",
    chords: [
      { numeral: "iim7", semitones: 2, quality: "min7" },
      { numeral: "V7", semitones: 7, quality: "7" },
      { numeral: "Imaj7", semitones: 0, quality: "maj7", beats: 8 },
    ],
    tip: "Major pentatonic works, but try landing the 3rd of each chord on beat 1 — instant jazz.",
  },
  {
    id: "minor-lift",
    name: "i – ♭VI – ♭III – ♭VII",
    vibe: "Epic minor (the other axis)",
    minor: true,
    chords: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭VI", semitones: 8, quality: "maj" },
      { numeral: "♭III", semitones: 3, quality: "maj" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
    ],
    tip: "Minor pentatonic of the key over all four. Every chord tone of ♭III and ♭VII is in your scale.",
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
