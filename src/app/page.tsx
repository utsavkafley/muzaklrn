"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import BeatLine from "@/components/BeatLine";
import Fretboard, { FbNote, FretGeo } from "@/components/Fretboard";
import ChordHover from "@/components/ChordHover";
import ProgressionStrip from "@/components/ProgressionStrip";
import RiffLayer from "@/components/RiffLayer";
import { Metronome, Voice, audioCtx, click, pluck, sticks } from "@/lib/audio";
import { MODES } from "@/lib/modes";
import { NoteName, fretNotesFor, noteIndex, parseNote, pitchAt, spellInterval, spellNote } from "@/lib/theory";
import {
  ChordKind, ChordRef, DiatonicChord, INTERVALS, KINDS, MOOD_FILL, MOOD_TINT, Mood,
  buildOrTriad, diatonicChords, noteMood, scaleOf, spelled, variantsOf, voicing,
} from "@/lib/harmony";
import { Bar, presetsFor } from "@/lib/progressions";
import { fretTip } from "@/lib/fretTips";
import {
  SavedProgression, deleteProgression, saveProgression, savedServerSnapshot, savedSnapshot, subscribeSaved,
} from "@/lib/saved";
import { DropSpot, useChordDrag } from "@/lib/useChordDrag";
import { RiffNote, barsOf } from "@/lib/riffs";
import { barOf, usePhrasePlayer } from "@/lib/usePhrasePlayer";
import KeyCircle from "@/components/KeyCircle";
import Practice from "@/components/practice/Practice";
import { STEPS } from "@/components/practice/steps";
import { Phrase, PracticeCtx } from "@/components/practice/types";
import { roleLabel } from "@/lib/lines";
import { homeFret } from "@/lib/shapes";

const MAX_FRET = 15;
const COUNT_OFF = 4;
const BARS = 4; // a fresh strip; one row of the strip is one four-bar phrase
const MAX_BARS = 16;
const clampBpm = (n: number) => Math.max(30, Math.min(240, Math.round(n)));
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
const emptyStrip = (): Bar[] => Array.from({ length: BARS }, () => []);

/** Each mode's seven chord moods, in order: the mode's shape at a glance. */
const MODE_MOODS = Object.fromEntries(
  MODES.map((m) => [m.id, diatonicChords("C", m.intervals.slice(1))!.map((c) => c!.mood)]),
);

const INK = "#18181b";

/** Strum a chord low to high, returning every voice so a stop can cut it. */
function strum(midis: number[], when: number, vol = 0.24): Voice[] {
  return midis.map((m, i) => pluck(m, when + i * 0.014, 1.6, vol * (1 - i * 0.06)));
}

