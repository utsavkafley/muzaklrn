"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import BeatLine from "@/components/BeatLine";
import Fretboard, { FbNote, FretGeo } from "@/components/Fretboard";
import ChordHover from "@/components/ChordHover";
import ProgressionStrip from "@/components/ProgressionStrip";
import RiffLayer from "@/components/RiffLayer";
import { HandBoard, HandFrame } from "@/components/HandWindow";
import { Metronome, Voice, audioCtx, click, pluck, sticks } from "@/lib/audio";
import { MODES } from "@/lib/modes";
import { NoteName, fretNotesFor, midiAt, noteIndex, parseNote, pitchAt, spellInterval, spellNote } from "@/lib/theory";
import {
  ChordKind, ChordRef, DiatonicChord, INTERVALS, KINDS, MOOD_FILL, MOOD_TINT, Mood,
  buildOrTriad, diatonicChords, noteMood, scaleOf, spelled, variantsOf, voicing,
} from "@/lib/harmony";
import { Bar, placeBars, presetsFor } from "@/lib/progressions";
import { fretTip } from "@/lib/fretTips";
import {
  SavedProgression, deleteProgression, saveProgression, savedServerSnapshot, savedSnapshot, subscribeSaved,
} from "@/lib/saved";
import { DropSpot, useChordDrag } from "@/lib/useChordDrag";
import { RiffNote, barsOf } from "@/lib/riffs";
import { barOf, usePhrasePlayer } from "@/lib/usePhrasePlayer";
import Practice from "@/components/practice/Practice";
import { STEPS } from "@/components/practice/steps";
import { Phrase, PracticeCtx, Spotlight } from "@/components/practice/types";
import { homeFret } from "@/lib/shapes";
import { SPAN, windowFrets } from "@/lib/lines";
import { formulaOf } from "@/lib/compass";

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
/** A note's name counted from a chord it isn't in: a passing note, so a ♭6 rather than a ♯5. */
const AROUND = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

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

  // ---- practice: chord tones, triads, intervals, in one hand position ----
  const [step, setStep] = useState(STEPS[0].id);
  /** Each step's own options, kept when you switch steps. */
  const [sels, setSels] = useState<Record<string, unknown>>({});
  /** Trade bars with the app: it plays one, you answer the next. */
  const [yourTurn, setYourTurn] = useState(false);
  /** The hand position, in frets from the key's home position. */
  const [shift, setShift] = useState(0);
  /** How many frets the hand window spans: one position, or several dragged together. */
  const [span, setSpan] = useState(SPAN);
  /** Notes the practice panel is pointing at on the neck. */
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);

  // ---- progression ----
  // Bars hold degrees and kinds, not chords, so a progression follows the key
  // and the mode: I–IV–V–I in Dorian is a different, real thing.
  const [bars, setBars] = useState<Bar[]>(emptyStrip);
  /** The bar the next tapped chord lands in; null once every bar is full. */
  const [target, setTarget] = useState<number | null>(0);
  /** The chord last tapped or dropped, shown on the neck while nothing plays and no bar holds a chord. */
  const [held, setHeld] = useState<ChordRef | null>(null);
  /** The bar shown on the neck while nothing plays: the one last filled, changed or tapped. */
  const [viewBar, setViewBar] = useState<number | null>(null);

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
    setViewBar(target);
    // On to the next empty bar, wrapping; none left and the strip is done.
    setTarget(nextEmpty(next, target));
  };

  // Dragging: the left half of a bar swaps the whole bar for the chord, the
  // right half makes it the bar's second chord, splitting it.
  const dropChord = (ref: ChordRef, spot: DropSpot) => {
    audition(ref);
    if (spot.bar === "new") {
      if (bars.length < MAX_BARS) {
        setBars([...bars, [ref]]);
        setViewBar(bars.length);
      }
      return;
    }
    const i = spot.bar;
    const cur = bars[i];
    const bar = !cur.length || spot.side === "left" ? [ref] : [cur[0], ref];
    const next = bars.map((b, k) => (k === i ? bar : b));
    setBars(next);
    setViewBar(i);
    if (target === i) setTarget(nextEmpty(next, i));
  };
  const { drag, bind, wasDrag } = useChordDrag(dropChord);

  const tapBar = (i: number) => {
    // Tapping a bar aims at it and puts it on the neck — as often as you
    // like; emptying one is in its hold menu. A tap on an aimed empty bar
    // removes the bar, as long as one is left.
    setViewBar(i);
    if (target !== i) return setTarget(i);
    if (!bars[i].length && bars.length > 1) {
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
    setViewBar(null);
  };

  const clearStrip = () => {
    setBars(emptyStrip());
    setTarget(0);
    setHeld(null);
    setViewBar(null);
  };

  /** Take one chord out of a bar; with none left the bar waits empty, aimed at. */
  const removeChord = (bar: number, half: number) => {
    const next = bars.map((b, k) => (k === bar ? b.filter((_, h) => h !== half) : b));
    setBars(next);
    if (!next[bar].length) setTarget(bar);
  };

  /**
   * Drag bars along the strip: to a gap between bars, onto an empty bar
   * (filling it), or onto "+ bar". Copying leaves the originals where they
   * were — build a verse, then copy it into a chorus.
   */
  const moveBars = (from: number[], spot: DropSpot, copy: boolean): number | null => {
    const placed = placeBars(bars, from, spot.bar === "new" ? "new" : { bar: spot.bar, after: spot.side === "right" }, copy, MAX_BARS);
    if (!placed) return null;
    setBars(placed.bars);
    setViewBar(placed.start);
    setTarget(nextEmpty(placed.bars, placed.bars.length - 1));
    return placed.start;
  };

  /** Take whole bars out, leaving one empty bar at least. */
  const deleteBars = (which: number[]) => {
    const next = bars.filter((_, i) => !which.includes(i));
    const left = next.length ? next : [[]];
    setBars(left);
    setViewBar(null);
    setTarget(nextEmpty(left, left.length - 1));
  };

  /** Holding a bar changes its chord, in the key or out of it. */
  const alterChord = (bar: number, half: number, ref: ChordRef) => {
    audition(ref);
    setBars(bars.map((b, k) => (k === bar ? b.map((r, h) => (h === half ? ref : r)) : b)));
    setViewBar(bar);
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
  // With a progression, the neck always shows one of its bars — the one
  // playing, else the one last touched, else the first — so the chord named
  // under it and the notes on it are always the same chord.
  const firstBar = bars.findIndex((b) => b.length);
  const stillBar = viewBar !== null && bars[viewBar]?.length ? viewBar : firstBar;
  const shownBar = running ? (playing ? playing.bar : -1) : stillBar;
  const shownRef = shownBar >= 0
    ? bars[shownBar][running && playing ? playing.half : 0] ?? bars[shownBar][0]
    : running ? null : held;
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
  /** Where the pointer is over the neck, for the note's card to follow. */
  const [pointer, setPointer] = useState<{ x: number; y: number; touch: boolean } | null>(null);
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
  const lo = note ? Math.max(0, Math.min(MAX_FRET + 1 - span, homeFret(noteIndex(note)) - 1 + shift)) : 0;

  // What the practice steps see of the page.
  // The bar on show, counted among the bars that hold chords.
  const showIdx = shownBar >= 0 ? bars.slice(0, shownBar).filter((b) => b.length).length : 0;
  const practiceCtx: PracticeCtx | null = note && name && scale && chords
    ? {
      note, name, keyPc: noteIndex(note), scale, shown, mode, kind, chordOf, focus: chord,
      progression: bars.filter((b) => b.length).map((b) => b.map(chordOf)),
      bar: showIdx, lo, span, fillFor: gripFill, preview, spot: setSpotlight, hovered: hover,
    }
    : null;
  const practiceStep = STEPS.find((x) => x.id === step) ?? STEPS[0];
  const phrase = practiceCtx ? practiceStep.phrase(practiceCtx, sels[step] ?? practiceStep.initial) : null;
  const phraseNotes = phrase ? phrase.notesFor(chord, showIdx) : [];
  const targets = phrase?.targetAfter?.(showIdx) ?? [];
  const phraseBars = barsOf(phraseNotes);
  const hitsByPart = Array.from({ length: phraseBars }, (_, k) =>
    phraseNotes.filter((x) => x.at >= k * 8 && x.at < k * 8 + 8).map((x) => x.at - k * 8));
  // A bare phrase (the drill) hides the key's own dots: they'd give the answer away.
  const box = practiceCtx ? { lo, span } : null;
  const dots: FbNote[] = note && name && !phrase?.bare
    ? neckDots(note, name, shown, homeTones, chord, hoverPc, !!phrase, box, chord && scale ? formulaOf(chord, scale, "chord") : null)
    : [];
  // The chord after the bar on show, and where its notes sit in the window:
  // drawn dashed, so you can see what stays, what moves, and where to go.
  const chordBars = practiceCtx?.progression ?? [];
  const nextUp = phrase && !phrase.bare && chordBars.length > 1 && shownBar >= 0
    ? chordBars[(showIdx + 1) % chordBars.length][0] : null;
  const nextChord = nextUp && note
    ? {
      name: nextUp.name,
      tones: Array.from({ length: 6 }, (_, s) => windowFrets(lo, span).map((f) => ({ string: s, fret: f }))).flat()
        .filter((x) => nextUp.tones.includes((pitchAt(x.string, x.fret) - noteIndex(note) + 12) % 12)),
    }
    : null;

  useEffect(() => {
    phraseCfg.current = { phrase, yourTurn };
  }, [phrase, yourTurn]);

  const overlay = practiceCtx
    ? (geo: FretGeo) => (
      <>
        <HandFrame geo={geo} lo={lo} span={span} />
        {phrase && (
          <RiffLayer geo={geo} notes={phraseNotes} lands={phrase.lands} events={player.events}
            live={running || player.previewing} colorOf={phraseFill} outside={outsideLabel}
            numbered={phrase.numbered !== false} targets={targets} compass={phrase.compassFor?.(showIdx)}
            next={nextChord} spotlight={spotlight} />
        )}
      </>
    )
    : undefined;
  // The hand window, grabbed on the board under the notes.
  const home = note ? homeFret(noteIndex(note)) - 1 : 0;
  // While the step is drilling, a tap on the neck is an answer, sounded.
  const tapStep = practiceCtx && practiceStep.tap && phrase?.bare
    ? (string: number, fret: number) => {
      pluck(midiAt(string, fret));
      const next = practiceStep.tap!(practiceCtx, sels[step] ?? practiceStep.initial, { string, fret });
      if (next !== undefined) setSels({ ...sels, [step]: next });
    }
    : undefined;
  const underlay = practiceCtx
    ? (geo: FretGeo) => (
      <HandBoard geo={geo} lo={lo} span={span} onTap={tapStep}
        onWindow={(n, w) => { setShift(n - home); setSpan(w); }} />
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
          {MODES.map((m, i) => {
            const on = mode?.id === m.id;
            return (
              <div key={m.id} className="group relative">
                <button aria-pressed={on} aria-describedby={`vibe-${m.id}`}
                  onClick={() => setShown(on ? [] : m.intervals.slice(1))}
                  className={`flex flex-col items-center gap-1 border-b-2 pb-1 text-sm transition-colors ${
                    on ? "border-amber-500 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
                  }`}>
                  {m.name}
                  {/* The mood of each of its seven chords, I to vii. */}
                  <span aria-hidden className="flex gap-0.5">
                    {MODE_MOODS[m.id].map((md, k) => (
                      <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: MOOD_FILL[md] }} />
                    ))}
                  </span>
                </button>
                {/* Its feel, on hover: what it sounds like, and where you've heard it. */}
                <div id={`vibe-${m.id}`} role="tooltip"
                  className={`pointer-events-none absolute top-full z-30 hidden pt-2 opacity-0 transition-opacity delay-150 group-hover:opacity-100 [@media(hover:hover)]:block ${
                    i < 2 ? "left-0" : i > 4 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                  <div className="w-72 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm shadow-lg">
                    <p className="font-bold text-neutral-900">
                      {m.name}{m.alias && <span className="font-normal text-neutral-400"> · {m.alias}</span>}
                    </p>
                    <p className="mt-0.5 text-neutral-800">{m.vibe}</p>
                    <p className="mt-1.5 text-xs leading-snug text-neutral-500">{m.tidbit}</p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Its sound: the <b className="rounded bg-neutral-800 px-1 text-neutral-50">{m.character}</b>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* The neck sits straight under the modes, so picking one shows it
            at once. It breaks out of the page's column for room to breathe:
            a phone gets it stood up so the dots stay finger-sized; anything
            wider gets it lying down, scaled to fit. */}
        {note && name && (
          <div className="relative left-1/2 w-[min(calc(100vw-2rem),76rem)] -translate-x-1/2"
            onPointerMove={(e) => setPointer({ x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" })}>
            <div className="sm:hidden">
              <Fretboard notes={dots} maxFret={MAX_FRET} vertical overlay={overlay} underlay={underlay}
                onNoteHover={(n) => n && setHover(n)} onNoteClick={(n) => setHover(n)} />
            </div>
            <div className="hidden sm:block">
              <Fretboard notes={dots} maxFret={MAX_FRET} fit overlay={overlay} underlay={underlay}
                onNoteHover={(n) => setHover(n)} onNoteClick={(n) => setHover(n)} />
            </div>
          </div>
        )}
        {/* Outside the neck's wrapper: its transform would trap a fixed card
            inside it, and under whatever comes after it on the page. */}
        <NoteTip tip={tip} at={pointer} onClose={() => setHover(null)} />

        {/* What the neck is showing you to play, right under it. */}
        {practiceCtx && (
          <Practice
            ctx={practiceCtx}
            step={step}
            setStep={setStep}
            sels={sels}
            setSel={(id, sel) => setSels({ ...sels, [id]: sel })}
            yourTurn={yourTurn}
            setYourTurn={setYourTurn}
          />
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
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
                    in key
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
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
                  onRemove={removeChord}
                  onTapBar={tapBar}
                  onAddBar={addBar}
                  onClear={clearStrip}
                  onMove={moveBars}
                  onDelete={deleteBars}
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
                  Hover a chord for fingerings · hold a bar to change its chord · drag bars to move them, shift-drag to copy,
                  ⌘-click to pick several · space plays and pauses
                </p>

              </div>
            )}
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
 * mood. With a chord in play the chord's notes keep their full colour over
 * the paled key, its root ringed. The tonic is the one fixed point: always a
 * black circle.
 *
 * Inside the hand window the notes are counted from the chord instead of
 * the key — 1 3 5 ♭7, and the 9s and 11s between them — so the arpeggio
 * and the triads read straight off the board. Outside it the key keeps its
 * own numbers. While a practice step is showing its notes, the neck steps
 * back: everything stays named, but faint, so the step's own notes lead.
 */
function neckDots(
  key: NoteName, keyName: string, shown: number[], homeTones: number[], chord: DiatonicChord | null,
  hoverPc: number | null, quiet: boolean, box: { lo: number; span: number } | null,
  formula: { tones: { semis: number; label: string }[] } | null,
): FbNote[] {
  const on = shown.map((s) => spelled(s, shown));
  const semis = [0, ...on.map((iv) => iv.semis)];
  const labels = [keyName, ...on.map((iv) => iv.label)];
  const inBox = (f: number) => !!box && ((f >= box.lo && f < box.lo + box.span) || (f === 0 && box.lo <= 1));
  return fretNotesFor(key, semis, labels, MAX_FRET).map((n) => {
    const iv = (n.pc - noteIndex(key) + 12) % 12;
    const mood = noteMood(iv, homeTones);
    const inside = inBox(n.fret);
    const ofChord = chord ? (iv - chord.semis + 12) % 12 : null;
    const label = inside && ofChord !== null
      ? formula?.tones.find((t) => t.semis === ofChord)?.label ?? AROUND[ofChord]
      : n.degree;
    // Every copy of the note being looked at is ringed: that's the map.
    const base = { string: n.string, fret: n.fret, label, halo: n.pc === hoverPc };
    const tone = !!chord && chord.tones.includes(iv);
    const fade = quiet ? (inside ? (tone ? 0.75 : 0.45) : 0.32) : inside || !box ? 1 : 0.6;
    if (iv === 0) {
      return { ...base, fill: INK, fade, ring: chord?.tones.includes(0) ? MOOD_FILL.home : undefined };
    }
    if (!chord) return { ...base, fill: MOOD_FILL[mood], fade };
    if (!tone) return { ...base, fill: MOOD_TINT[mood], fade };
    return { ...base, fill: MOOD_FILL[mood], fade, ring: iv === chord.semis ? INK : undefined };
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
 * feels, its job in the chord, and where else it lives on the neck. A card
 * beside the pointer while it hovers; on a phone, where a tap picks the
 * note, it pins to the bottom of the screen until tapped away.
 */
function NoteTip({ tip, at, onClose }: {
  tip: ReturnType<typeof fretTip> | null;
  at: { x: number; y: number; touch: boolean } | null;
  onClose: () => void;
}) {
  if (!tip || !at) return null;
  const W = 320;
  // Beside the pointer, flipped to the other side near the window's edges.
  const left = at.x + 18 + W > window.innerWidth ? Math.max(8, at.x - 18 - W) : at.x + 18;
  const below = at.y < window.innerHeight * 0.6;
  const style: React.CSSProperties = at.touch
    ? { left: 12, right: 12, bottom: 12 }
    : below ? { left, top: at.y + 18, width: W } : { left, bottom: window.innerHeight - at.y + 18, width: W };
  return (
    <div role="tooltip" style={style} onClick={at.touch ? onClose : undefined}
      className={`fixed z-30 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-lg ${at.touch ? "" : "pointer-events-none"}`}>
      <p className="flex items-center gap-2 font-bold text-neutral-900">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full"
          style={{ background: tip.mood === "outside" ? "#a8a29e" : MOOD_FILL[tip.mood] }} />
        {tip.title}
      </p>
      <ul className="mt-1 space-y-0.5 text-neutral-600">
        {tip.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}
