"use client";

import { useEffect, useRef, useState } from "react";
import Fretboard, { FbNote } from "@/components/Fretboard";
import { Metronome, Voice, audioCtx, click, sticks } from "@/lib/audio";
import { MODES } from "@/lib/modes";
import { fretNotesFor, parseNote, spellInterval, spellNote } from "@/lib/theory";

const MAX_FRET = 15;
const COUNT_OFF = 4;
const clampBpm = (n: number) => Math.max(30, Math.min(240, Math.round(n)));

/**
 * What a degree does in a progression, which is how it feels. Three families,
 * the classic functional-harmony split:
 *   home    1, 3, 6 — rest; the chords built here (I, iii, vi) all sit still
 *   away    2, 4    — leaving home, open but unhurried (ii, IV)
 *   tension 5, 7    — leaning hard back toward 1 (V, vii°)
 * Keyed by how many letters the degree climbs, so ♭3 and 3 share a mood.
 */
type Mood = "home" | "away" | "tension";
const MOOD_BY_STEPS: Mood[] = ["home", "away", "home", "away", "tension", "home", "tension"];
const MOOD_FILL: Record<Mood, string> = {
  home: "#fbbf24",
  away: "#60a5fa",
  tension: "#fb7185",
};

/** Every interval above the root, by semitones. `steps` is how many letters
 *  it climbs, which is what spells it right. */
const INTERVALS = [
  { semis: 1, label: "♭2", steps: 1 },
  { semis: 2, label: "2", steps: 1 },
  { semis: 3, label: "♭3", steps: 2 },
  { semis: 4, label: "3", steps: 2 },
  { semis: 5, label: "4", steps: 3 },
  { semis: 6, label: "♭5", steps: 4 },
  { semis: 7, label: "5", steps: 4 },
  { semis: 8, label: "♭6", steps: 5 },
  { semis: 9, label: "6", steps: 5 },
  { semis: 10, label: "♭7", steps: 6 },
  { semis: 11, label: "7", steps: 6 },
];

/**
 * The tritone is spelled from what surrounds it: with the 4 gone and the 5
 * still there it is a raised 4 (Lydian), otherwise a flat 5 (Locrian, blues).
 */