export default function Page() {
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
  const scale = useMemo(() => scaleOf(shown), [shown]);

  /** Which kind of chord the chord row offers: triads, sevenths, sus. */
  const [kind, setKind] = useState<ChordKind>("triad");
  const chords = useMemo(() => (name ? diatonicChords(name, shown, kind) : null), [name, shown, kind]);
  const chordOf = (ref: ChordRef) => buildOrTriad(name!, scale!, ref);

  // ---- practice: chord tones, shapes, phrases, in one hand position ----
  const [step, setStep] = useState(STEPS[0].id);
  /** Each step's own options, kept when you switch steps. */
  const [sels, setSels] = useState<Record<string, unknown>>({});
  /** Trade bars with the app: it plays one, you answer the next. */
  const [yourTurn, setYourTurn] = useState(false);
  /** The hand position, in frets from the key's home position. */
  const [shift, setShift] = useState(0);
  const [circleOpen, setCircleOpen] = useState(false);

  // ---- progression ----
  // Bars hold degrees and kinds, not chords, so a progression follows the key
  // and the mode: I–IV–V–I in Dorian is a different, real thing.
  const [bars, setBars] = useState<Bar[]>(emptyStrip);
  /** The bar the next tapped chord lands in; null once every bar is full. */
  const [target, setTarget] = useState<number | null>(0);
  /** The chord last tapped or dropped, shown on the neck while nothing plays. */
  const [held, setHeld] = useState<ChordRef | null>(null);

  const audition = (ref: ChordRef) => {
    if (!note || !scale) return;
    strum(voicing(note, chordOf(ref)), audioCtx().currentTime);
    setHeld(ref);
  };

  const tapChord = (ref: ChordRef) => {
    audition(ref);
    if (target === null) return;
    const next = bars.map((b, i) => (i === target ? [ref] : b));
    setBars(next);
    // On to the next empty bar, wrapping; none left and the strip is done.
    setTarget(nextEmpty(next, target));
  };

  // Dragging: the left half of a bar swaps the whole bar for the chord, the
  // right half makes it the bar's second chord, splitting it.
  const dropChord = (ref: ChordRef, spot: DropSpot) => {
    audition(ref);
    if (spot.bar === "new") {
      if (bars.length < MAX_BARS) setBars([...bars, [ref]]);
      return;
    }
    const i = spot.bar;
    const cur = bars[i];
    const bar = !cur.length || spot.side === "left" ? [ref] : [cur[0], ref];
    const next = bars.map((b, k) => (k === i ? bar : b));
    setBars(next);
    if (target === i) setTarget(nextEmpty(next, i));
  };
  const { drag, bind, wasDrag } = useChordDrag(dropChord);

  const tapBar = (i: number) => {
    if (target !== i) return setTarget(i);
    // A second tap on the bar you are aiming at empties it; a tap on an
    // aimed empty bar removes the bar, as long as one is left.
    if (bars[i].length) {
      setBars(bars.map((b, k) => (k === i ? [] : b)));
    } else if (bars.length > 1) {
      const next = bars.filter((_, k) => k !== i);
      setBars(next);
      setTarget(nextEmpty(next, i - 1));
    }
  };

  const addBar = () => {
    if (bars.length >= MAX_BARS) return;
    setBars([...bars, []]);
    setTarget(bars.length);
  };

  const presets = mode ? presetsFor(mode.id) : [];
  const loadPreset = (p: Bar[]) => {
    setBars(p);
    setTarget(null);
  };

  const clearStrip = () => {
    setBars(emptyStrip());
    setTarget(0);
    setHeld(null);
  };

  /** Holding a bar changes its chord, in the key or out of it. */
  const alterChord = (bar: number, half: number, ref: ChordRef) => {
    audition(ref);
    setBars(bars.map((b, k) => (k === bar ? b.map((r, h) => (h === half ? ref : r)) : b)));
  };

  // ---- saved progressions ----
  const saved = useSyncExternalStore(subscribeSaved, savedSnapshot, savedServerSnapshot);
  const canSave = !!(name && scale && bars.some((b) => b.length));
  const save = () => {
    if (!name || !scale) return;
    const numerals = bars.filter((b) => b.length).map((b) => b.map((r) => chordOf(r).numeral).join("·")).join(" – ");
    saveProgression({
      name: `${name} ${mode?.name ?? "custom"} · ${numerals}`,
      key: text, shown, bars, bpm,
    });
  };

  // ---- metronome ----
  const [bpmText, setBpmText] = useState("90");
  const parsedBpm = parseInt(bpmText, 10);
  const bpm = Number.isFinite(parsedBpm) ? clampBpm(parsedBpm) : 90;
  const [running, setRunning] = useState(false);
  /** The beat sounding now (0-3), whether it is still the count-in, and which
   *  bar and half of it is playing (bar -1 for none). */
  const [beat, setBeat] = useState<{ sub: number; countIn: boolean; bar: number; half: number } | null>(null);

  const met = useRef<Metronome | null>(null);
  const voices = useRef<Voice[]>([]);
  /** Phrases on the clock: bars for the beat line, notes for the neck. */
  const player = usePhrasePlayer(voices);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * Pause and play: the progression picks up at the bar it was on. `resumeAt`
   * is where the next start begins; `atBar` tracks where it is now.
   */
  const resumeAt = useRef(0);
  const atBar = useRef(0);
  /** What the clock plays, kept current for a tick callback that outlives renders. */
  const prog = useRef<{ bar: number; halves: number[][]; chord: DiatonicChord }[]>([]);
  /** The phrase and how it is being learned, for the same tick callback. */
  const phraseCfg = useRef<{ phrase: Phrase | null; yourTurn: boolean }>({ phrase: null, yourTurn: false });

  useEffect(() => {
    prog.current = note && name && scale
      ? bars.flatMap((b, bar) => (b.length
        ? [{
          bar,
          halves: b.map((ref) => voicing(note, buildOrTriad(name, scale, ref))),
          chord: buildOrTriad(name, scale, b[0]),
        }]
        : []))
      : [];
    // A different progression starts from its top.
    resumeAt.current = 0;
  }, [note, name, scale, bars]);

  const silence = () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    timers.current.forEach(clearTimeout);
    timers.current = [];
    player.reset();
  };

  const stop = () => {
    resumeAt.current = atBar.current;
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
    // on the next downbeat, with the progression strummed under it: a whole
    // bar's chord on beat 1, or a split bar's two chords on beats 1 and 3.
    m.onTick = (t) => {
      const countIn = t.count < COUNT_OFF;
      voices.current.push(countIn ? sticks(t.when) : click(t.when, t.sub === 0));
      let bar = -1, half = 0;
      const p = prog.current;
      const { phrase: ph, yourTurn: turns } = phraseCfg.current;
      const barNum = Math.floor((t.count - COUNT_OFF) / 4);
      const idx = p.length ? (barNum + resumeAt.current) % p.length : 0;
      const b = !countIn && p.length ? p[idx] : null;
      if (b && t.sub === 0) atBar.current = idx;
      if (b) {
        bar = b.bar;
        half = b.halves.length === 2 && t.sub >= 2 ? 1 : 0;
        if (t.sub === 0 || (t.sub === 2 && b.halves.length === 2)) {
          // Chords sit back when a phrase is out front.
          voices.current.push(...strum(b.halves[half], t.when, ph ? 0.12 : 0.24));
        }
      }
      if (t.sub === 0) {
        // A phrase may run several bars; "your turn" trades its whole
        // length, the phrase and then your answer.
        let plays = false, yours = false, part = 0;
        let notes: RiffNote[] = [];
        if (!countIn && ph) {
          const all = ph.notesFor(b ? b.chord : null, idx);
          const len = barsOf(all);
          part = barNum % len;
          const cycle = turns ? barNum % (2 * len) : 0;
          plays = cycle < len;
          yours = cycle >= len;
          notes = barOf(all, part);
        }
        player.bar({ start: t.when, secPerEighth: 60 / m.bpm / 2, countIn, yours, part }, plays ? notes : null);
      }
      if (voices.current.length > 96) voices.current = voices.current.slice(-96);
      // Ticks are scheduled ahead; move the display when the sound lands.
      const beatNow = { sub: t.sub, countIn, bar, half };
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

  // Space plays and pauses, from anywhere on the page. The two boxes never
  // need a space (a note name, a tempo), so they don't swallow it either.
  const playPause = useRef<() => void>(() => {});
  useEffect(() => {
    playPause.current = running ? stop : start;
  });
  useEffect(() => {
    const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";
    const typing = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      return !!t && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    };
    const down = (e: KeyboardEvent) => {
      if (!isSpace(e) || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      // Also stops a focused button from treating the space as a click.
      e.preventDefault();
      if (!e.repeat) playPause.current();
    };
    const up = (e: KeyboardEvent) => {
      if (isSpace(e) && !typing(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Leaving the page takes the click, and everything it scheduled, with it.
  useEffect(() => () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    timers.current.forEach(clearTimeout);
  }, []);

  // ---- the neck ----
  // Playing, the neck follows the bar; otherwise it shows the chord last tapped.
  const playing = beat && beat.bar >= 0 && bars[beat.bar]?.length ? { bar: beat.bar, half: beat.half } : null;
  // Still, it's the chord last tapped — or, with a progression and nothing
  // tapped, its first chord, which is where playing will start.
  const firstRef = bars.find((b) => b.length)?.[0] ?? null;
  const shownRef = running ? (playing ? bars[playing.bar][playing.half] ?? bars[playing.bar][0] : null) : held ?? firstRef;
  const chord = name && scale && shownRef ? chordOf(shownRef) : null;
  const mood: Mood | null = running && chord ? chord.mood : null;

  // The home chord's notes decide every note's mood; with no seven-note scale
  // there is no home chord, and only the tonic itself is home.
  const homeTones = scale ? [scale[0], scale[2], scale[4]] : [0];
  /** A fingering's dot colour: black for the tonic, the note's mood otherwise. */
  const gripFill = (string: number, fret: number) => {
    const iv = note ? (pitchAt(string, fret) - noteIndex(note) + 12) % 12 : -1;
    return iv === 0 ? INK : MOOD_FILL[noteMood(iv, homeTones)];
  };
  /** The note under the pointer (or last tapped), for its theory tip. */
  const [hover, setHover] = useState<{ string: number; fret: number } | null>(null);
  const hoverPc = hover ? pitchAt(hover.string, hover.fret) : null;
  const tip = hover && note && name
    ? fretTip(hover.string, hover.fret, { keyPc: noteIndex(note), keyName: name, shown, homeTones, chord, maxFret: MAX_FRET })
    : null;

  /** Phrase dots take the neck's colours: black tonic, mood for the rest. */
  const phraseFill = gripFill;
  /** A phrase note the key doesn't hold (a blue note) gets its interval as a label. */
  const outsideLabel = (string: number, fret: number) => {
    if (!note) return null;
    const iv = (pitchAt(string, fret) - noteIndex(note) + 12) % 12;
    if (iv === 0 || shown.includes(iv)) return null;
    return INTERVALS.find((x) => x.semis === iv)!.label.replace("♭5", "♯4");
  };

  /** Play a phrase once, now, without the metronome — unless it is already running. */
  const preview = (p: Phrase | null) => {
    if (!running && p) player.preview(p, bpm);
  };

  // The hand position: five frets, starting a fret below the key's root on
  // the low E string unless moved.
  const lo = note ? Math.max(0, Math.min(11, homeFret(noteIndex(note)) - 1 + shift)) : 0;

  // What the practice steps see of the page.
  const practiceCtx: PracticeCtx | null = note && name && scale && chords
    ? {
      note, name, keyPc: noteIndex(note), scale, shown, mode, kind, chordOf, focus: chord,
      progression: bars.filter((b) => b.length).map((b) => b.map(chordOf)),
      lo, fillFor: gripFill, preview,
    }
    : null;
  const practiceStep = STEPS.find((x) => x.id === step) ?? STEPS[0];
  const phrase = practiceCtx ? practiceStep.phrase(practiceCtx, sels[step] ?? practiceStep.initial) : null;
  // The bar of the progression on show: the one playing, else the first.
  const showIdx = running && playing ? bars.slice(0, playing.bar).filter((b) => b.length).length : 0;
  const phraseNotes = phrase ? phrase.notesFor(chord, showIdx) : [];
  const targets = phrase?.targetAfter?.(showIdx) ?? [];
  const phraseBars = barsOf(phraseNotes);
  const hitsByPart = Array.from({ length: phraseBars }, (_, k) =>
    phraseNotes.filter((x) => x.at >= k * 8 && x.at < k * 8 + 8).map((x) => x.at - k * 8));
  const dots: FbNote[] = note && name ? neckDots(note, name, shown, homeTones, chord, hoverPc, !!phrase?.roles) : [];

  useEffect(() => {
    phraseCfg.current = { phrase, yourTurn };
  }, [phrase, yourTurn]);

  const overlay = practiceCtx
    ? (geo: FretGeo) => (
      <>
        <PositionShade geo={geo} lo={lo} />
        {phrase && (
          <RiffLayer geo={geo} notes={phraseNotes} lands={phrase.lands} events={player.events}
            live={running || player.previewing} colorOf={phraseFill} outside={outsideLabel}
            numbered={phrase.numbered !== false} targets={targets} />
        )}
      </>
    )
    : undefined;

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

        {/* The beat line sits under the note: beats, or a phrase's eighths.
            Space is always held for it so the neck doesn't jump. */}
        <BeatLine clock={player.clock} live={running || player.previewing} steps={phrase ? 8 : 4} hits={phrase ? hitsByPart : []} />
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
          {/* Reference, not practice: where this key sits among the others. */}
          {note && name && scale && (
            <button onClick={() => setCircleOpen(!circleOpen)} aria-expanded={circleOpen}
              className={`self-start rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                circleOpen ? "border-neutral-800 bg-neutral-800 text-neutral-50" : "border-neutral-300 text-neutral-500 hover:text-neutral-800"
              }`}>
              circle of fifths
            </button>
          )}
        </div>
        {circleOpen && note && name && scale && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <KeyCircle ctx={{
              keyPc: noteIndex(note), name, scale, mode, chordOf,
              setKey: (t) => setText(t), setShown,
            }} />
          </div>
        )}

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

            {chords && scale && (
              <div className="space-y-5 pt-3">
                {/* Which kind of chord the row offers. */}
                <div className="flex justify-center gap-1">
                  {KINDS.map((k) => (
                    <button key={k.kind} onClick={() => setKind(k.kind)} aria-pressed={kind === k.kind}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        kind === k.kind ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
                      }`}>
                      {k.label}
                    </button>
                  ))}
                </div>

                {/* The chords this scale builds, coloured by the mood each
                    carries. Tap to hear it, see it, and drop it in the next
                    bar; drag it onto a bar to swap or split it. */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {chords.map((c, i) => {
                    if (!c) {
                      // This kind doesn't fit on this degree in this mode.
                      return (
                        <div key={i} aria-hidden
                          className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 py-2 text-neutral-300">
                          –
                        </div>
                      );
                    }
                    const ref: ChordRef = { degree: c.degree, kind: c.kind };
                    return (
                      <ChordHover key={i} chord={c} keyNote={note} fillFor={gripFill}
                        align={i === 0 ? "left" : i === 6 ? "right" : "center"}>
                        <button {...bind(ref)}
                          onClick={() => { if (!wasDrag()) tapChord(ref); }}
                          aria-label={`${c.numeral} ${c.name}`}
                          style={{ background: MOOD_FILL[c.mood], touchAction: "none" }}
                          className={`flex w-full cursor-grab touch-none select-none flex-col items-center rounded-xl py-2 leading-tight text-neutral-950 transition-shadow active:cursor-grabbing ${
                            chord && chord.degree === c.degree && chord.kind === c.kind && !chord.alt
                              ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50" : ""
                          }`}>
                          <span className="text-sm font-bold sm:text-lg">{c.numeral}</span>
                          <span className="text-xs text-neutral-800">{c.name}</span>
                        </button>
                      </ChordHover>
                    );
                  })}
                </div>

                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-neutral-500">
                  {(Object.keys(MOOD_FILL) as Mood[]).map((m) => (
                    <span key={m} className="flex items-center gap-1.5">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: MOOD_FILL[m] }} />
                      {m}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-900" />
                    tonic
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-neutral-400" />
                    in key
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-2 rotate-45 border border-neutral-500" />
                    in chord
                  </span>
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

                {/* Progressions to start from in this mode, its vamp first. */}
                {presets.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {presets.map((p, i) => (
                      <button key={i} onClick={() => loadPreset(p)}
                        className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:border-neutral-400">
                        {p.map((b) => b.map((ref) => chordOf(ref).numeral).join("·")).join(" – ")}
                      </button>
                    ))}
                  </div>
                )}

                <ProgressionStrip
                  bars={bars}
                  chordOf={(bar, h) => chordOf(bar[h])}
                  target={target}
                  playing={playing}
                  over={drag?.over ?? null}
                  canAdd={bars.length < MAX_BARS}
                  keyNote={note}
                  fillFor={gripFill}
                  variantsFor={(bar, half) => variantsOf(name, scale, bars[bar][half]?.degree ?? 0)}
                  onAlter={alterChord}
                  onTapBar={tapBar}
                  onAddBar={addBar}
                  onClear={clearStrip}
                />

                {/* Save the progression to come back to; saved ones load
                    with their key, mode and tempo. */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <button onClick={save} disabled={!canSave}
                    className="rounded-full bg-neutral-800 px-3 py-1 text-neutral-50 hover:bg-neutral-700 disabled:opacity-30">
                    Save progression
                  </button>
                  {saved.map((sp) => <SavedPill key={sp.id} sp={sp} onLoad={() => {
                    setText(sp.key);
                    setShown(sp.shown);
                    setBars(sp.bars);
                    setTarget(null);
                    setBpmText(String(sp.bpm));
                  }} />)}
                </div>
                <p className="-mt-2 text-center text-xs text-neutral-400">
                  Hover a chord for fingerings · hold a bar to change its chord · space plays and pauses
                </p>

              </div>
            )}

            {practiceCtx && (
              <Practice
                ctx={practiceCtx}
                onMove={(by) => {
                  // Kept so the window never runs off either end of the neck.
                  const home = homeFret(noteIndex(note)) - 1;
                  setShift((x) => Math.max(-home, Math.min(11 - home, x + by)));
                }}
                canMove={{ down: lo > 0, up: lo < 11 }}
                step={step}
                setStep={setStep}
                sels={sels}
                setSel={(id, sel) => setSels({ ...sels, [id]: sel })}
                yourTurn={yourTurn}
                setYourTurn={setYourTurn}
                canClimb={running}
                onClimb={() => setBpmText(String(clampBpm(bpm + 5)))}
              />
            )}

            {/* The neck breaks out of the page's column for room to breathe.
                A phone gets it stood up so the dots stay finger-sized;
                anything wider gets it lying down, scaled to fit. */}
            <div className="relative left-1/2 w-[min(calc(100vw-2rem),76rem)] -translate-x-1/2 space-y-3">
              <div className="sm:hidden">
                <Fretboard notes={dots} maxFret={MAX_FRET} vertical overlay={overlay}
                  onNoteHover={(n) => n && setHover(n)} onNoteClick={(n) => setHover(n)} />
              </div>
              <div className="hidden sm:block">
                <Fretboard notes={dots} maxFret={MAX_FRET} fit overlay={overlay}
                  onNoteHover={(n) => setHover(n)} onNoteClick={(n) => setHover(n)} />
              </div>
              <NoteTip tip={tip} />
            </div>
          </>
        )}
      </div>

      {/* The chord being dragged follows the pointer. */}
      {drag && name && scale && (
        <div aria-hidden className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center leading-tight text-neutral-950 shadow-lg"
          style={{ left: drag.x, top: drag.y, background: MOOD_FILL[chordOf(drag.ref).mood] }}>
          <div className="text-base font-bold">{chordOf(drag.ref).numeral}</div>
          <div className="text-xs text-neutral-800">{chordOf(drag.ref).name}</div>
        </div>
      )}
    </div>
  );
}

/** The first empty bar after `from`, wrapping round; null when every bar is full. */
function nextEmpty(bars: Bar[], from: number): number | null {
  for (let k = 1; k <= bars.length; k++) {
    const i = (((from + k) % bars.length) + bars.length) % bars.length;
    if (!bars[i].length) return i;
  }
  return null;
}

/**
 * The key's root and every interval switched on, each coloured by its own
 * mood. With a chord in play the key stays on the neck, paled, and the
 * chord's notes stand out over it as diamonds, its root ringed.
 *
 * The tonic is the one fixed point: always a black circle, whatever plays.
 * When it belongs to the chord it gains a ring in home's colour instead of
 * turning into a diamond.
 */
function neckDots(
  key: NoteName, keyName: string, shown: number[], homeTones: number[], chord: DiatonicChord | null,
  hoverPc: number | null, roles: boolean,
): FbNote[] {
  const on = shown.map((s) => spelled(s, shown));
  const semis = [0, ...on.map((iv) => iv.semis)];
  const labels = [keyName, ...on.map((iv) => iv.label)];
  return fretNotesFor(key, semis, labels, MAX_FRET).map((n) => {
    const iv = (n.pc - noteIndex(key) + 12) % 12;
    const mood = noteMood(iv, homeTones);
    // Every copy of the note being looked at is ringed: that's the map.
    const base = { string: n.string, fret: n.fret, label: n.degree, halo: n.pc === hoverPc };
    // Practising over chords, a chord's notes are named by their job in it.
    const role = roles && chord && chord.tones.includes(iv) ? roleLabel(iv - chord.semis) : null;
    if (iv === 0) {
      return { ...base, label: role ?? base.label, fill: INK, ring: chord?.tones.includes(0) ? MOOD_FILL.home : undefined };
    }
    if (!chord) return { ...base, fill: MOOD_FILL[mood] };
    // Named by role, a chord's notes would be muddled by degree numbers on
    // the rest of the key: those stay pale and quiet.
    if (!chord.tones.includes(iv)) return { ...base, label: roles ? "" : base.label, fill: MOOD_TINT[mood] };
    return { ...base, label: role ?? base.label, fill: MOOD_FILL[mood], shape: "diamond" as const, ring: iv === chord.semis ? INK : undefined };
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

/** One saved progression: tap to load it, ✕ to forget it. */
function SavedPill({ sp, onLoad }: { sp: SavedProgression; onLoad: () => void }) {
  return (
    <span className="flex items-center rounded-full border border-neutral-200 bg-white">
      <button onClick={onLoad} className="max-w-64 truncate py-1 pr-1 pl-3 text-neutral-700 hover:text-neutral-950" title={sp.name}>
        {sp.name}
      </button>
      <button onClick={() => deleteProgression(sp.id)} aria-label={`forget ${sp.name}`}
        className="h-7 w-7 rounded-full text-neutral-400 hover:text-neutral-700">✕</button>
    </span>
  );
}

/**
 * The story of the note under the pointer: what it is in the key, how it
 * feels, its job in the chord, and where else it lives on the neck. Space is
 * kept for it so the page doesn't jump as the pointer moves.
 */
function NoteTip({ tip }: { tip: ReturnType<typeof fretTip> | null }) {
  return (
    // On a phone the neck is tall: a tip pins to the bottom of the screen so
    // the note tapped and its story are in view together.
    <div className={`min-h-28 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm ${
      tip ? "max-sm:sticky max-sm:bottom-3 max-sm:z-20 max-sm:shadow-lg" : ""}`}>
      {tip ? (
        <>
          <p className="flex items-center gap-2 font-bold text-neutral-900">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full"
              style={{ background: tip.mood === "outside" ? "#a8a29e" : MOOD_FILL[tip.mood] }} />
            {tip.title}
          </p>
          <ul className="mt-1 space-y-0.5 text-neutral-600">
            {tip.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </>
      ) : (
        <p className="text-neutral-400">Hover over (or tap) any note on the neck to learn what it is and where else it lives.</p>
      )}
    </div>
  );
}

/**
 * The hand position on the neck: everything outside its five frets is
 * washed out, so the eye stays where the hand is.
 */
function PositionShade({ geo, lo }: { geo: FretGeo; lo: number }) {
  const start = lo <= 0 ? geo.fretLine(0) - geo.fretL * 0.7 : geo.fretLine(lo - 1);
  const end = geo.fretLine(Math.min(lo + 4, geo.maxFret));
  const v0 = Math.min(geo.across(-0.7), geo.across(5.7));
  const v1 = Math.max(geo.across(-0.7), geo.across(5.7));
  const rect = (u0: number, u1: number) => {
    const a = geo.at(u0, v0), b = geo.at(u1, v1);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
  };
  const neckStart = geo.fretLine(0) - geo.fretL;
  const neckEnd = geo.fretLine(geo.maxFret) + geo.fretL;
  return (
    <g pointerEvents="none">
      {start > neckStart && <rect {...rect(neckStart, start)} fill="#fff" opacity={0.6} />}
      {end < neckEnd && <rect {...rect(end, neckEnd)} fill="#fff" opacity={0.6} />}
    </g>
  );
}
