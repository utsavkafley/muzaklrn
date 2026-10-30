// Lines through a progression, inside one hand position. Each chord's notes
// are played where the hand already is, and each new chord starts on the
// note nearest the last one played — the smallest move to the next chord,
// which is what makes changes sound joined up rather than jumped.

import { RiffNote } from "./riffs";
import { midiAt, pitchAt } from "./theory";
import { triadShapes } from "./shapes";

/** One chord's stretch of a bar: its pitch classes, root first. */
export interface Segment {
  pcs: number[];
  /** How the chord names each note, by semitones above its root: the 9 and 11 of Am11. */
  labels?: Record<number, string>;
}

/** A note's name in its segment's chord: the chord's own name for it, else its plain interval. */
const nameIn = (seg: Segment, pc: number) => {
  const iv = (((pc - seg.pcs[0]) % 12) + 12) % 12;
  return seg.labels?.[iv] ?? roleLabel(iv);
};

/** Frets in the window: four above `lo`, and the open strings when it starts at the nut. */
export const windowFrets = (lo: number) =>
  Array.from({ length: 5 }, (_, k) => lo + k).concat(lo <= 1 ? [0] : []).filter((f, i, a) => a.indexOf(f) === i);

interface Spot { string: number; fret: number; midi: number; pc: number }

/** Every note of `pcs` the hand can reach in the window, low to high, each pitch once. */
export function windowNotes(pcs: number[], lo: number): Spot[] {
  const mid = lo + 2;
  const best = new Map<number, Spot>();
  for (let s = 0; s < 6; s++) {
    for (const f of windowFrets(lo)) {
      const pc = pitchAt(s, f);
      if (!pcs.includes(pc)) continue;
      const midi = midiAt(s, f);
      const have = best.get(midi);
      // The same pitch on two strings: keep the one nearer the middle of the hand.
      if (!have || Math.abs(f - mid) < Math.abs(have.fret - mid)) best.set(midi, { string: s, fret: f, midi, pc });
    }
  }
  return [...best.values()].sort((a, b) => a.midi - b.midi);
}

export type Rhythm = "quarters" | "eighths";

/**
 * A chord-tone line for every bar: each segment walks up its chord's notes
 * (and turns at the top or bottom of the window), one per beat or two, and
 * starts on the note nearest where the last segment ended. Worked out twice
 * so the last bar leads smoothly back into the first when it loops.
 */
export function toneLines(bars: Segment[][], lo: number, rhythm: Rhythm): RiffNote[][] {
  const step = rhythm === "quarters" ? 2 : 1;
  const run = (from: number | null) => {
    let last = from;
    const out = bars.map((segs) => {
      const notes: RiffNote[] = [];
      const span = 8 / Math.max(segs.length, 1);
      segs.forEach((seg, k) => {
        const w = windowNotes(seg.pcs, lo);
        if (!w.length) return;
        let i = last === null
          ? Math.max(0, w.findIndex((x) => x.pc === seg.pcs[0]))
          : w.reduce((bi, x, xi) => (Math.abs(x.midi - last!) < Math.abs(w[bi].midi - last!) ? xi : bi), 0);
        let dir = 1;
        for (let t = 0; t < span; t += step) {
          const x = w[i];
          notes.push({ at: k * span + t, len: step, string: x.string, fret: x.fret, label: nameIn(seg, x.pc) });
          last = x.midi;
          if (w.length > 1) {
            if (i + dir < 0 || i + dir >= w.length) dir = -dir;
            i += dir;
          }
        }
      });
      return notes;
    });
    return { out, last };
  };
  return run(run(null).last).out;
}

/** Every string set at once: shapes are picked from all four. */
export const ANY_STRINGS = -1;

/** A three-string shape on the neck: its lowest string, a fret on it and the two above, and which triad note is lowest (0 the 1, 1 the 3, 2 the 5). */
export interface Placed { s: number; frets: number[]; bottom: number }

/** Any triad note may be lowest: the shape nearest the last one wins. */
export const NEAREST = -1;

/**
 * A triad shape for every segment (its first three pitch classes), inside
 * the hand position wherever one fits, on one set of three strings or any.
 * The first sits mid-hand, each after it is the shape whose notes move least
 * from the one before — the inversion a good rhythm player reaches for.
 * With `bottom` set, every chord takes that one shape (its 1, 3 or 5
 * lowest), the way you learn a shape: the same grip, chord after chord.
 */
export function placeShapes(bars: Segment[][], low: number, lo: number, bottom = NEAREST): (Placed | null)[][] {
  const sets = low === ANY_STRINGS ? [0, 1, 2, 3] : [low];
  const inHand = (fr: number[]) => fr.every((f) => (f >= lo && f <= lo + 4) || (f === 0 && lo <= 1));
  const pitch = (x: Placed) => x.frets.reduce((a, f, i) => a + midiAt(x.s + i, f), 0) / 3;
  const run = (from: number | null) => {
    let last = from;
    const out = bars.map((segs) => segs.map((seg) => {
      const all = sets.flatMap((s) => triadShapes(seg.pcs.slice(0, 3), s)
        .filter((sh) => bottom === NEAREST || sh.inversion === bottom)
        .map((sh) => ({ s, frets: sh.frets, bottom: sh.inversion })));
      const fits = all.filter((x) => inHand(x.frets));
      const pool = fits.length ? fits : all;
      if (!pool.length) return null;
      // Measured in pitch, so shapes on different strings compare fairly.
      const aim = last ?? midiAt(Math.min(...sets) + 1, lo + 2) + (low === ANY_STRINGS ? 7 : 0);
      const sh = pool.reduce((b, x) => (Math.abs(pitch(x) - aim) < Math.abs(pitch(b) - aim) ? x : b));
      last = pitch(sh);
      return sh;
    }));
    return { out, last };
  };
  return run(run(null).last).out;
}

/** Each chord's triad shape, struck on beats 1 and 3, or once for each chord of a split bar. */
export function shapeLines(bars: Segment[][], low: number, lo: number, bottom = NEAREST): RiffNote[][] {
  return placeShapes(bars, low, lo, bottom).map((shapes, b) => {
    const per = bars[b].length === 2 ? 1 : 2;
    return shapes.flatMap((sh, k) => (sh
      ? Array.from({ length: per }, (_, r) => sh.frets.map((f, si) => ({
        at: k * 4 + r * 4, len: 4, string: sh.s + si, fret: f, label: nameIn(bars[b][k], pitchAt(sh.s + si, f)),
      }))).flat()
      : []));
  });
}

/** A placed shape's notes, low string to high, as its segment's chord names them: "♭3 5 1". */
export const shapeOrder = (seg: Segment, p: Placed) =>
  p.frets.map((f, i) => nameIn(seg, pitchAt(p.s + i, f))).join(" ");

/** A chord tone's role, by its interval above the chord's root: 1, ♭3, 3, 5, ♭7… */
export function roleLabel(semisAboveRoot: number): string {
  return ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♯5", "6", "♭7", "7"][((semisAboveRoot % 12) + 12) % 12];
}
