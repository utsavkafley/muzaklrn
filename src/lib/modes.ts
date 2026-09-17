// The seven modes, taught as the pentatonic you already own plus two notes.
//
// The usual explanation — "D Dorian is the notes of C major starting on D" —
// is true and useless: it tells you what to think about while you're supposed
// to be playing, and it points your ear at the wrong tonic. Every mode here is
// instead defined as the parent pentatonic (five shapes already in the hands)
// with exactly two notes added. You are not learning seven new scales, you are
// learning fourteen notes spread over two shapes you have known for years.
//
// Ordered by brightness, each mode differs from its neighbour by exactly one
// flattened degree — Lydian to Locrian is a single continuous dimmer switch.

import { ChordQuality, NoteName, ScaleKind, SCALE_DEGREES, noteAt, noteIndex } from "./theory";

export type ModeId =
  | "lydian" | "ionian" | "mixolydian" | "dorian" | "aeolian" | "phrygian" | "locrian";

export interface ModeVampChord {
  numeral: string;
  semitones: number;
  quality: ChordQuality;
}

export interface Mode {
  id: ModeId;
  name: string;
  /** The other name people use for it, if there is one. */
  alias?: string;
  /** The pentatonic the mode is built on top of. */
  parent: ScaleKind;
  /** Semitones from the root, seven of them. */
  intervals: number[];
  degrees: string[];
  /**
   * Degrees present in this mode but not in the parent pentatonic — the two
   * notes that turn a shape you know into a mode you don't.
   */
  added: string[];
  /** Parent-pentatonic degree this mode does NOT contain. Only Locrian has one. */
  dropped?: string;
  /** The single degree that carries the sound. Lose it and the mode evaporates. */
  character: string;
  /** Semitones from this root down to the major key that shares these notes. */
  relativeMajorDown: number;
  /** A vamp that holds this mode still instead of collapsing to the relative major. */
  vamp: ModeVampChord[];
  vibe: string;
  /** What it's actually for. */
  why: string;
  /** Somewhere it's unmistakable. */
  heard: string;
}

/**
 * Brightest to darkest. Each step down flattens exactly one more degree:
 * ♯4→4, 7→♭7, 3→♭3, 6→♭6, 2→♭2, 5→♭5. That is the whole system.
 */
export const MODES: Mode[] = [
  {
    id: "lydian",
    name: "Lydian",
    parent: "majorPent",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ["1", "2", "3", "♯4", "5", "6", "7"],
    added: ["♯4", "7"],
    character: "♯4",
    relativeMajorDown: 5,
    vamp: [
      { numeral: "Imaj7", semitones: 0, quality: "maj7" },
      { numeral: "II", semitones: 2, quality: "maj" },
    ],
    vibe: "Major, but floating",
    why: "Major pentatonic with the roof taken off. The ♯4 removes the one note that pulls a major scale back down to earth, so nothing ever resolves and everything hangs in the air. Use it when you want wonder rather than warmth.",
    heard: "The Simpsons theme — that opening leap onto the ♯4 is the entire joke.",
  },
  {
    id: "ionian",
    name: "Ionian",
    alias: "the major scale",
    parent: "majorPent",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
    added: ["4", "7"],
    character: "7",
    relativeMajorDown: 0,
    vamp: [
      { numeral: "Imaj7", semitones: 0, quality: "maj7" },
      { numeral: "IV", semitones: 5, quality: "maj" },
    ],
    vibe: "Home. The default major.",
    why: "The major scale, and the reason major pentatonic exists: drop Ionian's two most awkward notes — the 4, which fights the 3, and the 7, which demands resolution — and what's left is the pentatonic that can't sound wrong. Adding them back buys you tension you then have to handle.",
    heard: "Let It Be. Any hymn. The sound of nothing being withheld.",
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    parent: "majorPent",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ["1", "2", "3", "4", "5", "6", "♭7"],
    added: ["4", "♭7"],
    character: "♭7",
    relativeMajorDown: 7,
    vamp: [
      { numeral: "I7", semitones: 0, quality: "7" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
    ],
    vibe: "Major that refuses to go home",
    why: "Major pentatonic over a dominant chord. The ♭7 is already in the chord under you, so it doesn't clash — it just removes the leading tone, and with it the obligation to resolve. This is the mode most rock guitar actually lives in, whatever the player calls it.",
    heard: "Sweet Home Alabama. Most Allman Brothers. Every riff that sits on a 7 chord and never leaves.",
  },
  {
    id: "dorian",
    name: "Dorian",
    parent: "minorPent",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ["1", "2", "♭3", "4", "5", "6", "♭7"],
    added: ["2", "6"],
    character: "6",
    relativeMajorDown: 2,
    vamp: [
      { numeral: "i7", semitones: 0, quality: "min7" },
      { numeral: "IV", semitones: 5, quality: "maj" },
    ],
    vibe: "Minor with the lights on",
    why: "Minor pentatonic plus a natural 6, and that one note is the difference between sad and cool. It is the single highest-value mode for a pentatonic player: the shapes don't move, you add one finger, and a tired blues box turns into Santana.",
    heard: "So What. Oye Como Va. Scarborough Fair.",
  },
  {
    id: "aeolian",
    name: "Aeolian",
    alias: "natural minor",
    parent: "minorPent",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ["1", "2", "♭3", "4", "5", "♭6", "♭7"],
    added: ["2", "♭6"],
    character: "♭6",
    relativeMajorDown: 9,
    vamp: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭VI", semitones: 8, quality: "maj" },
      { numeral: "♭VII", semitones: 10, quality: "maj" },
    ],
    vibe: "The default sad",
    why: "The natural minor scale — minor pentatonic with the 2 and the ♭6 filled in. The ♭6 is the ache: it leans down onto the 5 and won't leave it alone. One note darker than Dorian, and the whole mood changes from cool to hurt.",
    heard: "Almost every minor-key rock song ever written. It is the sound you already default to.",
  },
  {
    id: "phrygian",
    name: "Phrygian",
    parent: "minorPent",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ["1", "♭2", "♭3", "4", "5", "♭6", "♭7"],
    added: ["♭2", "♭6"],
    character: "♭2",
    relativeMajorDown: 4,
    vamp: [
      { numeral: "i", semitones: 0, quality: "min" },
      { numeral: "♭II", semitones: 1, quality: "maj" },
    ],
    vibe: "Spanish, or menacing",
    why: "A half step above the root is the most unstable note available, and Phrygian puts it there on purpose. Slide ♭2 down to 1 and you have flamenco; hammer it against a low root and you have metal. Same note, same mode, two genres.",
    heard: "Flamenco, all of it. Any riff that grinds a half step above an open low string.",
  },
  {
    id: "locrian",
    name: "Locrian",
    parent: "minorPent",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ["1", "♭2", "♭3", "4", "♭5", "♭6", "♭7"],
    added: ["♭2", "♭6"],
    dropped: "5",
    character: "♭5",
    relativeMajorDown: 11,
    vamp: [
      { numeral: "im7♭5", semitones: 0, quality: "m7b5" },
      { numeral: "♭II", semitones: 1, quality: "maj" },
    ],
    vibe: "No floor",
    why: "The exception that proves the frame. Locrian is the one mode that is not your pentatonic plus two notes — it flattens the 5, the note that makes a root feel like a root. Without a stable fifth there is no home chord to come back to, which is why essentially nobody writes in it. Know it so you can hear what the 5 was doing for you.",
    heard: "Almost nothing, honestly. Its chord is the m7♭5 that passes through a minor ii–V.",
  },
];

