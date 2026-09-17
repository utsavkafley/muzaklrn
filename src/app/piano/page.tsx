"use client";

import { useMemo, useState } from "react";
import Keyboard, { KeyNote } from "@/components/Keyboard";
import {
  NOTES, NoteName, ScaleKind, SCALE_LABEL, chordName, chordTonePcs,
  noteAt, noteIndex, scaleAcrossRange,
} from "@/lib/theory";
import { PROGRESSIONS, realize, ProgChord } from "@/lib/progressions";
import { audioCtx, blockChord, pluck } from "@/lib/audio";

const LO = 60; // C4
const HI = LO + 24; // 2 octaves

export default function PianoPage() {
  const [root, setRoot] = useState<NoteName>("C");
  const [kind, setKind] = useState<ScaleKind>("majorPent");
  const [progId, setProgId] = useState<string>("none");
  const [activeIdx, setActiveIdx] = useState(0);


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
        ring: pc === rootPc ? "#18181b" : undefined,
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
      <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Piano</h1>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={root}
          onChange={(e) => setRoot(e.target.value as NoteName)}
          className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
        >
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-neutral-300 text-sm">
          {(["majorPent", "minorPent"] as ScaleKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-3 py-2 ${kind === k ? "bg-amber-400/20 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
              {k === "minorPent" ? "minor" : "major"}
            </button>
          ))}
        </div>
        <button onClick={playScale} aria-label="play"
          className="ml-auto h-11 w-11 rounded-full bg-amber-400 text-base font-bold text-neutral-950 hover:bg-amber-300">
          ▶
        </button>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
        <span className="text-amber-700">{root} {SCALE_LABEL[kind]}</span>
        {activeChord && (
          <span className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full" style={{ background: "#fbbf24" }} />
            <b className="text-amber-700">{chordName(activeChord.chord)}</b>
          </span>
        )}
      </p>

      <Keyboard notes={notes} startMidi={LO} octaves={2} />

      {/* progression / chord reference */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={progId}
            onChange={(e) => { setProgId(e.target.value); setActiveIdx(0); }}
            className="ml-auto min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm sm:flex-none"
          >
            <option value="none">—</option>
            {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                    ? "border-amber-400 bg-amber-400/15 text-amber-700"
                    : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-500"
                }`}
              >
                <div className="font-bold">{chordName(c.chord)}</div>
                <div className="text-xs text-neutral-500">{c.numeral}</div>
              </button>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
