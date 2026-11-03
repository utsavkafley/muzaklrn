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

/** One hand position: a finger per fret plus a stretch. The window can be dragged wider or narrower. */
export const SPAN = 5;

/** Frets in the window: `span` from `lo`, and the open strings when it starts at the nut. */
export const windowFrets = (lo: number, span = SPAN) =>
  Array.from({ length: span }, (_, k) => lo + k).concat(lo <= 1 ? [0] : []).filter((f, i, a) => a.indexOf(f) === i);

interface Spot { string: number; fret: number; midi: number; pc: number }

/**
 * Every note of `pcs` the hand can reach in the window, low to high, each
 * pitch once. The same pitch on two strings keeps the one nearer the middle
 * of the hand — or, in a window wider than a hand, the one on a diagonal
 * from its low corner to its high one: low notes low on the neck, high notes
 * high, so a line through it shifts position the way a player does.
 */
export function windowNotes(pcs: number[], lo: number, span = SPAN): Spot[] {
  const frets = windowFrets(lo, span);
  const all: Spot[] = [];
  for (let s = 0; s < 6; s++) {
    for (const f of frets) {
      const pc = pitchAt(s, f);
      if (pcs.includes(pc)) all.push({ string: s, fret: f, midi: midiAt(s, f), pc });
    }
  }
  if (!all.length) return [];
  const m0 = Math.min(...all.map((x) => x.midi)), m1 = Math.max(...all.map((x) => x.midi));
  const aim = (midi: number) => span <= SPAN || m1 === m0
    ? lo + (span - 1) / 2
    : lo + ((midi - m0) / (m1 - m0)) * (span - 1);
  const best = new Map<number, Spot>();
  for (const x of all) {
    const have = best.get(x.midi);
    if (!have || Math.abs(x.fret - aim(x.midi)) < Math.abs(have.fret - aim(x.midi))) best.set(x.midi, x);
  }
  return [...best.values()].sort((a, b) => a.midi - b.midi);
}

/**
 * A bar's rhythm, one character per eighth note from beat 1: `x` plays a
 * note, `-` holds the one before, `.` rests. Space is half of phrasing.
 */
export type Feel = string;

/**
 * How a line meets the next chord, on the last eighth before it:
 * `approach` plays a half step under (or over) the note it is heading for,
 * `push` plays the next chord's note early and lets it ring across the
 * change — an anticipation, the way a horn line leans into a bar.
 */
export type Lead = "none" | "approach" | "push";

/**
 * A chord-tone line for every bar: each segment walks its chord's notes in
 * the window (turning at the top or bottom), one note per hit of the feel,
 * and starts on the note nearest where the last segment ended. Worked out
 * twice so the last bar leads smoothly back into the first when it loops.
 */
export function toneLines(bars: Segment[][], lo: number, feel: Feel, lead: Lead = "none", span = SPAN): RiffNote[][] {
  const cells = feel.padEnd(8, ".").slice(0, 8);
  const frets = windowFrets(lo, span);
  /** A spot in the window for this exact pitch, nearest fret `near`. */
  const spotFor = (midi: number, near: number) => {
    let best: { string: number; fret: number } | null = null;
    for (let s = 0; s < 6; s++) {
      for (const f of frets) {
        if (midiAt(s, f) !== midi) continue;
        if (!best || Math.abs(f - near) < Math.abs(best.fret - near)) best = { string: s, fret: f };
      }
    }
    return best;
  };
  const nearest = (w: Spot[], midi: number) =>
    w.reduce((bi, x, xi) => (Math.abs(x.midi - midi) < Math.abs(w[bi].midi - midi) ? xi : bi), 0);

  /** Where a lead sent the next segment: the note it starts on, and whether it already rang (a push). */
  type Entry = { midi: number; pushed: boolean } | null;
  const run = (from: { last: number | null; entry: Entry }) => {
    let { last, entry } = from;
    const out = bars.map((segs, b) => {
      const notes: RiffNote[] = [];
      const n = Math.max(segs.length, 1);
      const per = 8 / n;
      segs.forEach((seg, k) => {
        const w = windowNotes(seg.pcs, lo, span);
        if (!w.length) return;
        const next = segs[k + 1] ?? bars[(b + 1) % bars.length][0];
        const mine = cells.slice(k * per, (k + 1) * per).split("");
        if (lead !== "none" && next) mine[per - 1] = "L";
        let i = -1, dir = 1;
        const advance = () => {
          if (w.length < 2) return;
          if (i + dir < 0 || i + dir >= w.length) dir = -dir;
          i += dir;
        };
        const came = entry;
        entry = null;
        mine.forEach((c, t) => {
          if (c !== "x" && c !== "L") return;
          let len = 1;
          while (t + len < per && mine[t + len] === "-") len++;
          const at = k * per + t;
          if (c === "L") {
            const nw = windowNotes(next.pcs, lo, span);
            if (!nw.length) return;
            const goal = nw[nearest(nw, last ?? nw[0].midi)];
            if (lead === "push") {
              notes.push({ at, len: 2, string: goal.string, fret: goal.fret, label: nameIn(next, goal.pc) });
              last = goal.midi;
              entry = { midi: goal.midi, pushed: true };
              return;
            }
            // A half step under where it's going, else over: the ear hears it lean in.
            const step = spotFor(goal.midi - 1, goal.fret) ?? spotFor(goal.midi + 1, goal.fret);
            entry = { midi: goal.midi, pushed: false };
            if (!step) return;
            notes.push({ at, len, string: step.string, fret: step.fret, label: nameIn(seg, pitchAt(step.string, step.fret)) });
            last = midiAt(step.string, step.fret);
            return;
          }
          if (i < 0) {
            i = nearest(w, came?.midi ?? last ?? w[Math.max(0, w.findIndex((x) => x.pc === seg.pcs[0]))].midi);
            // A pushed note already rang across the change: the downbeat holds it.
            if (came?.pushed && t === 0) {
              advance();
              return;
            }
          }
          const x = w[i];
          notes.push({ at, len, string: x.string, fret: x.fret, label: nameIn(seg, x.pc) });
          last = x.midi;
          advance();
        });
      });
      return notes;
    });
    return { out, last, entry };
  };
  return run(run({ last: null, entry: null })).out;
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
export function placeShapes(bars: Segment[][], low: number, lo: number, bottom = NEAREST, span = SPAN): (Placed | null)[][] {
  const sets = low === ANY_STRINGS ? [0, 1, 2, 3] : [low];
  const inHand = (fr: number[]) => fr.every((f) => (f >= lo && f < lo + span) || (f === 0 && lo <= 1));
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
      const aim = last ?? midiAt(Math.min(...sets) + 1, lo + Math.min(2, Math.floor((span - 1) / 2))) + (low === ANY_STRINGS ? 7 : 0);
      const sh = pool.reduce((b, x) => (Math.abs(pitch(x) - aim) < Math.abs(pitch(b) - aim) ? x : b));
      last = pitch(sh);
      return sh;
    }));
    return { out, last };
  };
  return run(run(null).last).out;
}

/** Each chord's triad shape, struck on beats 1 and 3, or once for each chord of a split bar. */
export function shapeLines(bars: Segment[][], low: number, lo: number, bottom = NEAREST, span = SPAN): RiffNote[][] {
  return placeShapes(bars, low, lo, bottom, span).map((shapes, b) => {
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
