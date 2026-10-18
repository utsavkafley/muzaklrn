"use client";

import { useRef, useState } from "react";
import type { BarClock } from "@/components/BeatLine";
import type { Phrase } from "@/components/practice/types";
import { Glide, Voice, riffNote } from "./audio";
import { audioCtx } from "./audio";
import { RiffEvent, RiffNote, barsOf, midiOf, moveWindow, timeline } from "./riffs";

/**
 * Sound one bar of a phrase from `barStart`, the way the hand plays it: a new
 * note on a string cuts the last one on that string, as a fretting hand
 * does. Returns the notes on the clock, for the neck to animate.
 */
export function playBar(notes: RiffNote[], barStart: number, secPerEighth: number, voices: Voice[]): RiffEvent[] {
  const evs = timeline(notes, barStart, secPerEighth);
  const ringing: Record<number, Voice> = {};
  for (const e of evs) {
    ringing[e.string]?.stop(e.start);
    const [m0, m1] = moveWindow(e, secPerEighth);
    const glides: Glide[] = [];
    let midi = midiOf(e);
    if (e.to !== undefined && e.tech === "slide") {
      glides.push({ at: m0, dur: m1 - m0, midi: midi + (e.to - e.fret), stepped: true });
    } else if (e.to !== undefined && e.tech === "bend") {
      glides.push({ at: m0, dur: m1 - m0, midi: midi + (e.to - e.fret) });
    } else if (e.to !== undefined && e.tech === "release") {
      // Starts already bent up, comes back down to the fretted note.
      glides.push({ at: m0, dur: m1 - m0, midi });
      midi += e.to - e.fret;
    }
    const v = riffNote({
      midi, when: e.start, dur: e.end - e.start, glides,
      picked: e.tech !== "hammer" && e.tech !== "pull" && e.tech !== "release",
      vibrato: e.tech === "vibrato",
    });
    voices.push(v);
    ringing[e.string] = v;
  }
  return evs;
}

/** The notes of one bar of a phrase, timed from the top of that bar. */
export const barOf = (notes: RiffNote[], part: number) =>
  notes.filter((x) => x.at >= part * 8 && x.at < part * 8 + 8).map((x) => ({ ...x, at: x.at - part * 8 }));

/**
 * The phrase player's clock: bar starts for the beat line, notes for the neck
 * to animate, and a one-off preview that runs without the metronome. The
 * metronome drives it a bar at a time through `bar`.
 */
export function usePhrasePlayer(voices: React.RefObject<Voice[]>) {
  const events = useRef<RiffEvent[]>([]);
  const clock = useRef<BarClock[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Mark a bar on the clock, and sound `notes` in it if there are any. */
  const bar = (entry: BarClock, notes: RiffNote[] | null) => {
    clock.current = [...clock.current.slice(-3), entry];
    if (!notes) return;
    const evs = playBar(notes, entry.start, entry.secPerEighth, voices.current);
    events.current = [...events.current.filter((e) => e.end > entry.start - 1), ...evs];
  };

  const reset = () => {
    events.current = [];
    clock.current = [];
  };

  /** Play a phrase once, now, every bar of it. */
  const preview = (p: Phrase, bpm: number) => {
    const spe = 60 / bpm / 2;
    const at = audioCtx().currentTime + 0.08;
    const all = p.notesFor(null, 0);
    const len = barsOf(all);
    reset();
    for (let part = 0; part < len; part++) {
      bar({ start: at + part * 8 * spe, secPerEighth: spe, countIn: false, yours: false, part }, barOf(all, part));
    }
    setPreviewing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreviewing(false), (len * 8 * spe + 0.4) * 1000);
  };

  return { events, clock, previewing, bar, reset, preview };
}
