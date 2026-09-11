"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fretboard, { FbNote } from "@/components/Fretboard";
import {
  NOTES, NoteName, ScaleKind, SCALE_LABEL, pentatonicBoxes, pivotNotes, noteAt, midiAt,
} from "@/lib/theory";
import { pluck, audioCtx } from "@/lib/audio";
import { logPractice } from "@/lib/store";

const BOX_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#c084fc"]; // box 1..5

type Mode = "map" | "connect";

export default function ConnectPage() {
  const [root, setRoot] = useState<NoteName>("A");
  const [kind, setKind] = useState<ScaleKind>("minorPent");
  const [mode, setMode] = useState<Mode>("connect");
  const [pair, setPair] = useState(1); // connect boxes pair..pair+1
  const [visible, setVisible] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [labelDegrees, setLabelDegrees] = useState(false);
  const [activeNote, setActiveNote] = useState<{ string: number; fret: number } | null>(null);
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { logPractice("connect"); }, []);
  useEffect(() => () => pulseTimers.current.forEach(clearTimeout), []);

  const clearPulseTimers = () => {
    pulseTimers.current.forEach(clearTimeout);
    pulseTimers.current = [];
  };

  const flashNote = (n: { string: number; fret: number }) => {
    setActiveNote(n);
    pulseTimers.current.push(setTimeout(() => setActiveNote(null), 220));
  };

  const boxes = useMemo(() => pentatonicBoxes(root, kind, 22), [root, kind]);
  const pivots = useMemo(() => pivotNotes(boxes, pair), [boxes, pair]);
  const maxFret = Math.min(22, Math.max(15, ...boxes.map((n) => n.fret)) + 1);

  const notes: FbNote[] = useMemo(() => {
    const isPivot = (n: { string: number; fret: number }) =>
      pivots.some((p) => p.string === n.string && p.fret === n.fret);

    if (mode === "map") {
      const seen = new Set<string>();
      return boxes
        .filter((n) => visible.has(n.box))
        .filter((n) => {
          const k = `${n.string}:${n.fret}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((n) => ({
          string: n.string,
          fret: n.fret,
          label: labelDegrees ? n.degree : noteAt(n.pc),
          fill: n.isRoot ? "#ffffff" : BOX_COLORS[n.box - 1],
        }));
    }

    // connect mode: show the pair, pivots highlighted, everything else dimmed.
    // Dedupe by position, preferring notes that belong to the selected pair.
    const byPos = new Map<string, (typeof boxes)[number]>();
    for (const n of boxes) {
      const k = `${n.string}:${n.fret}`;
      const cur = byPos.get(k);
      const inPair = n.box === pair || n.box === pair + 1;
      const curInPair = cur !== undefined && (cur.box === pair || cur.box === pair + 1);
      if (!cur || (inPair && !curInPair)) byPos.set(k, n);
    }
    return [...byPos.values()]
      .map((n) => {
        const inPair = n.box === pair || n.box === pair + 1;
        const piv = isPivot(n);
        return {
          string: n.string,
          fret: n.fret,
          label: labelDegrees ? n.degree : noteAt(n.pc),
          fill: piv ? "#ffffff" : n.isRoot ? "#fca5a5" : BOX_COLORS[n.box - 1],
          ring: piv ? "#fbbf24" : undefined,
          dim: !inPair,
        };
      });
  }, [boxes, pivots, mode, pair, visible, labelDegrees]);

  // Demo run: walk up box `pair`, cross at a pivot, continue up box pair+1.
  const playRun = () => {
    audioCtx();
    const a = boxes.filter((n) => n.box === pair);
    const b = boxes.filter((n) => n.box === pair + 1);
    const seq: { string: number; fret: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const fr = a.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
      // ascend box A: lower note then higher note per string until string 3
      if (s <= 2) fr.forEach((f) => seq.push({ string: s, fret: f }));
      else if (s === 3) {
        // cross over: slide from box A's top note into box B on this string
        const frB = b.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
        fr.forEach((f) => seq.push({ string: s, fret: f }));
        frB.filter((f) => f > (fr.at(-1) ?? 0)).forEach((f) => seq.push({ string: s, fret: f }));
      } else {
        const frB = b.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
        frB.forEach((f) => seq.push({ string: s, fret: f }));
      }
    }
    clearPulseTimers();
    const ac = audioCtx();
    const t0 = ac.currentTime + 0.1;
    seq.forEach((n, i) => {
      const when = t0 + i * 0.22;
      pluck(midiAt(n.string, n.fret), when, 0.5, 0.45);
      const delay = Math.max(0, (when - ac.currentTime) * 1000);
      pulseTimers.current.push(setTimeout(() => setActiveNote(n), delay));
    });
    const lastDelay = Math.max(0, (t0 + (seq.length - 1) * 0.22 - ac.currentTime) * 1000);
    pulseTimers.current.push(setTimeout(() => setActiveNote(null), lastDelay + 350));
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Connect</h1>
        <p className="text-sm text-neutral-400">
          You know all five boxes. The neck is one scale — these are the seams.
        </p>
      </header>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={root}
          onChange={(e) => setRoot(e.target.value as NoteName)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-sm">
          {(["minorPent", "majorPent"] as ScaleKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-3 py-2 ${kind === k ? "bg-amber-400/20 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
              {k === "minorPent" ? "minor" : "major"}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-sm">
          {(["map", "connect"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-2 ${mode === m ? "bg-amber-400/20 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
              {m === "map" ? "full map" : "connect"}
            </button>
          ))}
        </div>
        <button onClick={() => setLabelDegrees((v) => !v)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
          {labelDegrees ? "showing degrees" : "showing notes"}
        </button>
      </div>

      <p className="text-sm text-neutral-300">
        <span className="text-amber-300">{root} {SCALE_LABEL[kind]}</span>
        {mode === "connect" && <> — boxes {pair} & {pair + 1}. White notes with the gold ring are shared by both boxes: slide through them and the position change disappears.</>}
        {mode === "map" && <> — all five boxes. Roots are white. Toggle boxes below to see how each hands off to the next.</>}
      </p>

      {mode === "map" ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((b) => (
            <button key={b}
              onClick={() => setVisible((v) => {
                const nv = new Set(v);
                if (nv.has(b)) nv.delete(b); else nv.add(b);
                return nv.size ? nv : new Set([b]);
              })}
              className={`rounded-full border px-3 py-1.5 text-sm ${visible.has(b) ? "border-transparent text-neutral-950" : "border-neutral-700 text-neutral-500"}`}
              style={visible.has(b) ? { background: BOX_COLORS[b - 1] } : {}}>
              Box {b}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4].map((p) => (
            <button key={p} onClick={() => setPair(p)}
              className={`rounded-full border px-3 py-1.5 text-sm ${pair === p ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-neutral-700 text-neutral-400"}`}>
              {p} ↔ {p + 1}
            </button>
          ))}
          <button onClick={playRun}
            className="ml-auto rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-neutral-950 hover:bg-amber-300">
            ▶ hear the crossing
          </button>
        </div>
      )}

      <Fretboard notes={notes} maxFret={maxFret} activeNote={activeNote} onNoteClick={flashNote} />

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="mb-1 font-bold text-neutral-100">The drill</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pick a pair of boxes. Play up the lower one, but when you hit a <span className="text-amber-300">pivot note</span> on the G or B string, <em>slide</em> into the upper box and keep going.</li>
          <li>Come back down crossing on a different string.</li>
          <li>Tap any note to hear it. Use “hear the crossing” for the idea, then make your own path — that&apos;s the melody part.</li>
        </ol>
      </div>
    </div>
  );
}
