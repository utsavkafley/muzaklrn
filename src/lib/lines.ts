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
}

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
          notes.push({ at: k * span + t, len: step, string: x.string, fret: x.fret });
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

/**
 * A triad shape for every chord, on one set of three strings: the first as
 * near the window as it can be, each after it the shape nearest the one
 * before — the inversion that moves least. Struck on beats 1 and 3, or once
 * for each chord of a split bar.
 */
export function shapeLines(bars: Segment[][], low: number, lo: number): RiffNote[][] {
  const run = (from: number | null) => {
    let last = from;
    const out = bars.map((segs) => {
      const notes: RiffNote[] = [];
      const per = segs.length === 2 ? 1 : 2;
      segs.forEach((seg, k) => {
        const shapes = triadShapes(seg.pcs.slice(0, 3), low);
        if (!shapes.length) return;
        const centre = (fr: number[]) => fr.reduce((a, b) => a + b, 0) / fr.length;
        const aim = last ?? lo + 2;
        const sh = shapes.reduce((b, x) => (Math.abs(centre(x.frets) - aim) < Math.abs(centre(b.frets) - aim) ? x : b));
        last = centre(sh.frets);
        for (let r = 0; r < per; r++) {
          sh.frets.forEach((f, si) => notes.push({ at: k * 4 + r * 4, len: 4, string: low + si, fret: f }));
        }
      });
      return notes;
    });
    return { out, last };
  };
  return run(run(null).last).out;
}

/** A chord tone's role, by its interval above the chord's root: R, ♭3, 3, 5, ♭7… */
export function roleLabel(semisAboveRoot: number): string {
  return ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♯5", "6", "♭7", "7"][((semisAboveRoot % 12) + 12) % 12];
}
