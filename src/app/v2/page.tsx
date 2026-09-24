"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fretboard, { FbNote } from "@/components/Fretboard";
import { Metronome, Voice, audioCtx, click, pluck, sticks } from "@/lib/audio";
import { MODES } from "@/lib/modes";
import { NoteName, fretNotesFor, noteIndex, parseNote, spellInterval, spellNote } from "@/lib/theory";
import { DiatonicChord, INTERVALS, MOOD_FILL, Mood, diatonicChords, spelled, voicing } from "./harmony";

const MAX_FRET = 15;
const COUNT_OFF = 4;
const BARS = 4;
const clampBpm = (n: number) => Math.max(30, Math.min(240, Math.round(n)));
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Each mode's seven chord moods, in order: the mode's shape at a glance. */
const MODE_MOODS = Object.fromEntries(
  MODES.map((m) => [m.id, diatonicChords("C", m.intervals.slice(1))!.map((c) => c.mood)]),
);

const INK = "#18181b";
const PLAIN = "#d6d3d1";

/** Strum a chord low to high, returning every voice so a stop can cut it. */
function strum(midis: number[], when: number): Voice[] {
  return midis.map((m, i) => pluck(m, when + i * 0.014, 1.6, 0.3 * (1 - i * 0.06)));
}

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
  const chords = useMemo(() => (name ? diatonicChords(name, shown) : null), [name, shown]);

  // ---- progression ----
  // Slots hold scale degrees, not chords, so a progression follows the key and
  // the mode: I–IV–V–I in Dorian is a different, real thing.
  const [strip, setStrip] = useState<(number | null)[]>(Array(BARS).fill(null));
  /** The slot the next tapped chord lands in; null once the strip is full. */
  const [target, setTarget] = useState<number | null>(0);
  /** The chord last tapped, shown on the neck while nothing is playing. */
  const [held, setHeld] = useState<number | null>(null);

  const playChord = (c: DiatonicChord) => {
    if (!note) return;
    strum(voicing(note, c), audioCtx().currentTime);
    setHeld(c.degree);
    if (target === null) return;
    const next = strip.map((d, i) => (i === target ? c.degree : d));
    setStrip(next);
    // On to the next empty slot, wrapping; none left and the strip is done.
    const after = Array.from({ length: BARS }, (_, k) => (target + 1 + k) % BARS).find((i) => next[i] === null);
    setTarget(after ?? null);
  };

  const tapSlot = (i: number) => {
    // A second tap on the slot you are aiming at empties it.
    if (target === i && strip[i] !== null) {
      setStrip(strip.map((d, k) => (k === i ? null : d)));
    } else {
      setTarget(i);
    }
  };

  /** The selected mode's vamp from v1, as degrees of this scale. */
  const vamp = mode && chords
    ? mode.vamp.map((v) => chords.findIndex((c) => c.semis === v.semitones)).filter((d) => d >= 0)
    : [];
  const loadVamp = () => {
    setStrip(Array.from({ length: BARS }, (_, i) => vamp[i % vamp.length]));
    setTarget(null);
  };

  const clearStrip = () => {
    setStrip(Array(BARS).fill(null));
    setTarget(0);
    setHeld(null);
  };

  // ---- metronome ----
  const [bpmText, setBpmText] = useState("90");
  const parsedBpm = parseInt(bpmText, 10);
  const bpm = Number.isFinite(parsedBpm) ? clampBpm(parsedBpm) : 90;
  const [running, setRunning] = useState(false);
  /** The beat sounding now (0-3), whether it is still the count-in, and which
   *  strip slot is playing (-1 for none). */
  const [beat, setBeat] = useState<{ sub: number; countIn: boolean; slot: number } | null>(null);

  const met = useRef<Metronome | null>(null);
  const voices = useRef<Voice[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** What the clock plays, kept current for a tick callback that outlives renders. */
  const prog = useRef<{ slot: number; midis: number[] }[]>([]);

  useEffect(() => {
    prog.current = note && chords
      ? strip.flatMap((d, slot) => (d === null ? [] : [{ slot, midis: voicing(note, chords[d]) }]))
      : [];
  }, [note, chords, strip]);

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
    // on the next downbeat, with the progression strummed a bar at a time.
    m.onTick = (t) => {
      const countIn = t.count < COUNT_OFF;
      voices.current.push(countIn ? sticks(t.when) : click(t.when, t.sub === 0));
      let slot = -1;
      const p = prog.current;
      if (!countIn && p.length) {
        const bar = p[Math.floor((t.count - COUNT_OFF) / 4) % p.length];
        slot = bar.slot;
        if (t.sub === 0) voices.current.push(...strum(bar.midis, t.when));
      }
      if (voices.current.length > 48) voices.current = voices.current.slice(-48);
      // Ticks are scheduled ahead; move the display when the sound lands.
      const beatNow = { sub: t.sub, countIn, slot };
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

  // ---- the neck ----
  // Playing, the neck follows the bar; otherwise it shows the chord last tapped.
  const playingSlot = beat && beat.slot >= 0 ? beat.slot : null;
  const playingDegree = playingSlot !== null ? strip[playingSlot] : null;
  const shownDegree = running ? playingDegree : held;
  const chord = chords && shownDegree !== null ? chords[shownDegree] : null;
  const mood: Mood | null = running && chord ? chord.mood : null;

  const dots: FbNote[] = note && name ? neckDots(note, name, shown, chord) : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pt-8 pb-24 sm:gap-10 sm:pt-12">
      {/* The mood of the bar playing, across the top of the page. */}
      <div aria-hidden className="fixed inset-x-0 top-0 h-1.5 transition-colors duration-300"
        style={{ background: mood ? MOOD_FILL[mood] : "transparent" }} />

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
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {MODES.map((m) => {
            const on = mode?.id === m.id;
            return (
              <button key={m.id} aria-pressed={on} title={m.alias}
                onClick={() => setShown(on ? [] : m.intervals.slice(1))}
                className={`flex flex-col items-center gap-1 border-b-2 pb-1 text-sm transition-colors ${
                  on ? "border-amber-500 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                {m.name}
                {/* The mood of each of its seven chords, I to vii. */}
                <span aria-hidden className="flex gap-0.5">
                  {MODE_MOODS[m.id].map((md, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: MOOD_FILL[md] }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {note && name && (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {INTERVALS.map(({ semis }) => {
                const iv = spelled(semis, shown);
                const on = shown.includes(semis);
                return (
                  <button key={semis} onClick={() => toggle(semis)} aria-pressed={on}
                    className={`flex w-11 flex-col items-center rounded-xl border py-1.5 leading-tight transition-colors ${
                      on ? "border-neutral-800 bg-neutral-800 text-neutral-50"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    }`}>
                    <span className="text-base font-bold">{iv.label}</span>
                    <span className={`text-xs ${on ? "text-neutral-300" : "text-neutral-400"}`}>
                      {spellInterval(name, iv.semis, iv.steps)}
                    </span>
                  </button>
                );
              })}
            </div>

            {chords && (
              <div className="space-y-5 pt-3">
                {/* The chords this scale builds, coloured by the mood each
                    carries. Tap to hear it, see it, and drop it in the strip. */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {chords.map((c) => (
                    <button key={c.degree} onClick={() => playChord(c)}
                      aria-label={`${c.numeral} ${c.name}`}
                      style={{ background: MOOD_FILL[c.mood] }}
                      className={`flex flex-col items-center rounded-xl py-2 leading-tight text-neutral-950 transition-shadow ${
                        chord?.degree === c.degree ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50" : ""
                      }`}>
                      <span className="text-base font-bold sm:text-lg">{c.numeral}</span>
                      <span className="text-xs text-neutral-800">{c.name}</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-5 text-xs text-neutral-500">
                  {(Object.keys(MOOD_FILL) as Mood[]).map((m) => (
                    <span key={m} className="flex items-center gap-1.5">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: MOOD_FILL[m] }} />
                      {m}
                    </span>
                  ))}
                </div>

                {/* Why the chord in focus feels the way it does. Space held so
                    the strip doesn't jump as it changes. */}
                <p className="h-5 text-center text-sm text-neutral-600">
                  {chord && (
                    <>
                      <span className="font-bold text-neutral-900">{chord.numeral}</span> {chord.why}
                    </>
                  )}
                </p>

                {mode && vamp.length > 1 && (
                  <div className="flex justify-center">
                    <button onClick={loadVamp}
                      className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:border-neutral-400">
                      {mode.name} vamp · {vamp.map((d) => chords[d].numeral).join("–")}
                    </button>
                  </div>
                )}

                {/* The progression: one chord a bar, looped under the click. */}
                <div className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    {strip.map((d, i) => {
                      const c = d === null ? null : chords[d];
                      const aimed = target === i;
                      const playing = playingSlot === i;
                      return (
                        <button key={i} onClick={() => tapSlot(i)}
                          aria-label={c ? `bar ${i + 1}: ${c.numeral}` : `bar ${i + 1}: empty`}
                          style={c ? { background: MOOD_FILL[c.mood] } : undefined}
                          className={`flex h-16 flex-col items-center justify-center rounded-xl leading-tight transition ${
                            c ? "text-neutral-950" : `border-2 border-dashed ${aimed ? "border-neutral-500 text-neutral-500" : "border-neutral-200 text-neutral-300"}`
                          } ${playing ? "scale-105 ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50"
                            : c && aimed ? "ring-2 ring-neutral-400 ring-offset-2 ring-offset-neutral-50" : ""}`}>
                          {c ? (
                            <>
                              <span className="text-lg font-bold">{c.numeral}</span>
                              <span className="text-xs text-neutral-800">{c.name}</span>
                            </>
                          ) : (
                            <span aria-hidden className="text-xl">{aimed ? "+" : ""}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={clearStrip} aria-label="clear progression"
                    className="h-11 w-11 shrink-0 rounded-full text-neutral-400 hover:text-neutral-700">✕</button>
                </div>
              </div>
            )}

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

/**
 * The key's root and every interval switched on. With no chord in play the
 * notes are plain and the root is dark. With one, its tones take the chord's
 * mood colour, its root wears a ring, and the rest of the scale steps back.
 */
function neckDots(key: NoteName, keyName: string, shown: number[], chord: DiatonicChord | null): FbNote[] {
  const on = shown.map((s) => spelled(s, shown));
  const semis = [0, ...on.map((iv) => iv.semis)];
  const labels = [keyName, ...on.map((iv) => iv.label)];
  return fretNotesFor(key, semis, labels, MAX_FRET).map((n) => {
    const iv = (n.pc - noteIndex(key) + 12) % 12;
    const base = { string: n.string, fret: n.fret, label: n.degree };
    if (!chord) return { ...base, fill: iv === 0 ? INK : PLAIN };
    const inChord = chord.tones.includes(iv);
    return {
      ...base,
      fill: inChord ? MOOD_FILL[chord.mood] : PLAIN,
      ring: iv === chord.semis ? INK : undefined,
      dim: !inChord,
    };
  });
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
