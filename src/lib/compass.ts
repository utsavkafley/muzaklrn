// The major triad as a compass. Every interval sits a fret or two from one
// of the major triad's notes, on the same string:
//
//   around the 1   ♭2 one up, 2 two up, 7 one down, ♭7 two down
//   around the 3   4 one up, ♯4 two up, ♭3 one down
//   around the 5   ♭6 one up, 6 two up, ♭5 one down
//
// So any chord is the major triad on its root, edited: a minor chord drops
// the 3 a fret, a m7 adds the ♭7 two frets under the 1, a m11 adds the 9
// two over the 1 and the 11 one over the 3. Find the triad, then reach.
// 9, 11 and 13 are the 2, 4 and 6 an octave up — the same spots.

import { DiatonicChord } from "./harmony";
import { ANY_STRINGS, NEAREST, Placed, Segment, placeShapes } from "./lines";
import { RiffNote } from "./riffs";
import { pitchAt } from "./theory";

/** Where an interval lives: which note of the major triad, and how many frets from it. */
const REACH: { from: 0 | 4 | 7; by: number }[] = [
  { from: 0, by: 0 }, { from: 0, by: 1 }, { from: 0, by: 2 }, { from: 4, by: -1 },
  { from: 4, by: 0 }, { from: 4, by: 1 }, { from: 7, by: -1 }, { from: 7, by: 0 },
  { from: 7, by: 1 }, { from: 7, by: 2 }, { from: 0, by: -2 }, { from: 0, by: -1 },
];

/** How far a chord is dressed: as it stands, with its 6th, or stacked to the 7th, 9th or 11th. */
export type Dress = "chord" | "6" | "7" | "9" | "11";

export interface Tone {
  /** Semitones above the chord's root. */
  semis: number;
  /** As a chord chart writes it: 1, ♭3, 5, ♭7, 9, 11. */
  label: string;
}

export interface Formula {
  /** The chord's name with its dressing: Am11. */
  name: string;
  tones: Tone[];
  /** The note that makes it this chord — usually the last thing in its name. Aim for it. */
  aim: Tone;
}

const LOW = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♯5", "6", "♭7", "7"];
/** Above the 7th, the 2, 4 and 6 are named an octave up. */
const HIGH: Record<number, string> = { 1: "♭9", 2: "9", 3: "♯9", 5: "11", 6: "♯11", 8: "♭13", 9: "13" };

const SUFFIX: Record<string, string> = {
  "0,4,7": "", "0,3,7": "m", "0,3,6": "°", "0,4,8": "+", "0,2,7": "sus2", "0,5,7": "sus4",
  "0,4,7,9": "6", "0,2,4,7": "add9", "0,2,3,7": "m(add9)", "0,5,7,10": "7sus4", "0,3,7,9": "m6", "0,4,7,8": "(♭6)", "0,3,7,8": "m(♭6)", "0,3,6,8": "°(♭6)",
  "0,4,7,11": "maj7", "0,4,7,10": "7", "0,3,7,10": "m7", "0,3,6,10": "m7♭5", "0,3,7,11": "m(maj7)",
  "0,2,4,7,11": "maj9", "0,2,4,7,10": "9", "0,2,3,7,10": "m9", "0,1,3,7,10": "m7♭9", "0,1,3,6,10": "m7♭5♭9",
  "0,2,3,6,10": "m9♭5", "0,1,4,7,10": "7♭9",
  "0,2,4,5,7,11": "maj11", "0,2,4,6,7,11": "maj9♯11", "0,2,4,5,7,10": "11", "0,2,3,5,7,10": "m11",
  "0,1,3,5,7,10": "m11♭9", "0,1,3,5,6,10": "m11♭5♭9", "0,2,3,5,6,10": "m11♭5",
};

/**
 * A chord's formula, dressed from the key's own notes: its 6th, 7th, 9th
 * and 11th are the scale notes that many steps above its root, so a dressed
 * chord still belongs to the mode.
 */