export const modeById = (id: ModeId): Mode => MODES.find((m) => m.id === id) ?? MODES[3];

export const isMode = (s: string | null): s is ModeId =>
  !!s && MODES.some((m) => m.id === s);

/** Parent pentatonic in words, for prose. */
export const parentLabel = (m: Mode) =>
  m.parent === "minorPent" ? "minor pentatonic" : "major pentatonic";

/** Semitones above the root for every degree label the modes use. */
export const DEGREE_SEMITONES: Record<string, number> = {
  "1": 0, "♭2": 1, "2": 2, "♭3": 3, "3": 4, "4": 5,
  "♯4": 6, "♭5": 6, "5": 7, "♭6": 8, "6": 9, "♭7": 10, "7": 11,
};

/** The note a degree label names in a key, independent of which mode it came from. */
export const noteForDegree = (root: NoteName, degree: string): NoteName =>
  noteAt(noteIndex(root) + (DEGREE_SEMITONES[degree] ?? 0));

/** Note name at a scale degree of this mode. */
export function degreeNote(root: NoteName, mode: Mode, degree: string): NoteName {
  const i = mode.degrees.indexOf(degree);
  return noteAt(noteIndex(root) + mode.intervals[i === -1 ? 0 : i]);
}

/** Pitch classes of the mode, rooted at `root`. */
export const modePcs = (root: NoteName, mode: Mode) =>
  mode.intervals.map((iv) => (noteIndex(root) + iv) % 12);

/** Pitch classes of just the added notes — the two that aren't in the pentatonic. */
export const addedPcs = (root: NoteName, mode: Mode) =>
  mode.added.map((d) => noteIndex(degreeNote(root, mode, d)));

export const characterPc = (root: NoteName, mode: Mode) =>
  noteIndex(degreeNote(root, mode, mode.character));

/** The major key whose notes these are — the classic framing, kept as a footnote. */
export const relativeMajor = (root: NoteName, mode: Mode): NoteName =>
  noteAt(noteIndex(root) - mode.relativeMajorDown);

/** Degree → pitch class map for the parent pentatonic at this root. */
export function parentPentPcs(root: NoteName, mode: Mode): number[] {
  const degs = SCALE_DEGREES[mode.parent];
  return mode.degrees
    .map((d, i) => (degs.includes(d) ? (noteIndex(root) + mode.intervals[i]) % 12 : -1))
    .filter((pc) => pc >= 0);
}

/**
 * The one degree that separates two neighbouring modes on the brightness rail.
 * Adjacent modes differ by exactly one flattened note; this finds it, which is
 * the entire content of an A/B comparison.
 */
export function oneNoteApart(a: Mode, b: Mode): { brighter: string; darker: string } | null {
  // MODES is ordered brightest first, so the lower index is the brighter mode.
  const hi = MODES.indexOf(a) <= MODES.indexOf(b) ? a : b;
  const lo = hi === a ? b : a;
  const gone = hi.degrees.filter((d) => !lo.degrees.includes(d));
  const got = lo.degrees.filter((d) => !hi.degrees.includes(d));
  if (gone.length !== 1 || got.length !== 1) return null;
  return { brighter: gone[0], darker: got[0] };
}

/** Index on the brightness rail, 0 = brightest. */
export const brightness = (m: Mode) => MODES.indexOf(m);

export const brighterThan = (m: Mode): Mode | null => MODES[brightness(m) - 1] ?? null;
export const darkerThan = (m: Mode): Mode | null => MODES[brightness(m) + 1] ?? null;

/** Spelled note names of the mode in degree order, e.g. "A B C D E F♯ G". */
export const modeSpelling = (root: NoteName, mode: Mode): string[] =>
  mode.intervals.map((iv) => noteAt(noteIndex(root) + iv));

/** "A Dorian" */
export const modeName = (root: NoteName, mode: Mode) => `${root} ${mode.name}`;
