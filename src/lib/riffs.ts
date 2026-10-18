// Riffs and licks, written on real strings and frets so a bend or a slide is
// a physical thing the neck can show. Every one is written in A, mostly
// around the fifth fret, and slid up or down the neck as one shape to reach
// any other key — which is how they actually move.
//
// A riff is a one-bar figure low on the neck, meant to repeat. A lick is a
// lead phrase, one or two bars on the higher strings, that ends by landing
// on the root.

import { ModeId } from "./modes";
import { midiAt } from "./theory";

export type Tech = "hammer" | "pull" | "slide" | "bend" | "release" | "vibrato";

export interface RiffNote {
  /** Start, in eighth notes from the top of the phrase (0-7 a bar, 8-15 the next). */
  at: number;
  /** Length in eighth notes. */
  len: number;
  /** 0 = low E … 5 = high E. */
  string: number;
  fret: number;
  tech?: Tech;
  /** Slide: the fret it slides to. Bend and release: the fret whose pitch the
   *  bend reaches (so a whole-step bend from 7 has `to` 9). */
  to?: number;
}

export interface Riff {
  id: string;
  name: string;
  modes: ModeId[];
  notes: RiffNote[];
  /** A lick: its last note is where it lands, and the neck marks it. */
  lands?: boolean;
}

const ALL: ModeId[] = ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian", "locrian"];
const n = (at: number, string: number, fret: number, len: number, tech?: Tech, to?: number): RiffNote =>
  ({ at, string, fret, len, tech, to });

/**
 * The ladder: one note for rhythm alone, then root and fifth, then one
 * colour note, then the techniques. Written in A; string 0 fret 5 is the root.
 */