export function formulaOf(chord: DiatonicChord, scale: number[], dress: Dress): Formula {
  const own = chord.tones.map((t) => (t - chord.semis + 12) % 12);
  const above = (steps: number) => (scale[(chord.degree + steps) % 7] - chord.semis + 24) % 12;
  const triad = own.slice(0, 3);
  const extra = dress === "6" ? [above(5)]
    : dress === "7" ? [above(6)]
    : dress === "9" ? [above(6), above(1)]
    : dress === "11" ? [above(6), above(1), above(3)]
    : [];
  const base = dress === "chord" ? own : triad;
  // Past the 1 3 5 (and 7), a 2, 4 or 6 sits above the octave and is named
  // there: the 9 of Cadd9, the 9 and 11 of Am11. A chord's own 6th stays a 6.
  const stacked = dress === "9" || dress === "11" || (dress === "chord" && own.length > 3);
  const tones: Tone[] = [...base, ...extra]
    .filter((s, i, a) => a.indexOf(s) === i)
    .map((s, i) => ({
      semis: s,
      label: stacked && (i >= 4 || (i === 3 && s !== 9 && s !== 10 && s !== 11)) ? HIGH[s] ?? LOW[s] : LOW[s],
    }));
  const key = tones.map((t) => t.semis).sort((a, b) => a - b).join(",");
  const root = chord.name.match(/^[A-G][♯♭#b]?/)?.[0] ?? chord.name;
  const suffix = SUFFIX[key];
  // The note that makes the chord — the last thing in its name: a sus
  // chord's 2 or 4, else the last note stacked on (the 6 of C6, the 11 of
  // Am11), else its 7th, else whatever replaced the major 3rd or 5th.
  const sus = own[1] === 2 || own[1] === 5 ? tones[1] : undefined;
  const aim = (dress === "chord" ? sus : undefined)
    ?? (extra.length || own.length > 3 ? tones[tones.length - 1] : undefined)
    ?? tones.find((t) => t.semis === 10 || t.semis === 11)
      ?? tones.find((t) => t.semis === 6 || t.semis === 8)
      ?? tones.find((t) => [3, 2, 5].includes(t.semis))
      ?? tones.find((t) => t.semis === 4)!;
  const name = dress === "chord" ? chord.name
    : suffix === undefined ? `${root} (${tones.map((t) => t.label).join(" ")})` : root + suffix;
  return { name, tones, aim };
}

/** One of the major triad's notes the chord moved off: drawn as a ghost, with where it went. */
export interface Ghost { string: number; fret: number; label: string }
/** A reach from a triad note to an interval found from it. */
export interface Reach { from: { string: number; fret: number }; to: { string: number; fret: number } }
export interface CompassBar {
  notes: RiffNote[]; ghosts: Ghost[]; reaches: Reach[];
  /** Each chord's major triad shape, as placed. */
  shapes: (Placed | null)[];
}

/**
 * For every chord: its root's major triad as a shape inside the position,
 * each note of its formula found from that triad, and a line through them —
 * up the chord, then landing on the note that names it, held.
 */
export function compassLines(
  chords: DiatonicChord[][], keyPc: number, scale: number[], lo: number, dress: Dress,
  low = ANY_STRINGS, bottom = NEAREST,
): CompassBar[] {
  const majors: Segment[][] = chords.map((cs) => cs.map((c) => {
    const r = (keyPc + c.semis) % 12;
    return { pcs: [r, (r + 4) % 12, (r + 7) % 12] };
  }));
  const shapes = placeShapes(majors, low, lo, bottom);
  return chords.map((cs, b) => {
    const span = 8 / Math.max(cs.length, 1);
    const bar: CompassBar = { notes: [], ghosts: [], reaches: [], shapes: shapes[b] };
    cs.forEach((c, k) => {
      const sh = shapes[b][k];
      if (!sh) return;
      const f = formulaOf(c, scale, dress);
      const r = (keyPc + c.semis) % 12;
      // Which string and fret holds each triad note in this shape.
      const member = (iv: 0 | 4 | 7) => {
        const si = sh.frets.findIndex((fr, i) => pitchAt(sh.s + i, fr) === (r + iv) % 12);
        return { string: sh.s + si, fret: sh.frets[si] };
      };
      const placed = f.tones.map((t) => {
        const { from, by } = REACH[t.semis];
        const m = member(from);
        let fret = m.fret + by;
        if (fret < 0) fret += 12;
        if (by !== 0) bar.reaches.push({ from: m, to: { string: m.string, fret } });
        return { t, string: m.string, fret };
      });
      for (const iv of [0, 4, 7] as const) {
        if (!f.tones.some((t) => t.semis === iv)) bar.ghosts.push({ ...member(iv), label: LOW[iv] });
      }
      // Up through the chord, the named note saved for last and held.
      const order = placed
        .filter((p) => p.t !== f.aim)
        .sort((x, y) => x.string - y.string || x.fret - y.fret)
        .concat(placed.filter((p) => p.t === f.aim));
      const step = order.length <= span / 2 ? 2 : 1;
      const fit = order.slice(-Math.floor(span / step));
      fit.forEach((p, i) => bar.notes.push({
        at: k * span + i * step,
        len: i === fit.length - 1 ? span - i * step : step,
        string: p.string, fret: p.fret, label: p.t.label,
      }));
    });
    return bar;
  });
}
