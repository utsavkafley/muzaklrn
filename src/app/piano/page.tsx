"use client";

import { useEffect, useMemo, useState } from "react";
import Keyboard, { KeyNote } from "@/components/Keyboard";
import {
  NOTES, NoteName, ScaleKind, SCALE_LABEL, chordName, chordTonePcs,
  noteAt, noteIndex, scaleAcrossRange,
} from "@/lib/theory";
import { PROGRESSIONS, realize, ProgChord } from "@/lib/progressions";
import { audioCtx, blockChord, pluck } from "@/lib/audio";
import { logPractice } from "@/lib/store";
import TipCard from "@/components/TipCard";

const LO = 60; // C4
const HI = LO + 24; // 2 octaves

export default function PianoPage() {
  const [root, setRoot] = useState<NoteName>("C");
  const [kind, setKind] = useState<ScaleKind>("majorPent");
  const [progId, setProgId] = useState<string>("none");
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { logPractice("piano"); }, []);

  const prog = progId === "none" ? null : PROGRESSIONS.find((p) => p.id === progId)!;
  const chords: ProgChord[] = useMemo(() => (prog ? realize(prog, root) : []), [prog, root]);
  const activeChord = chords[activeIdx] ?? null;

  const scaleRange = useMemo(() => scaleAcrossRange(root, kind, LO, HI), [root, kind]);
  const rootPc = noteIndex(root);

  const notes: KeyNote[] = useMemo(() => {
    const chordPcs = activeChord ? new Set(chordTonePcs(activeChord.chord)) : null;
    return scaleRange.map((n) => {
      const pc = ((n.midi % 12) + 12) % 12;
      const isChordTone = !!chordPcs?.has(pc);
      return {
        midi: n.midi,
        label: noteAt(pc),
        fill: isChordTone ? "#fbbf24" : "#34d399",
        ring: pc === rootPc ? "#ffffff" : undefined,
        dim: !!chordPcs && !isChordTone,
      };
    });
  }, [scaleRange, activeChord, rootPc]);

  const playScale = () => {
    audioCtx();
    const t0 = audioCtx().currentTime + 0.08;
    scaleRange.filter((n) => n.midi <= LO + 12).forEach((n, i) => pluck(n.midi, t0 + i * 0.16, 0.5, 0.4));
  };

  const playChord = (c: ProgChord) => {
    const rp = noteIndex(c.chord.root);
    const rootMidi = 60 + rp;
    const midis = chordTonePcs(c.chord).map((pc) => rootMidi + ((pc - rp + 12) % 12));
    blockChord(midis, undefined, 0.4);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Piano</h1>
        <p className="text-sm text-neutral-400">
          A key/scale/chord reference to glance at while your hands are on the guitar. Fire up the FP30 next to the Katana + looper + Beat Buddy and keep this open.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={root}
          onChange={(e) => setRoot(e.target.value as NoteName)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-sm">
          {(["majorPent", "minorPent"] as ScaleKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-3 py-2 ${kind === k ? "bg-amber-400/20 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
              {k === "minorPent" ? "minor" : "major"}
            </button>
          ))}
        </div>
        <button onClick={playScale}
          className="ml-auto rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-amber-300">
          ▶ hear the scale
        </button>
      </div>

      <p className="text-sm text-neutral-300">
        <span className="text-amber-300">{root} {SCALE_LABEL[kind]}</span> — green keys are in the scale, root is ringed white.
        {activeChord && <> Gold keys are chord tones of <b className="text-amber-300">{chordName(activeChord.chord)}</b>; everything else dims.</>}
      </p>

      <Keyboard notes={notes} startMidi={LO} octaves={2} />

      {/* progression / chord reference */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-neutral-100">Chord reference</h2>
          <select
            value={progId}
            onChange={(e) => { setProgId(e.target.value); setActiveIdx(0); }}
            className="ml-auto min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm sm:flex-none"
          >
            <option value="none">just the scale</option>
            {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.vibe}</option>)}
          </select>
        </div>

        {chords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chords.map((c, i) => (
              <button
                key={i}
                onClick={() => { setActiveIdx(i); playChord(c); }}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  i === activeIdx
                    ? "border-amber-400 bg-amber-400/15 text-amber-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                <div className="font-bold">{chordName(c.chord)}</div>
                <div className="text-xs text-neutral-500">{c.numeral}</div>
              </button>
            ))}
          </div>
        )}

        {prog && (
          <p className="text-sm text-neutral-400">{prog.tip}</p>
        )}
      </div>

      <TipCard room="piano" ctx={{ root, kind }} label="Keys tip" />

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="mb-1 font-bold text-neutral-100">How to use this mid-jam</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Set the key you and the guitar/looper are in. Pick pentatonic major or minor — same sound you already know from the fretboard.</li>
          <li>If you&apos;re following a progression, pick it and tap through the chord buttons as it loops — the keyboard shows exactly which keys are chord tones right now.</li>
          <li>No progression? Leave it on &quot;just the scale&quot; and noodle — every green key is safe.</li>
        </ol>
      </div>
    </div>
  );
}
