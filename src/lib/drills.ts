// Dexterity drills: the key's notes laid out across the strings, put
// through a sequence, picked a particular way, in a particular meter. Every
// setting is a small, separate choice, so the tab can be rebuilt the moment
// one changes and you can hear what each one does to your hands.

import { midiAt, pitchAt } from "./theory";
import { windowFrets } from "./lines";

/** How the notes sit on the strings: as they fall in the window, or so many per string. */
export type Layout = "window" | 2 | 3 | 4;
export type Sequence = "straight" | "threes" | "fours" | "thirds";
export type Direction = "up" | "down" | "updown";
export type Picking = "alternate" | "economy" | "legato";
/** D a downstroke, U an upstroke, h a hammer-on, p a pull-off. */
export type Stroke = "D" | "U" | "h" | "p";

export interface Meter {
  id: string;
  /** Beats in a bar, counted in `unit`s. */
  beats: number;
  unit: 4 | 8;
  /** How the beats group: a strong pulse starts each group. 7/8 is 2+2+3. */
  groups: number[];
}

export const METERS: Meter[] = [
  { id: "4/4", beats: 4, unit: 4, groups: [4] },
  { id: "3/4", beats: 3, unit: 4, groups: [3] },
  { id: "5/4", beats: 5, unit: 4, groups: [3, 2] },
  { id: "6/8", beats: 6, unit: 8, groups: [3, 3] },
  { id: "7/8", beats: 7, unit: 8, groups: [2, 2, 3] },
];

/** Notes per beat each meter allows: up to sixteenths over a quarter, two per eighth. */
export const subsFor = (m: Meter) => (m.unit === 4 ? [1, 2, 3, 4] : [1, 2]);

export interface DrillNote { string: number; fret: number; stroke: Stroke }

export interface Drill {
  notes: DrillNote[];
  /** Note slots in a bar. */
  perBar: number;
  bars: number;
  /** The sequence once through, before it is padded out to whole bars. */
  cycle: number;
}

interface Spot { string: number; fret: number; midi: number }

/**
 * The scale's notes, low to high, laid out on the strings. In the window
 * they are every scale note the hand reaches there; N per string they climb
 * from the window's lowest scale note on the low E, N on each string, the
 * way three-notes-per-string runs are built — they may reach past the
 * window, but never fall below it.
 */
export function layoutNotes(pcs: number[], lo: number, span: number, layout: Layout, maxFret = 22): Spot[] {
  if (layout === "window") {
    const out: Spot[] = [];
    for (let s = 0; s < 6; s++) {
      for (const f of windowFrets(lo, span).sort((a, b) => a - b)) {
        if (pcs.includes(pitchAt(s, f))) out.push({ string: s, fret: f, midi: midiAt(s, f) });
      }
    }
    // One string at a time, low to high; a pitch already played on the string below is skipped.
    return out.filter((x, i) => !out.slice(0, i).some((y) => y.midi === x.midi));
  }
  // Every scale pitch from the first one on the low E in the window, upward.
  const startFret = [...Array(maxFret + 1).keys()].find((f) => f >= lo && pcs.includes(pitchAt(0, f)));
  if (startFret === undefined) return [];
  const ladder: number[] = [];
  for (let m = midiAt(0, startFret); m <= midiAt(5, maxFret); m++) {
    if (pcs.includes(((m % 12) + 12) % 12)) ladder.push(m);
  }
  const out: Spot[] = [];
  let k = 0;
  for (let s = 0; s < 6; s++) {
    // Fewer notes a string than the string's own reach would drift down the
    // neck; skip ahead in the scale instead, so the hand stays in the frame.
    while (k < ladder.length && ladder[k] - midiAt(s, 0) < lo - 1) k++;
    for (let n = 0; n < layout && k < ladder.length; n++, k++) {
      const fret = ladder[k] - midiAt(s, 0);
      if (fret < 0 || fret > maxFret) return out;
      out.push({ string: s, fret, midi: ladder[k] });
    }
  }
  return out;
}

/** A run through the notes in one direction, put through a sequence: 1 2 3, 2 3 4… */
function sequenced<T>(run: T[], seq: Sequence): T[] {
  if (seq === "straight") return run;
  const size = seq === "threes" ? 3 : seq === "fours" ? 4 : 0;
  const out: T[] = [];
  if (seq === "thirds") {
    for (let i = 0; i + 2 < run.length; i++) out.push(run[i], run[i + 2]);
    return out;
  }
  for (let i = 0; i + size <= run.length; i++) out.push(...run.slice(i, i + size));
  return out;
}

/** Strokes for a line of notes: strict alternate, economy (sweep across a string change), or legato. */
function strokes(line: Spot[], picking: Picking): Stroke[] {
  const out: Stroke[] = [];
  line.forEach((x, i) => {
    const prev = line[i - 1];
    const last = out[i - 1];
    const lastPick = [...out].reverse().find((s) => s === "D" || s === "U");
    if (!prev) return out.push("D");
    if (picking === "legato" && prev.string === x.string) return out.push(x.fret > prev.fret ? "h" : "p");
    if (picking === "economy" && prev.string !== x.string) {
      // The pick keeps travelling: down onto a higher string, up onto a lower one.
      return out.push(x.string > prev.string ? "D" : "U");
    }
    if (picking === "legato") return out.push(x.string > prev.string ? "D" : "U");
    out.push((last === "D" || last === "U" ? last : lastPick) === "D" ? "U" : "D");
  });
  return out;
}

export interface DrillSettings {
  layout: Layout;
  sequence: Sequence;
  direction: Direction;
  picking: Picking;
  meter: Meter;
  /** Notes per beat. */
  subs: number;
}

/**
 * The drill: notes, sequence and direction give the line; picking marks
 * each note; the meter and notes-per-beat cut it into bars. The line loops
 * to fill its last bar, so it always ends on a barline.
 */
export function buildDrill(pcs: number[], lo: number, span: number, s: DrillSettings): Drill {
  const notes = layoutNotes(pcs, lo, span, s.layout);
  const up = sequenced(notes, s.sequence);
  const down = sequenced([...notes].reverse(), s.sequence);
  const line = s.direction === "up" ? up
    : s.direction === "down" ? down
    // Up and back: the top note isn't played twice at the turn.
    : [...up, ...down.slice(up.length && down.length && up[up.length - 1] === down[0] ? 1 : 0)];
  const perBar = s.meter.beats * s.subs;
  if (!line.length) return { notes: [], perBar, bars: 1, cycle: 0 };
  const bars = Math.max(1, Math.ceil(line.length / perBar));
  const padded = Array.from({ length: bars * perBar }, (_, i) => line[i % line.length]);
  const marks = strokes(padded, s.picking);
  return {
    notes: padded.map((x, i) => ({ string: x.string, fret: x.fret, stroke: marks[i] })),
    perBar, bars, cycle: line.length,
  };
}

/** Where each beat's group starts, in beats from the top of the bar: the accents. */
export const accents = (m: Meter) => m.groups.reduce<number[]>((a, g, i) => [...a, i ? a[i - 1] + m.groups[i - 1] : 0], []);

/** The count under a note slot: 1 e & a, 1 trip let, 1 2 3 for eighths. */
export function countAt(m: Meter, subs: number, slot: number): string {
  const beat = Math.floor(slot / subs) + 1;
  const sub = slot % subs;
  if (sub === 0) return String(beat);
  if (subs === 2) return "&";
  if (subs === 3) return sub === 1 ? "trip" : "let";
  return ["", "e", "&", "a"][sub];
}