export const RIFFS: Riff[] = [
  {
    id: "pulse", name: "One-note pulse", modes: ALL,
    notes: [n(0, 0, 5, 2), n(3, 0, 5, 1), n(4, 0, 5, 2), n(6, 0, 5, 2)],
  },
  {
    id: "root5", name: "Root and fifth", modes: ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian"],
    notes: [n(0, 0, 5, 2), n(2, 1, 7, 1), n(3, 1, 7, 1), n(4, 0, 5, 2), n(6, 1, 7, 2)],
  },
  {
    id: "hammer-home", name: "Hammer and pull", modes: ["dorian", "aeolian", "phrygian"],
    notes: [n(0, 0, 5, 2), n(2, 0, 8, 1), n(3, 1, 5, 1), n(4, 1, 7, 1, "hammer"), n(5, 1, 5, 1, "pull"), n(6, 0, 5, 2)],
  },
  {
    id: "slide-root", name: "Slide to the root", modes: ["mixolydian"],
    notes: [n(0, 0, 5, 2), n(2, 0, 3, 1), n(3, 0, 3, 2, "slide", 5), n(5, 1, 4, 1), n(6, 1, 5, 2, "hammer")],
  },
  {
    id: "boogie", name: "Boogie climb", modes: ["ionian", "mixolydian", "lydian"],
    notes: [n(0, 0, 5, 2), n(2, 1, 4, 1), n(3, 1, 7, 1), n(4, 1, 9, 1), n(5, 1, 7, 1), n(6, 1, 4, 2)],
  },
  {
    id: "leading", name: "Leading tone home", modes: ["ionian", "lydian"],
    notes: [n(0, 2, 7, 2), n(2, 3, 6, 1), n(3, 3, 9, 1), n(4, 2, 6, 1), n(5, 2, 7, 1, "hammer"), n(6, 2, 7, 2, "vibrato")],
  },
  {
    // Deliberately outside the mode: the ♯4 is the blues' blue note, bent up
    // into the 5 (away → home on the neck), and the ♭3 rubs against
    // Mixolydian's 3 the way every blues does.
    id: "blue-bend", name: "♯4 bends to 5", modes: ["mixolydian", "dorian", "aeolian"],
    notes: [n(0, 0, 5, 2), n(2, 2, 7, 1), n(3, 3, 5, 1), n(4, 3, 8, 3, "bend", 9), n(7, 2, 7, 1)],
  },
  {
    id: "bend-release", name: "Bend, release, vibrato", modes: ["dorian", "aeolian", "phrygian"],
    notes: [n(0, 3, 7, 2, "bend", 9), n(2, 3, 7, 1, "release", 9), n(3, 3, 5, 1, "pull"), n(4, 2, 7, 1), n(5, 2, 5, 1), n(6, 2, 7, 2, "vibrato")],
  },
  {
    id: "slide-five", name: "Slide into the 5", modes: ["dorian", "aeolian", "phrygian"],
    notes: [n(0, 1, 5, 2, "slide", 7), n(2, 0, 5, 2), n(4, 1, 5, 2, "slide", 7), n(6, 0, 8, 1), n(7, 0, 5, 1)],
  },
  {
    id: "dorian-six", name: "The Dorian 6", modes: ["dorian"],
    notes: [n(0, 0, 5, 1), n(1, 0, 8, 1), n(2, 1, 5, 1), n(3, 2, 4, 2), n(5, 1, 7, 1), n(6, 0, 5, 2)],
  },
  {
    id: "shimmer", name: "Lydian shimmer", modes: ["lydian"],
    notes: [n(0, 2, 7, 1), n(1, 2, 9, 1, "hammer"), n(2, 3, 6, 1), n(3, 3, 8, 3, "bend", 9), n(6, 3, 6, 2, "vibrato")],
  },
  {
    id: "push", name: "Phrygian push", modes: ["phrygian", "locrian"],
    notes: [n(0, 0, 5, 1), n(1, 0, 6, 1, "hammer"), n(2, 0, 5, 2, "pull"), n(4, 0, 5, 1), n(5, 0, 6, 1, "hammer"), n(6, 0, 8, 2)],
  },
  {
    id: "edge", name: "Locrian edge", modes: ["locrian"],
    notes: [n(0, 0, 5, 1), n(1, 0, 6, 1, "hammer"), n(2, 1, 6, 2), n(4, 1, 5, 1), n(5, 1, 6, 1, "hammer"), n(6, 0, 5, 2)],
  },
  {
    id: "half-bend", name: "Half-step bend home", modes: ["ionian", "lydian"],
    notes: [n(0, 0, 5, 2), n(2, 2, 6, 2, "bend", 7), n(4, 1, 7, 1), n(5, 1, 4, 1), n(6, 0, 5, 2)],
  },
  {
    id: "major-slide", name: "Major slide", modes: ["ionian", "mixolydian", "lydian"],
    notes: [n(0, 1, 2, 2, "slide", 4), n(2, 0, 5, 2), n(4, 1, 7, 1), n(5, 1, 9, 1), n(6, 1, 7, 2)],
  },
  {
    id: "flat-five-stab", name: "♭5 stab", modes: ["locrian"],
    notes: [n(0, 0, 5, 1), n(1, 1, 6, 1), n(2, 0, 5, 1), n(3, 1, 6, 1), n(4, 0, 5, 1), n(5, 0, 8, 1), n(6, 0, 6, 2, "pull")],
  },
  {
    id: "shake", name: "Half-step shake", modes: ["locrian", "phrygian"],
    notes: [n(0, 0, 5, 1), n(1, 0, 6, 1, "hammer"), n(2, 0, 5, 1, "pull"), n(3, 0, 6, 1, "hammer"), n(4, 0, 5, 2, "pull"), n(6, 1, 5, 2, "vibrato")],
  },
];

/**
 * Licks: lead phrases on the top strings, three a mode, each ending on the
 * root. The landing is the point — every one resolves, so you hear where
 * home is in that mode. Written in A.
 */
