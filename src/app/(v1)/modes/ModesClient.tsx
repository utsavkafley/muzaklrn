"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Fretboard, { FbNote } from "@/components/Fretboard";
import {
  Chord, NOTES, NoteName, chordName, chordTonePcs, fretNotesFor,
  noteAt, noteIndex, pentatonicBoxes, POSITION_SHAPE,
} from "@/lib/theory";
import {
  MODES, Mode, ModeId, addedPcs, brighterThan, characterPc, darkerThan, degreeNote,
  isMode, modeById, modeSpelling, noteForDegree, oneNoteApart, parentLabel, relativeMajor,
} from "@/lib/modes";
import { Metronome, Voice, audioCtx, pluck, strumChord } from "@/lib/audio";
import { DRILL_BASE_BPM, logDrill, subscribe, tempoFor } from "@/lib/store";

const MAX_FRET = 22;
const BEATS_PER_CHORD = 4;
const REPS = 6;
const PASS_PCT = 80;

const COLOR = {
  root: "#18181b",
  known: "#a1a1aa", // already in the pentatonic — context, not news
  added: "#34d399", // the second new note
  character: "#fbbf24", // the note the whole mode hangs on
};

type Phase = "idle" | "listening" | "answering" | "reveal" | "done";

/** Close ascending voicing from C3, so vamp chords don't jump octaves. */
function voicing(c: Chord): number[] {
  let last = 47;
  return chordTonePcs(c).map((pc) => {
    let m = 48 + pc;
    while (m <= last) m += 12;
    last = m;
    return m;
  });
}

/** One octave of the mode, ascending, as MIDI — for hearing it against a drone. */
function runMidis(root: NoteName, mode: Mode): number[] {
  const base = 52 + ((noteIndex(root) - 4 + 12) % 12); // nearest root at/above E3
  return [...mode.intervals.map((iv) => base + iv), base + 12];
}

