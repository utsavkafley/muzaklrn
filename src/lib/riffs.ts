// Notes written on real strings and frets, so a bend or a slide is a
// physical thing the neck can show, and laid on the audio clock to play.

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
  /** Shown on the note itself, in place of the neck's own label: an interval, say. */
  label?: string;
}

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