export const LICKS: Riff[] = [
  // Ionian — A B C♯ D E F♯ G♯
  { id: "l-ion-resolve", name: "Bend and resolve", modes: ["ionian"], lands: true,
    notes: [n(0, 4, 7, 1), n(1, 4, 9, 1, "hammer"), n(2, 5, 7, 2, "bend", 9), n(4, 5, 7, 1, "release", 9), n(5, 5, 5, 1, "pull"), n(6, 5, 5, 2, "vibrato")] },
  { id: "l-ion-run", name: "Major pentatonic run", modes: ["ionian", "lydian", "mixolydian"], lands: true,
    notes: [n(0, 3, 6, 1), n(1, 4, 5, 1), n(2, 4, 7, 1), n(3, 5, 5, 1), n(4, 5, 7, 2, "slide", 9), n(6, 5, 9, 2, "vibrato"),
      n(8, 5, 9, 1), n(9, 5, 7, 1, "pull"), n(10, 5, 5, 1, "pull"), n(11, 4, 7, 1), n(12, 4, 5, 1), n(13, 3, 6, 1), n(14, 2, 7, 2, "vibrato")] },
  { id: "l-ion-leading", name: "Leading tone pull", modes: ["ionian"], lands: true,
    notes: [n(0, 3, 7, 1), n(1, 3, 6, 1), n(2, 3, 4, 1), n(3, 2, 6, 1), n(4, 2, 7, 4, "hammer")] },
  // Mixolydian — A B C♯ D E F♯ G
  { id: "l-mix-bend", name: "Dominant bend", modes: ["mixolydian"], lands: true,
    notes: [n(0, 4, 8, 1), n(1, 4, 5, 1), n(2, 3, 7, 2, "bend", 9), n(4, 3, 7, 1, "release", 9), n(5, 3, 6, 1, "pull"), n(6, 2, 7, 2, "vibrato")] },
  { id: "l-mix-slide", name: "♭7 slide home", modes: ["mixolydian"], lands: true,
    notes: [n(0, 5, 3, 1), n(1, 5, 3, 2, "slide", 5), n(3, 4, 5, 1), n(4, 4, 2, 1), n(5, 3, 4, 1), n(6, 3, 2, 2, "vibrato")] },
  { id: "l-mix-answer", name: "Call and answer", modes: ["mixolydian"], lands: true,
    notes: [n(0, 3, 6, 1), n(1, 3, 7, 1, "hammer"), n(2, 3, 6, 1, "pull"), n(3, 2, 7, 1), n(4, 2, 5, 2), n(6, 2, 4, 2, "slide", 7),
      n(8, 4, 8, 2, "bend", 10), n(10, 4, 8, 1, "release", 10), n(11, 4, 5, 1), n(12, 3, 6, 1), n(13, 3, 7, 1), n(14, 2, 7, 2, "vibrato")] },
  // Dorian — A B C D E F♯ G
  { id: "l-dor-fall", name: "Falling 6", modes: ["dorian"], lands: true,
    notes: [n(0, 4, 8, 1), n(1, 4, 7, 1, "pull"), n(2, 4, 5, 1, "pull"), n(3, 3, 7, 1), n(4, 3, 5, 1), n(5, 2, 7, 3, "vibrato")] },
  { id: "l-dor-bend", name: "Bend to the 6", modes: ["dorian"], lands: true,
    notes: [n(0, 3, 7, 2, "bend", 9), n(2, 3, 7, 1, "release", 9), n(3, 3, 5, 1, "pull"), n(4, 2, 7, 1), n(5, 2, 4, 1), n(6, 2, 4, 2, "slide", 7)] },
  { id: "l-dor-long", name: "Dorian question", modes: ["dorian"], lands: true,
    notes: [n(0, 5, 5, 1), n(1, 5, 7, 1, "hammer"), n(2, 5, 5, 1, "pull"), n(3, 4, 8, 1), n(4, 4, 7, 2, "vibrato"), n(6, 4, 5, 2),
      n(8, 3, 7, 2, "bend", 9), n(10, 3, 5, 1), n(11, 2, 7, 1), n(12, 2, 5, 1), n(13, 2, 7, 3, "hammer")] },
  // Aeolian — A B C D E F G
  { id: "l-aeo-cry", name: "Minor cry", modes: ["aeolian", "dorian"], lands: true,
    notes: [n(0, 5, 8, 2, "bend", 10), n(2, 5, 8, 1, "release", 10), n(3, 5, 5, 1, "pull"), n(4, 4, 8, 1), n(5, 4, 5, 1), n(6, 2, 7, 2, "vibrato")] },
  { id: "l-aeo-sigh", name: "♭6 sigh", modes: ["aeolian"], lands: true,
    notes: [n(0, 4, 6, 2, "vibrato"), n(2, 4, 5, 1, "pull"), n(3, 3, 7, 1), n(4, 3, 5, 1), n(5, 3, 4, 1), n(6, 2, 7, 2, "vibrato")] },
  { id: "l-aeo-climb", name: "Aeolian climb", modes: ["aeolian"], lands: true,
    notes: [n(0, 2, 7, 1), n(1, 3, 4, 1), n(2, 3, 5, 1, "hammer"), n(3, 3, 7, 1), n(4, 4, 5, 1), n(5, 4, 6, 1, "hammer"), n(6, 4, 8, 2),
      n(8, 5, 5, 2, "slide", 8), n(10, 5, 8, 2, "bend", 10), n(12, 5, 8, 1, "release", 10), n(13, 5, 5, 3, "pull")] },
  // Phrygian — A B♭ C D E F G
  { id: "l-phr-fall", name: "♭2 fall", modes: ["phrygian"], lands: true,
    notes: [n(0, 4, 6, 1), n(1, 4, 5, 1, "pull"), n(2, 3, 7, 1), n(3, 3, 5, 1), n(4, 3, 3, 1), n(5, 3, 2, 3, "pull")] },
  { id: "l-phr-bend", name: "Phrygian bend", modes: ["phrygian"], lands: true,
    notes: [n(0, 4, 6, 2, "bend", 8), n(2, 4, 6, 1, "release", 8), n(3, 4, 5, 1, "pull"), n(4, 5, 6, 2, "vibrato"), n(6, 5, 5, 2, "pull")] },
  { id: "l-phr-long", name: "Phrygian turn", modes: ["phrygian"], lands: true,
    notes: [n(0, 2, 7, 1), n(1, 2, 8, 1, "hammer"), n(2, 2, 7, 1, "pull"), n(3, 3, 5, 1), n(4, 3, 7, 2, "vibrato"), n(6, 3, 5, 2),
      n(8, 3, 3, 1), n(9, 3, 5, 1, "hammer"), n(10, 3, 3, 1, "pull"), n(11, 3, 2, 5, "pull")] },
  // Lydian — A B C♯ D♯ E F♯ G♯
  { id: "l-lyd-float", name: "♯4 float", modes: ["lydian"], lands: true,
    notes: [n(0, 3, 6, 1), n(1, 3, 8, 1), n(2, 3, 9, 1, "hammer"), n(3, 3, 8, 1, "pull"), n(4, 4, 9, 2, "vibrato"), n(6, 4, 10, 2, "hammer")] },
  { id: "l-lyd-bend", name: "Lydian bend", modes: ["lydian"], lands: true,
    notes: [n(0, 4, 7, 1), n(1, 4, 9, 1, "hammer"), n(2, 3, 8, 2, "bend", 9), n(4, 3, 6, 1), n(5, 2, 7, 3, "vibrato")] },
  { id: "l-lyd-high", name: "High shimmer", modes: ["lydian"], lands: true,
    notes: [n(0, 5, 5, 1), n(1, 5, 7, 1, "hammer"), n(2, 5, 9, 1, "hammer"), n(3, 5, 11, 1), n(4, 5, 12, 2, "vibrato"), n(6, 5, 11, 2),
      n(8, 5, 9, 1), n(9, 4, 12, 1), n(10, 4, 9, 1), n(11, 4, 10, 5, "hammer")] },
  // Locrian — A B♭ C D E♭ F G
  { id: "l-loc-tremble", name: "♭5 tremble", modes: ["locrian"], lands: true,
    notes: [n(0, 3, 8, 2, "vibrato"), n(2, 3, 7, 1, "pull"), n(3, 3, 5, 1), n(4, 3, 3, 1), n(5, 3, 2, 3, "pull")] },
  { id: "l-loc-sigh", name: "Locrian sigh", modes: ["locrian"], lands: true,
    notes: [n(0, 4, 6, 1), n(1, 4, 8, 1, "hammer"), n(2, 4, 6, 1, "pull"), n(3, 4, 4, 1), n(4, 3, 7, 1), n(5, 3, 5, 1), n(6, 2, 7, 2)] },
  { id: "l-loc-dim", name: "Diminished climb", modes: ["locrian"], lands: true,
    notes: [n(0, 2, 7, 1), n(1, 3, 5, 1), n(2, 3, 8, 1), n(3, 4, 8, 1), n(4, 4, 6, 1, "pull"), n(5, 4, 4, 1, "pull"), n(6, 2, 7, 2)] },
];


