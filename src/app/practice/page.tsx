"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Fretboard, { FbNote } from "@/components/Fretboard";
import ChordDiagram from "@/components/ChordDiagram";
import {
  NOTES, NoteName, ScaleKind, chordName, chordTonePcs, lickTip,
  noteAt, noteIndex, pentatonicBoxes, POSITION_SHAPE,
} from "@/lib/theory";
import { PROGRESSIONS, realize } from "@/lib/progressions";
import { Metronome, audioCtx, click, pluck, strumChord } from "@/lib/audio";
import { DRILL_BASE_BPM, logDrill, subscribe, tempoFor } from "@/lib/store";
import TipCard from "@/components/TipCard";

export default function PracticePage() {
  const met = useRef<Metronome | null>(null);
  if (!met.current) met.current = new Metronome();
  const m = met.current;

  const [progId, setProgId] = useState(PROGRESSIONS[0].id);
  const [key, setKey] = useState<NoteName>("A");
  // Tempo comes from the ladder; a nudge on the +/- buttons overrides it for
  // this sitting only. Derived, so no effect has to copy it into state.
  const ladderBpm = useSyncExternalStore(
    subscribe,
    () => tempoFor("changes"),
    () => DRILL_BASE_BPM.changes,
  );
  const [bpmNudge, setBpmNudge] = useState<number | null>(null);
  const bpm = bpmNudge ?? ladderBpm;
  const setBpm = (f: (b: number) => number) => setBpmNudge((n) => f(n ?? ladderBpm));
  const [running, setRunning] = useState(false);
  const [chordIdx, setChordIdx] = useState(0);
  const [beatInChord, setBeatInChord] = useState(-1);
  const [box, setBox] = useState(1);

  const prog = useMemo(() => PROGRESSIONS.find((p) => p.id === progId)!, [progId]);
  const chords = useMemo(() => realize(prog, key), [prog, key]);

  // Which pentatonic fits: minor progressions → minor pent of key; major → major pent.
  const scaleKind: ScaleKind = prog.minor ? "minorPent" : "majorPent";
  const boxes = useMemo(() => pentatonicBoxes(key, scaleKind, 22), [key, scaleKind]);
  const maxFret = 22; // full neck

  const activeChord = chords[chordIdx];
  const chordPcs = useMemo(() => new Set(chordTonePcs(activeChord.chord)), [activeChord]);

  const fbNotes: FbNote[] = useMemo(() => {
    const seen = new Set<string>();
    return boxes
      .filter((n) => n.box === box)
      .filter((n) => {
        const k = `${n.string}:${n.fret}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((n) => {
        const isChordTone = chordPcs.has(n.pc);
        return {
          string: n.string,
          fret: n.fret,
          label: noteAt(n.pc),
          fill: isChordTone ? "#fbbf24" : "#c4c4c8",
          ring: n.pc === noteIndex(activeChord.chord.root) ? "#18181b" : undefined,
          dim: !isChordTone,
        };
      });
  }, [boxes, box, chordPcs, activeChord]);

  // playback: flatten chords into a beat timeline
  const timeline = useMemo(() => {
    const beats: { chordIdx: number; beatInChord: number }[] = [];
    chords.forEach((c, ci) => {
      for (let b = 0; b < c.beats; b++) beats.push({ chordIdx: ci, beatInChord: b });
    });
    return beats;
  }, [chords]);

  const cycles = useRef(0);
  const [logged, setLogged] = useState<{ cycles: number; delta: number } | null>(null);

  const stateRef = useRef({ timeline, chords });
  stateRef.current = { timeline, chords };

  // No logging on mount. The Changes drill logs when a run of at least
  // MIN_CYCLES complete passes through the progression ends.
  useEffect(() => () => m.stop(), [m]);
  useEffect(() => { m.bpm = bpm; }, [bpm, m]);

  m.onTick = (t) => {
    const { timeline: tl, chords: ch } = stateRef.current;
    if (t.count > 0 && t.count % tl.length === 0) cycles.current += 1;
    const step = tl[t.count % tl.length];
    const chord = ch[step.chordIdx];
    const rootPc = noteIndex(chord.chord.root);
    // bass root on each beat; strum on beat 1 of the chord (and halfway for long chords)
    const bassMidi = 40 + ((rootPc - 4 + 12) % 12); // nearest E2+
    pluck(bassMidi, t.when, 0.5, 0.5);
    if (step.beatInChord === 0 || (chord.beats >= 8 && step.beatInChord % 4 === 0)) {
      const shapeMidis = [0, 1, 2].map((iv) => 52 + ((chordTonePcs(chord.chord)[iv] - 4 + 12) % 12));
      strumChord(shapeMidis, t.when + 0.02, 0.22);
    }
    click(t.when, step.beatInChord % 4 === 0, 0.35);
    const delay = Math.max(0, (t.when - audioCtx().currentTime) * 1000);
    setTimeout(() => { setChordIdx(step.chordIdx); setBeatInChord(step.beatInChord); }, delay);
  };

  const MIN_CYCLES = 2; // below two times round it isn't a run

  const toggle = () => {
    if (running) {
      m.stop(); setRunning(false); setBeatInChord(-1);
      const done = cycles.current;
      if (done >= MIN_CYCLES) {
        // Completing the changes at tempo is the measurement; there is nothing
        // to grade against yet, so holding the full run is the pass.
        const { tempoChanged } = logDrill({
          drill: "changes", value: done, unit: "pct", tempo: bpm, passed: done >= 4,
        });
        setLogged({ cycles: done, delta: tempoChanged });
      }
    } else {
      audioCtx();
      cycles.current = 0;
      setLogged(null);
      m.subsPerBeat = 1;
      m.start();
      setRunning(true);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Practice</h1>
        <p className="text-sm text-neutral-600">Chords + licks together. Strum the changes, then answer them with the scale below.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select value={progId} onChange={(e) => { setProgId(e.target.value); setChordIdx(0); }}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
          {PROGRESSIONS.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.vibe}</option>
          ))}
        </select>
        <select value={key} onChange={(e) => { setKey(e.target.value as NoteName); setChordIdx(0); }}
          className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
          {NOTES.map((n) => <option key={n} value={n}>{n}{prog.minor ? "m" : ""}</option>)}
        </select>
      </div>

      {/* chord cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chords.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <ChordDiagram chord={c.chord} active={i === chordIdx} />
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <span>{c.numeral}</span>
              {i === chordIdx && running && (
                <span className="tabular-nums text-amber-700">
                  {Array.from({ length: Math.min(c.beats, 8) }, (_, b) =>
                    b === beatInChord % 8 ? "●" : "○").join("")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle}
          className={`rounded-full px-6 py-2.5 font-bold ${running ? "bg-neutral-900 text-neutral-50" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"}`}>
          {running ? "■ stop" : "▶ play backing"}
        </button>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <button onClick={() => setBpm((b) => Math.max(40, b - 5))} className="h-9 w-9 rounded-full border border-neutral-300">−</button>
          <span className="w-16 text-center tabular-nums"><b className="text-neutral-900">{bpm}</b> bpm</span>
          <button onClick={() => setBpm((b) => Math.min(200, b + 5))} className="h-9 w-9 rounded-full border border-neutral-300">+</button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4 text-sm">
        <p className="text-neutral-700">{prog.tip}</p>
      </div>

      {/* lick zone */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-neutral-900">
            Lick zone — {key} {scaleKind === "minorPent" ? "minor" : "major"} pentatonic, Position {box} ({POSITION_SHAPE[scaleKind][(box - 1) % 5]})
          </h2>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((b) => (
              <button key={b} onClick={() => setBox(b)}
                title={`Position ${b} — ${POSITION_SHAPE[scaleKind][(b - 1) % 5]}`}
                className={`h-8 w-8 rounded-full border text-sm ${box === b ? "border-amber-400 bg-amber-400/15 text-amber-700" : "border-neutral-300 text-neutral-600"}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-neutral-600">
          Gold = chord tones of <b className="text-amber-700">{chordName(activeChord.chord)}</b> (safe landings, root ringed white). Grey = passing notes.{" "}
          {lickTip(activeChord.chord, key, scaleKind)}
        </p>
        <Fretboard notes={fbNotes} maxFret={maxFret} />
        <p className="text-xs text-neutral-500">
          The drill: strum the chord once when it changes, then fill the rest of the bar with a 3–4 note lick that lands on a gold note as the next chord hits. Switch positions each round — that&apos;s your horizontal practice sneaking in.
        </p>
      </div>

      {logged && (
        <div className={`rounded-2xl border p-4 text-sm ${logged.cycles >= 4 ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-neutral-100/50"}`}>
          <p className="font-bold text-neutral-950">
            Run logged — {logged.cycles} times through at {bpm} BPM.
          </p>
          <p className="mt-1 text-neutral-700">
            {logged.delta > 0
              ? `Two solid runs in a row. Next session goes to ${bpm + logged.delta} BPM.`
              : logged.delta < 0
                ? `Dropping to ${bpm + logged.delta} BPM next session — slowing down is the drill working.`
                : logged.cycles >= 4
                  ? "Four times round holds the changes. Once more and the tempo goes up."
                  : "Four times round is the bar. Stay here until the changes are automatic."}
          </p>
        </div>
      )}

      <TipCard
        room="practice"
        ctx={{ root: key, kind: scaleKind, chord: activeChord.chord, position: box }}
        label="Chord tip"
      />
    </div>
  );
}