export default function ModesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const keyParam = sp.get("key");
  const root: NoteName = (NOTES as readonly string[]).includes(keyParam ?? "")
    ? (keyParam as NoteName)
    : "A";
  const modeId: ModeId = isMode(sp.get("mode")) ? (sp.get("mode") as ModeId) : "dorian";
  const mode = modeById(modeId);
  /** 0 = whole neck, 1..5 = one position of the parent pentatonic. */
  const pos = Math.min(5, Math.max(0, Number(sp.get("pos") ?? 1) || 0));

  const [labelDegrees, setLabelDegrees] = useState(true);
  const [activeNote, setActiveNote] = useState<{ string: number; fret: number } | null>(null);
  const [vamping, setVamping] = useState(false);
  const [auditioning, setAuditioning] = useState<ModeId | null>(null);

  // --- the ear drill ---
  const [phase, setPhase] = useState<Phase>("idle");
  const [rep, setRep] = useState(0);
  const [hits, setHits] = useState(0);
  const [asked, setAsked] = useState<ModeId | null>(null);
  const [guess, setGuess] = useState<ModeId | null>(null);
  const [outcome, setOutcome] = useState<{ pct: number; hits: number; delta: number } | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voices = useRef<Voice[]>([]);
  const metRef = useRef<Metronome | null>(null);
  const getMet = useCallback(() => {
    if (!metRef.current) metRef.current = new Metronome();
    return metRef.current;
  }, []);

  const bpm = useSyncExternalStore(
    subscribe,
    () => tempoFor("colour"),
    () => DRILL_BASE_BPM.colour,
  );

  // The mode this one is compared against: its neighbour on the brightness rail,
  // which by construction differs by exactly one note.
  const [againstId, setAgainstId] = useState<ModeId | null>(null);
  const neighbours = useMemo(
    () => [brighterThan(mode), darkerThan(mode)].filter((m): m is Mode => !!m),
    [mode],
  );
  const against = useMemo(
    () => neighbours.find((m) => m.id === againstId) ?? darkerThan(mode) ?? brighterThan(mode)!,
    [neighbours, againstId, mode],
  );
  const diff = useMemo(() => oneNoteApart(mode, against), [mode, against]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stopAll = useCallback(() => {
    clearTimers();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    getMet().stop();
    setActiveNote(null);
    setVamping(false);
    setAuditioning(null);
  }, [getMet]);

  const abortDrill = useCallback(() => {
    stopAll();
    setPhase("idle");
    setRep(0);
    setHits(0);
    setAsked(null);
    setGuess(null);
  }, [stopAll]);

  useEffect(() => stopAll, [stopAll]);

  const setParams = useCallback(
    (patch: Record<string, string>) => {
      abortDrill();
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) next.set(k, v);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname, abortDrill],
  );

  // ---------- what's on the neck ----------

  const all = useMemo(
    () => fretNotesFor(root, mode.intervals, mode.degrees, MAX_FRET),
    [root, mode],
  );

  /** Fret window of the chosen parent-pentatonic position, widened by a fret each way. */
  const window = useMemo(() => {
    if (pos === 0) return { lo: 0, hi: MAX_FRET };
    const boxes = pentatonicBoxes(root, mode.parent, MAX_FRET).filter((n) => n.box === pos);
    if (!boxes.length) return { lo: 0, hi: MAX_FRET };
    // Shapes repeat every octave, so take the lowest occurrence only — a box
    // spans five frets, and anything past that is the same shape again.
    const lo = Math.min(...boxes.map((n) => n.fret));
    const hi = Math.max(...boxes.filter((n) => n.fret <= lo + 5).map((n) => n.fret));
    // A mode's new note often sits one fret outside the box — reachable by
    // stretching back with the index or up with the little finger, which is
    // exactly how it gets played. Wider than that and it stops being a position.
    return { lo: Math.max(0, lo - 1), hi: hi + 1 };
  }, [root, mode.parent, pos]);

  const addPcs = useMemo(() => new Set(addedPcs(root, mode)), [root, mode]);
  const charPc = useMemo(() => characterPc(root, mode), [root, mode]);

  const notes: FbNote[] = useMemo(
    () =>
      all
        .filter((n) => n.fret >= window.lo && n.fret <= window.hi)
        .map((n) => {
          const isChar = n.pc === charPc && !n.isRoot;
          const isNew = addPcs.has(n.pc);
          return {
            string: n.string,
            fret: n.fret,
            label: labelDegrees ? n.degree : noteAt(n.pc),
            fill: n.isRoot ? COLOR.root : isChar ? COLOR.character : isNew ? COLOR.added : COLOR.known,
            ring: isChar ? "#18181b" : undefined,
            // On the whole neck the pentatonic recedes so the new notes read as
            // a pattern; inside one position it stays solid, because there it
            // is the shape your hand is actually holding.
            dim: pos === 0 && !n.isRoot && !isNew,
          };
        }),
    [all, window, labelDegrees, addPcs, charPc, pos],
  );

  // ---------- listening ----------

  // The vamp's tick callback runs on the audio clock, not on render, so it
  // reads the current mode and key through refs rather than being rebuilt —
  // rewiring onTick mid-bar would drop a beat.
  const vampRef = useRef(mode);
  const rootRef = useRef(root);
  useEffect(() => {
    vampRef.current = mode;
    rootRef.current = root;
  }, [mode, root]);

  useEffect(() => {
    const met = getMet();
    met.onTick = (t) => {
      const m = vampRef.current;
      const r = rootRef.current;
      const idx = Math.floor(t.count / BEATS_PER_CHORD) % m.vamp.length;
      const vc = m.vamp[idx];
      const chord: Chord = { root: noteAt(noteIndex(r) + vc.semitones), quality: vc.quality };
      const bass = 40 + ((noteIndex(chord.root) - 4 + 12) % 12);
      pluck(bass, t.when, 0.6, 0.4);
      if (t.count % BEATS_PER_CHORD === 0) strumChord(voicing(chord), t.when + 0.02, 0.24);
    };
    return () => { met.onTick = null; };
  }, [getMet]);

  const toggleVamp = () => {
    if (vamping) { stopAll(); return; }
    audioCtx();
    const met = getMet();
    met.bpm = bpm;
    met.beatsPerBar = 4;
    met.subsPerBeat = 1;
    met.start();
    setVamping(true);
  };

  /** Bare root + octave. No 3rd, no 5th — nothing that hints at which mode. */
  const drone = (when: number, dur: number) => {
    const base = 40 + ((noteIndex(root) - 4 + 12) % 12);
    voices.current.push(pluck(base, when, dur, 0.28));
    voices.current.push(pluck(base + 12, when, dur, 0.16));
  };

  /**
   * Play one octave of a mode over the neutral drone, lighting up the fretboard
   * as it goes. Returns when the last note finishes, in seconds from now.
   */
  const audition = useCallback(
    (m: Mode, at: number, light: boolean): number => {
      const ac = audioCtx();
      const step = 60 / bpm;
      const midis = runMidis(root, m);
      const positions = light
        ? fretNotesFor(root, m.intervals, m.degrees, MAX_FRET)
        : [];
      midis.forEach((midi, i) => {
        const when = at + i * step;
        voices.current.push(pluck(midi, when, step * 1.6, 0.5));
        if (light) {
          const pc = ((midi % 12) + 12) % 12;
          const hit = positions
            .filter((n) => n.pc === pc && n.fret >= window.lo && n.fret <= window.hi)
            .sort((a, b) => a.string - b.string || a.fret - b.fret)[0];
          if (hit) {
            timers.current.push(
              setTimeout(
                () => setActiveNote({ string: hit.string, fret: hit.fret }),
                Math.max(0, (when - ac.currentTime) * 1000),
              ),
            );
          }
        }
      });
      return (midis.length + 0.5) * step;
    },
    [root, bpm, window],
  );

  const hearMode = (m: Mode) => {
    if (auditioning) { stopAll(); return; }
    const ac = audioCtx();
    stopAll();
    setAuditioning(m.id);
    const t0 = ac.currentTime + 0.12;
    const len = audition(m, t0, true);
    drone(t0, len);
    timers.current.push(
      setTimeout(() => { setAuditioning(null); setActiveNote(null); }, len * 1000 + 200),
    );
  };

  /** The whole lesson in six seconds: same scale, one note different. */
  const hearBoth = () => {
    if (auditioning) { stopAll(); return; }
    const ac = audioCtx();
    stopAll();
    setAuditioning(mode.id);
    const t0 = ac.currentTime + 0.12;
    const lenA = audition(mode, t0, false);
    drone(t0, lenA);
    const t1 = t0 + lenA + 0.25;
    timers.current.push(
      setTimeout(() => setAuditioning(against.id), Math.max(0, (t1 - ac.currentTime) * 1000)),
    );
    const lenB = audition(against, t1, false);
    drone(t1, lenB);
    timers.current.push(
      setTimeout(() => setAuditioning(null), (t1 - ac.currentTime + lenB) * 1000 + 200),
    );
  };

  // ---------- the drill ----------

  const startRep = useCallback(
    (n: number) => {
      stopAll();
      const pick = Math.random() < 0.5 ? mode : against;
      setAsked(pick.id);
      setGuess(null);
      setRep(n);
      setPhase("listening");
      const ac = audioCtx();
      const t0 = ac.currentTime + 0.2;
      const len = audition(pick, t0, false);
      drone(t0, len);
      timers.current.push(setTimeout(() => setPhase("answering"), len * 1000));
    },
    // `drone` and `audition` both close over root/bpm, which is all that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopAll, mode, against, audition, root, bpm],
  );

  const answer = (id: ModeId) => {
    clearTimers();
    setGuess(id);
    setPhase("reveal");
    const right = id === asked;
    const nextHits = hits + (right ? 1 : 0);
    setHits(nextHits);
    if (rep >= REPS) {
      const pct = Math.round((nextHits / REPS) * 100);
      const { tempoChanged } = logDrill({
        drill: "colour", value: pct, unit: "pct", tempo: bpm, passed: pct >= PASS_PCT,
      });
      setOutcome({ pct, hits: nextHits, delta: tempoChanged });
      timers.current.push(setTimeout(() => setPhase("done"), 1400));
    } else {
      timers.current.push(setTimeout(() => startRep(rep + 1), 1400));
    }
  };

  const startDrill = () => {
    setHits(0);
    setOutcome(null);
    startRep(1);
  };

  const replay = () => {
    if (!asked) return;
    stopAll();
    const ac = audioCtx();
    const t0 = ac.currentTime + 0.12;
    const len = audition(modeById(asked), t0, false);
    drone(t0, len);
  };

  const drillRunning = phase === "listening" || phase === "answering" || phase === "reveal";

  const spelling = modeSpelling(root, mode);
  const addedNotes = mode.added.map((d) => ({ d, n: degreeNote(root, mode, d) }));
  /** Degrees this mode shares with its parent pentatonic — the legend's grey dots. */
  const parentDegrees = mode.degrees.filter(
    (d) => !mode.added.includes(d) && d !== "1",
  );
  const charNote = degreeNote(root, mode, mode.character);
  const relMaj = relativeMajor(root, mode);
  const parentWord = parentLabel(mode);

  return (
    <div className="space-y-5">
      <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Modes</h1>

      <div className="flex flex-wrap items-center gap-2">
        <select value={root} onChange={(e) => setParams({ key: e.target.value })}
          className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={() => setLabelDegrees((v) => !v)}
          aria-label="labels"
          className="w-12 rounded-lg border border-neutral-300 bg-neutral-100 py-2 text-center text-sm text-neutral-600">
          {labelDegrees ? "1" : "A"}
        </button>
        <button onClick={toggleVamp} disabled={drillRunning}
          aria-label="vamp"
          className={`ml-auto h-11 w-11 rounded-full text-base font-bold disabled:opacity-40 ${
            vamping ? "border border-neutral-400 text-neutral-800" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"
          }`}>
          {vamping ? "■" : "▶"}
        </button>
      </div>

      {/* the brightness rail — the only ordering of the modes that explains anything */}
      <section>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m, i) => {
            const active = m.id === mode.id;
            // The dot carries the brightness ramp on a pale ground, so it runs
            // light-warm to near-black rather than white to amber.
            const shade = 74 - i * 8;
            return (
              <button key={m.id} onClick={() => setParams({ mode: m.id })} disabled={drillRunning}
                className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${
                  active ? "border-amber-400 bg-amber-400 text-neutral-950" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: `hsl(38 92% ${shade}%)` }} aria-hidden />
                {m.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* the claim, in this key */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-5">
        <h2 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold text-neutral-950">
          {root} {mode.name}
          {mode.alias && <span className="text-base font-normal text-neutral-500">— {mode.alias}</span>}
        </h2>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
          <span className="text-neutral-700">{root} {parentWord}</span>
          {addedNotes.map(({ d, n }) => (
            <span key={d} className="text-neutral-500">
              +{" "}
              <b className={d === mode.character ? "text-amber-700" : "text-emerald-700"}>
                {n}
              </b>
              <span className="text-sm text-neutral-500"> ({d})</span>
            </span>
          ))}
          {mode.dropped && (
            <span className="text-neutral-500">
              −{" "}
              <b className="text-red-700">{noteForDegree(root, mode.dropped)}</b>
              <span className="text-sm text-neutral-500"> ({mode.dropped})</span>
            </span>
          )}
          <span className="text-neutral-500">=</span>
          <b className="text-neutral-950">{root} {mode.name}</b>
        </p>

        <p className="mt-4 border-t border-neutral-200 pt-3 text-lg tabular-nums text-neutral-800">
          {spelling.join(" ")}
        </p>
        <p className="mt-1 text-sm text-neutral-500">= {relMaj} major</p>

      </section>

      {/* one note apart */}
      {diff && (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap items-baseline gap-x-2 text-lg">
              <b className="text-neutral-900">{noteForDegree(root, diff.brighter)}</b>
              <span className="text-sm text-neutral-500">({diff.brighter})</span>
              <span className="text-neutral-400">/</span>
              <b className="text-neutral-900">{noteForDegree(root, diff.darker)}</b>
              <span className="text-sm text-neutral-500">({diff.darker})</span>
            </p>
            <button onClick={hearBoth} disabled={drillRunning} aria-label="compare"
              className={`h-11 w-11 shrink-0 rounded-full text-base font-bold disabled:opacity-40 ${
                auditioning ? "border border-neutral-400 text-neutral-800" : "bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
              }`}>
              {auditioning ? "■" : "▶"}
            </button>
          </div>
          {neighbours.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
              {neighbours.map((m) => (
                <button key={m.id} onClick={() => setAgainstId(m.id)} disabled={drillRunning}
                  className={`rounded-full border px-3 py-1 text-sm disabled:opacity-40 ${
                    m.id === against.id ? "border-neutral-600 text-neutral-900" : "border-neutral-200 text-neutral-500"
                  }`}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: `hsl(38 92% ${74 - MODES.indexOf(m) * 8}%)` }} aria-hidden />
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* the neck */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-neutral-900">
            {pos === 0 ? "—" : POSITION_SHAPE[mode.parent][(pos - 1) % 5]}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((p) => (
              <button key={p} onClick={() => setParams({ pos: String(p) })} disabled={drillRunning}
                title={POSITION_SHAPE[mode.parent][(p - 1) % 5]}
                className={`h-8 w-8 rounded-full border text-sm disabled:opacity-40 ${
                  pos === p ? "border-amber-400 bg-amber-400/15 text-amber-700" : "border-neutral-300 text-neutral-600"
                }`}>
                {p}
              </button>
            ))}
            <button onClick={() => setParams({ pos: "0" })} disabled={drillRunning}
              className={`h-8 rounded-full border px-3 text-sm disabled:opacity-40 ${
                pos === 0 ? "border-amber-400 bg-amber-400/15 text-amber-700" : "border-neutral-300 text-neutral-600"
              }`}>
              <span aria-label="whole neck">≡</span>
            </button>
          </div>
        </div>

        {/* Every swatch is labelled with the degrees it stands for — the legend
            says what it means without a sentence of explanation. */}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-neutral-700">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: COLOR.root }} />1
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: COLOR.known }} />
            {parentDegrees.join(" ")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: COLOR.added }} />
            {mode.added.filter((d) => d !== mode.character).join(" ")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full ring-1 ring-neutral-900" style={{ background: COLOR.character }} />
            {mode.character}
          </span>
          {mode.dropped && (
            <span className="flex items-center gap-1.5 text-red-700">
              <span aria-hidden>−</span>{mode.dropped}
            </span>
          )}
        </p>

        <Fretboard
          notes={notes}
          maxFret={MAX_FRET}
          activeNote={activeNote}
          onNoteClick={(n) => setActiveNote({ string: n.string, fret: n.fret })}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => hearMode(mode)} disabled={drillRunning} aria-label="play"
            className={`h-11 w-11 rounded-full text-base font-bold disabled:opacity-40 ${
              auditioning ? "border border-neutral-400 text-neutral-800" : "bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
            }`}>
            {auditioning ? "■" : "▶"}
          </button>
          <p className="text-lg tabular-nums text-neutral-700">
            {root} {mode.name} <span className="text-neutral-400">·</span>{" "}
            <b className="text-amber-700">{charNote}</b>
          </p>
        </div>
      </section>

      {/* the vamp that holds the mode still */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {mode.vamp.map((vc, i) => {
            const chord: Chord = {
              root: noteAt(noteIndex(root) + vc.semitones),
              quality: vc.quality,
            };
            return (
              <button key={i} onClick={() => { audioCtx(); strumChord(voicing(chord)); }}
                title={vc.numeral}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-bold text-neutral-800 hover:border-amber-400/60 hover:text-amber-700">
                {chordName(chord)}
                <span className="ml-1.5 text-xs font-normal text-neutral-500">{vc.numeral}</span>
              </button>
            );
          })}
          <button onClick={toggleVamp} disabled={drillRunning} aria-label="loop"
            className="ml-auto text-base text-neutral-500 hover:text-amber-700 disabled:opacity-40">
            {vamping ? "■" : "▶"}
          </button>
        </div>
      </section>

      {/* the scored drill */}
      <section className={`rounded-2xl border p-4 ${
        drillRunning ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-neutral-200 bg-neutral-100/50"
      }`}>
        {phase === "idle" && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-lg font-bold text-neutral-900">
                {mode.name} <span className="font-normal text-neutral-400">/</span> {against.name}
              </p>
              <p className="tabular-nums text-neutral-500">
                {REPS}<span aria-hidden>×</span>
                <span className="ml-3 text-neutral-700">{bpm}</span>
                <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
              </p>
              <button onClick={startDrill} aria-label="start"
                className="ml-auto h-12 w-12 rounded-full bg-amber-400 text-xl font-bold text-neutral-950 hover:bg-amber-300">
                ▶
              </button>
            </div>
          </>
        )}

        {drillRunning && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold tabular-nums text-amber-700">
                {rep}/{REPS} <span className="text-neutral-400">·</span> {hits}
                <span aria-hidden>✓</span> <span className="text-neutral-400">·</span> {bpm}
                <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
              </p>
              <button onClick={abortDrill} aria-label="stop"
                className="text-sm text-neutral-500 hover:text-neutral-700">✕</button>
            </div>

            {phase === "listening" && (
              <p aria-label="listening" className="mt-3 animate-pulse text-3xl leading-none text-amber-700">♪</p>
            )}

            {phase !== "listening" && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[mode, against].map((m) => {
                    const chosen = guess === m.id;
                    const correct = asked === m.id;
                    const revealed = phase === "reveal";
                    return (
                      <button key={m.id} onClick={() => phase === "answering" && answer(m.id)}
                        disabled={phase !== "answering"}
                        className={`rounded-full border px-5 py-2 text-sm font-bold ${
                          revealed && correct ? "border-emerald-500 bg-emerald-500 text-neutral-950"
                            : revealed && chosen ? "border-red-500/70 text-red-700"
                            : "border-neutral-400 text-neutral-800 hover:border-neutral-600"
                        }`}>
                        {m.name}
                      </button>
                    );
                  })}
                  {phase === "answering" && (
                    <button onClick={replay} aria-label="replay"
                      className="rounded-full px-4 py-2 text-base text-neutral-500 hover:text-neutral-700">
                      ↻
                    </button>
                  )}
                </div>
                {phase === "reveal" && asked && (
                  <p className="mt-3 flex items-baseline gap-2 text-lg">
                    <span aria-hidden className={guess === asked ? "text-emerald-700" : "text-red-700"}>
                      {guess === asked ? "✓" : "✕"}
                    </span>
                    <b className="text-neutral-900">
                      {degreeNote(root, modeById(asked), modeById(asked).character)}
                    </b>
                    <span className="text-sm text-neutral-500">({modeById(asked).character})</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === "done" && outcome && (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 tabular-nums">
              <span className={`text-4xl font-bold ${outcome.pct >= PASS_PCT ? "text-emerald-700" : "text-neutral-900"}`}>
                {outcome.pct}%
              </span>
              <span className="text-neutral-500">{outcome.hits}/{REPS}</span>
              {/* Where the ladder moved next session's tempo. */}
              <span className="text-neutral-700">
                {bpm + outcome.delta}
                <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
                <span aria-hidden className={outcome.delta > 0 ? "ml-1 text-emerald-700" : outcome.delta < 0 ? "ml-1 text-amber-700" : "ml-1 text-neutral-400"}>
                  {outcome.delta > 0 ? "↑" : outcome.delta < 0 ? "↓" : "="}
                </span>
              </span>
              <button onClick={() => { setPhase("idle"); setOutcome(null); }} aria-label="again"
                className="ml-auto h-11 w-11 rounded-full border border-neutral-400 text-base text-neutral-800 hover:border-neutral-600">
                ↻
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