export const riffsFor = (mode: ModeId) => RIFFS.filter((r) => r.modes.includes(mode));
export const licksFor = (mode: ModeId) => LICKS.filter((r) => r.modes.includes(mode));


export const shifted = (r: Riff, by: number): RiffNote[] =>
  r.notes.map((x) => ({ ...x, fret: x.fret + by, to: x.to === undefined ? undefined : x.to + by }));

/** A riff note on the clock: when it sounds, and where the hand is. */
export interface RiffEvent extends RiffNote {
  start: number;
  end: number;
  /** Fret of the note before it on the same string, for hammer and pull arcs. */
  from?: number;
  /** Which step of the phrase, from 1; notes struck together share one. */
  order: number;
}

/** Step numbers: each distinct start time is one step, so a chord is one. */
export function steps(notes: RiffNote[]): number[] {
  const ats = [...new Set(notes.map((x) => x.at))].sort((a, b) => a - b);
  return notes.map((x) => ats.indexOf(x.at) + 1);
}

/** How many bars a phrase spans. */
export const barsOf = (notes: RiffNote[]) => Math.max(1, Math.ceil(Math.max(0, ...notes.map((x) => x.at + x.len)) / 8));

/** Lay a bar of riff notes on the audio clock, from `barStart`. */
export function timeline(notes: RiffNote[], barStart: number, secPerEighth: number): RiffEvent[] {
  const last: Record<number, number> = {};
  const order = steps(notes);
  return notes.map((x, i) => {
    const ev = {
      ...x,
      start: barStart + x.at * secPerEighth,
      end: barStart + (x.at + x.len) * secPerEighth,
      from: last[x.string],
      order: order[i],
    };
    last[x.string] = x.tech === "slide" && x.to !== undefined ? x.to : x.fret;
    return ev;
  });
}

/**
 * When a slide, bend or release moves, in audio time — shared by the sound
 * and the animation so the eye and the ear agree. A slide leaves after a
 * moment on its first fret; a bend rises almost at once; a release starts
 * bent and comes straight down. About an eighth note, never sluggish.
 */
export function moveWindow(e: { start: number; tech?: Tech }, secPerEighth: number): [number, number] {
  const move = Math.min(secPerEighth, 0.28);
  if (e.tech === "slide") return [e.start + secPerEighth * 0.25, e.start + secPerEighth * 0.25 + move];
  if (e.tech === "bend") return [e.start + 0.03, e.start + 0.03 + move * 1.2];
  if (e.tech === "release") return [e.start, e.start + move];
  return [e.start, e.start];
}

export const midiOf = (e: RiffNote) => midiAt(e.string, e.fret);