function spelled(semis: number, shown: number[]) {
  const iv = INTERVALS.find((i) => i.semis === semis)!;
  if (semis === 6 && !shown.includes(5) && shown.includes(7)) return { ...iv, label: "♯4", steps: 3 };
  return iv;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function V2Page() {
  const [text, setText] = useState("");
  const note = parseNote(text);
  const name = spellNote(text);
  /** Intervals switched on, in semitones. They stay on as the root changes. */
  const [shown, setShown] = useState<number[]>([]);
  const toggle = (semis: number) =>
    setShown((s) => (s.includes(semis) ? s.filter((x) => x !== semis) : [...s, semis]));
  // A mode is just a set of intervals, so which one is selected is read off
  // the chips rather than stored: edit a chip and you have left the mode.
  const mode = MODES.find((m) => sameSet(m.intervals.slice(1), shown)) ?? null;

  const [bpmText, setBpmText] = useState("90");
  const parsedBpm = parseInt(bpmText, 10);
  const bpm = Number.isFinite(parsedBpm) ? clampBpm(parsedBpm) : 90;
  const [running, setRunning] = useState(false);
  /** The beat sounding now (0-3), and whether it is still the count-in. */
  const [beat, setBeat] = useState<{ sub: number; countIn: boolean } | null>(null);

  const met = useRef<Metronome | null>(null);
  const voices = useRef<Voice[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const silence = () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stop = () => {
    silence();
    setRunning(false);
    setBeat(null);
  };

  const start = () => {
    if (!met.current) met.current = new Metronome();
    const m = met.current;
    m.bpm = bpm;
    m.beatsPerBar = 4;
    m.subsPerBeat = 1;
    // Every start counts in with sticks for a bar, then the click takes over
    // on the next downbeat.
    m.onTick = (t) => {
      voices.current.push(t.count < COUNT_OFF ? sticks(t.when) : click(t.when, t.sub === 0));
      if (voices.current.length > 32) voices.current = voices.current.slice(-32);
      // Ticks are scheduled ahead; move the dot when the sound actually lands.
      const beatNow = { sub: t.sub, countIn: t.count < COUNT_OFF };
      const delay = Math.max(0, (t.when - audioCtx().currentTime) * 1000);
      timers.current.push(setTimeout(() => setBeat(beatNow), delay));
      if (timers.current.length > 32) timers.current = timers.current.slice(-32);
    };
    m.start();
    setRunning(true);
  };

  // Tempo edits land on the running click straight away.
  useEffect(() => {
    if (met.current) met.current.bpm = bpm;
  }, [bpm]);

  // Leaving the page takes the click with it.
  useEffect(() => silence, []);

  // The root everywhere it lives on the neck, up to MAX_FRET, plus every
  // interval switched on. Roots carry the note name, intervals their number.
  // The root wears a ring: it shares home's colour with the 3 and 6.
  const active = INTERVALS.filter((iv) => shown.includes(iv.semis)).map((iv) => spelled(iv.semis, shown));
  const dots: FbNote[] = note && name
    ? fretNotesFor(note, [0, ...active.map((iv) => iv.semis)], [name, ...active.map((iv) => iv.label)], MAX_FRET)
        .map((n) => {
          const iv = active.find((a) => a.label === n.degree);
          return {
            string: n.string, fret: n.fret, label: n.degree,
            fill: MOOD_FILL[iv ? MOOD_BY_STEPS[iv.steps] : "home"],
            ring: n.isRoot ? "#18181b" : undefined,
          };
        })
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pt-8 pb-24 sm:gap-10 sm:pt-12">
      {/* Three columns so the note stays dead centre whatever sits beside it. */}
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-end">
        <div />
        {/* outline-none! beats the global :focus-visible ring, which is unlayered
            and would otherwise win over a plain utility. */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          aria-label="note"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-24 border-b-2 border-neutral-300 bg-transparent pb-1 text-center text-4xl sm:w-32 sm:text-5xl font-bold text-neutral-900 caret-amber-600 outline-none! focus:border-amber-500"
        />
        <div className="flex items-end justify-end gap-1.5 sm:gap-3">
          <input
            value={bpmText}
            onChange={(e) => setBpmText(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onBlur={() => setBpmText(String(bpm))}
            aria-label="bpm"
            inputMode="numeric"
            autoComplete="off"
            className="w-12 border-b-2 border-neutral-300 bg-transparent pb-0.5 text-center text-xl font-bold tabular-nums text-neutral-900 caret-amber-600 outline-none! focus:border-amber-500"
          />
          <button
            onClick={running ? stop : start}
            aria-label="metronome"
            aria-pressed={running}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              running ? "bg-amber-400 text-neutral-950" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <MetronomeIcon />
          </button>
        </div>

        {/* Beat dots sit under the note. Space is always held for them so the
            neck doesn't jump when the click starts. */}
        <div aria-hidden className="col-start-2 mt-4 flex h-2.5 justify-center gap-2.5">
          {running && Array.from({ length: 4 }, (_, i) => (
            <span key={i}
              className={`h-2.5 w-2.5 rounded-full transition-colors duration-75 ${
                beat?.sub !== i ? "bg-neutral-200"
                  : beat.countIn ? "bg-neutral-500"
                  : "bg-amber-500"
              }`} />
          ))}
        </div>
      </div>

      <div className="w-full space-y-5">
        {/* Modes, brightest to darkest. Picking one sets the chips; picking it
            again clears them. */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {MODES.map((m) => {
            const on = mode?.id === m.id;
            return (
              <button key={m.id} aria-pressed={on} title={m.alias}
                onClick={() => setShown(on ? [] : m.intervals.slice(1))}
                className={`border-b-2 pb-0.5 text-sm transition-colors ${
                  on ? "border-amber-500 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                {m.name}
              </button>
            );
          })}
        </div>

        {note && name && (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {INTERVALS.map(({ semis }) => {
                const iv = spelled(semis, shown);
                const fill = MOOD_FILL[MOOD_BY_STEPS[iv.steps]];
                const on = shown.includes(semis);
                return (
                  <button key={semis} onClick={() => toggle(semis)} aria-pressed={on}
                    style={{ borderColor: on ? fill : undefined, background: on ? fill : undefined }}
                    className={`relative flex w-11 flex-col items-center rounded-xl border py-1.5 leading-tight transition-colors ${
                      on ? "text-neutral-950" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    }`}>
                    <span className="text-base font-bold">{iv.label}</span>
                    <span className={`text-xs ${on ? "text-neutral-800" : "text-neutral-400"}`}>
                      {spellInterval(name, iv.semis, iv.steps)}
                    </span>
                    {/* Off, a chip still hints at its mood. */}
                    {!on && (
                      <span aria-hidden style={{ background: fill }}
                        className="absolute -bottom-px left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-5 text-xs text-neutral-500">
              {(Object.keys(MOOD_FILL) as Mood[]).map((m) => (
                <span key={m} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: MOOD_FILL[m] }} />
                  {m}
                </span>
              ))}
            </div>

            {/* A phone gets the neck stood up so the dots stay finger-sized;
                anything wider gets it lying down, scaled to fit. */}
            <div className="sm:hidden">
              <Fretboard notes={dots} maxFret={MAX_FRET} vertical />
            </div>
            <div className="hidden sm:block">
              <Fretboard notes={dots} maxFret={MAX_FRET} fit />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetronomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 3h5l4.5 18H5z" />
      <path d="M12 17 17 7" />
      <circle cx={15.2} cy={10.6} r={1.3} fill="currentColor" />
      <path d="M7 17h10" />
    </svg>
  );
}
