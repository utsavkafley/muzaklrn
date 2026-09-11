"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Fretboard, { FbNote } from "@/components/Fretboard";
import {
  NOTES, NoteName, ScaleKind, SCALE_LABEL, POSITION_SHAPE, pentatonicBoxes, pivotNotes,
  noteAt, midiAt, chordName, chordTonePcs, noteIndex, Chord,
} from "@/lib/theory";
import { PROGRESSIONS, Progression, progressionsFor, realize, sample } from "@/lib/progressions";
import { pluck, strumChord, audioCtx, Voice } from "@/lib/audio";
import { logPractice } from "@/lib/store";

const BOX_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#c084fc"]; // position 1..5
const MAX_FRET = 22; // full neck
const NOTE_SEC = 0.55; // demo run pace — slow enough to follow and copy

type Mode = "map" | "connect";

/** Close ascending voicing from C3, for previewing a chord. */
function voicing(c: Chord): number[] {
  let last = 47;
  return chordTonePcs(c).map((pc) => {
    let m = 48 + pc;
    while (m <= last) m += 12;
    last = m;
    return m;
  });
}

export default function ConnectClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ---- URL is the source of truth for key / scale / mode / position ----
  const keyParam = sp.get("key");
  const root: NoteName = (NOTES as readonly string[]).includes(keyParam ?? "")
    ? (keyParam as NoteName)
    : "A";
  const kind: ScaleKind = sp.get("scale") === "major" ? "majorPent" : "minorPent";
  const mode: Mode = sp.get("mode") === "map" ? "map" : "connect";
  const pair = Math.min(4, Math.max(1, Number(sp.get("pos")) || 1));

  const [visible, setVisible] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [labelDegrees, setLabelDegrees] = useState(false);
  const [activeNote, setActiveNote] = useState<{ string: number; fret: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shuffled, setShuffled] = useState<Progression[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voices = useRef<Voice[]>([]);

  useEffect(() => { logPractice("connect"); }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stopRun = useCallback(() => {
    clearTimers();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    setActiveNote(null);
    setPlaying(false);
  }, []);

  useEffect(() => stopRun, [stopRun]);

  const setParams = useCallback(
    (patch: Record<string, string>) => {
      // Stop first: a run in flight would light up notes for the old setting.
      stopRun();
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) next.set(k, v);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname, stopRun],
  );

  const flashNote = (n: { string: number; fret: number }) => {
    setActiveNote(n);
    timers.current.push(setTimeout(() => setActiveNote(null), 320));
  };

  // Derived, not set in an effect: the default trio is a stable rotation keyed
  // on the tonic, so server and client agree. "shuffle" swaps in a random trio,
  // and changing key or scale drops back to the rotation for the new pool.
  const pool = useMemo(() => progressionsFor(kind), [kind]);
  const picks = useMemo(() => {
    if (shuffled && shuffled.every((p) => pool.includes(p))) return shuffled;
    if (!pool.length) return [];
    const off = (noteIndex(root) + (kind === "minorPent" ? 0 : 5)) % pool.length;
    return [0, 1, 2].map((i) => pool[(off + i) % pool.length]).filter(Boolean);
  }, [pool, shuffled, root, kind]);

  const boxes = useMemo(() => pentatonicBoxes(root, kind, MAX_FRET), [root, kind]);
  const pivots = useMemo(() => pivotNotes(boxes, pair), [boxes, pair]);

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
          fill: n.isRoot ? "#ffffff" : BOX_COLORS[(n.box - 1) % 5],
        }));
    }

    const byPos = new Map<string, (typeof boxes)[number]>();
    for (const n of boxes) {
      const k = `${n.string}:${n.fret}`;
      const cur = byPos.get(k);
      const inPair = n.box === pair || n.box === pair + 1;
      const curInPair = cur !== undefined && (cur.box === pair || cur.box === pair + 1);
      if (!cur || (inPair && !curInPair)) byPos.set(k, n);
    }
    return [...byPos.values()].map((n) => {
      const inPair = n.box === pair || n.box === pair + 1;
      const piv = isPivot(n);
      return {
        string: n.string,
        fret: n.fret,
        label: labelDegrees ? n.degree : noteAt(n.pc),
        fill: piv ? "#ffffff" : n.isRoot ? "#fca5a5" : BOX_COLORS[(n.box - 1) % 5],
        ring: piv ? "#fbbf24" : undefined,
        dim: !inPair,
      };
    });
  }, [boxes, pivots, mode, pair, visible, labelDegrees]);

  /**
   * Positions repeat every octave now that the whole neck is tiled, so pick the
   * lowest occurrence of the lower position and the occurrence of the upper one
   * that sits directly above it — otherwise 3↔4 would jump down an octave.
   */
  const cycle = useCallback(
    (box: number, after?: number) => {
      const all = boxes.filter((n) => n.box === box);
      const candidates = after === undefined ? all : all.filter((n) => n.fret >= after);
      if (!candidates.length) return [];
      const lo = Math.min(...candidates.map((n) => n.fret));
      return all.filter((n) => n.fret >= lo && n.fret <= lo + 5);
    },
    [boxes],
  );

  const playRun = () => {
    if (playing) { stopRun(); return; }
    const ac = audioCtx();
    const a = cycle(pair);
    if (!a.length) return;
    const aLo = Math.min(...a.map((n) => n.fret));
    const b = cycle(pair + 1, aLo);

    const seq: { string: number; fret: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const fr = a.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
      const frB = b.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
      if (s <= 2) {
        fr.forEach((f) => seq.push({ string: s, fret: f }));
      } else if (s === 3) {
        // the crossing itself: finish the lower position, slide into the upper
        fr.forEach((f) => seq.push({ string: s, fret: f }));
        frB.filter((f) => f > (fr.at(-1) ?? 0)).forEach((f) => seq.push({ string: s, fret: f }));
      } else {
        frB.forEach((f) => seq.push({ string: s, fret: f }));
      }
    }
    if (!seq.length) return;

    clearTimers();
    voices.current = [];
    setPlaying(true);
    const t0 = ac.currentTime + 0.12;
    seq.forEach((n, i) => {
      const when = t0 + i * NOTE_SEC;
      voices.current.push(pluck(midiAt(n.string, n.fret), when, 0.8, 0.45));
      timers.current.push(
        setTimeout(() => setActiveNote(n), Math.max(0, (when - ac.currentTime) * 1000)),
      );
    });
    const endMs = Math.max(0, (t0 + seq.length * NOTE_SEC - ac.currentTime) * 1000);
    timers.current.push(setTimeout(() => { setActiveNote(null); setPlaying(false); }, endMs));
  };

  const shapeOf = (box: number) => POSITION_SHAPE[kind][(box - 1) % 5];
  const scaleWord = kind === "minorPent" ? "minor" : "major";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Connect</h1>
        <p className="text-sm text-neutral-400">
          You know all five positions. The neck is one scale — these are the seams.
        </p>
      </header>

      {/* controls — key and scale live in the URL, so a view is shareable */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={root}
          onChange={(e) => setParams({ key: e.target.value })}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-sm">
          {(["minor", "major"] as const).map((k) => (
            <button key={k} onClick={() => setParams({ scale: k })}
              className={`px-3 py-2 ${scaleWord === k ? "bg-amber-400/20 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-sm">
          {(["map", "connect"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setParams({ mode: m })}
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
        {mode === "connect" && (
          <> — Position {pair} ({shapeOf(pair)}) into Position {pair + 1} ({shapeOf(pair + 1)}).
          White notes with the gold ring are shared by both: slide through them and the position
          change disappears. Shapes repeat an octave up, so the whole neck is shown.</>
        )}
        {mode === "map" && <> — all five positions across the full neck. Roots are white.</>}
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
              title={`Position ${b} — ${shapeOf(b)}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${visible.has(b) ? "border-transparent text-neutral-950" : "border-neutral-700 text-neutral-500"}`}
              style={visible.has(b) ? { background: BOX_COLORS[b - 1] } : {}}>
              {b} · {shapeOf(b)}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4].map((p) => (
            <button key={p} onClick={() => setParams({ pos: String(p) })}
              title={`${shapeOf(p)} into ${shapeOf(p + 1)}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${pair === p ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-neutral-700 text-neutral-400"}`}>
              {p} ↔ {p + 1}
            </button>
          ))}
          <button onClick={playRun}
            className={`ml-auto rounded-full px-4 py-1.5 text-sm font-bold ${playing ? "border border-neutral-600 text-neutral-200" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"}`}>
            {playing ? "■ stop" : "▶ hear the crossing"}
          </button>
        </div>
      )}

      <Fretboard notes={notes} maxFret={MAX_FRET} activeNote={activeNote} onNoteClick={flashNote} />

      {/* chords that work over this key + scale */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-neutral-100">
            Chords that work over {root} {SCALE_LABEL[kind]}
          </p>
          <button
            onClick={() => setShuffled(sample(pool, 3))}
            className="text-xs text-neutral-500 hover:text-amber-400"
          >
            shuffle →
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {picks.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
              <p className="text-sm font-bold text-amber-300">{p.name}</p>
              <p className="text-xs text-neutral-500">{p.vibe}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {realize(p, root).map((pc, i) => (
                  <button
                    key={`${pc.numeral}-${i}`}
                    onClick={() => { audioCtx(); strumChord(voicing(pc.chord)); }}
                    title={`${pc.numeral} — tap to hear`}
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-bold text-neutral-200 hover:border-amber-400/60 hover:text-amber-300"
                  >
                    {chordName(pc.chord)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-400">{p.tip}</p>
            </div>
          ))}
          {picks.length === 0 && (
            <p className="text-xs text-neutral-600">
              {PROGRESSIONS.length ? "Loading…" : "No progressions available."}
            </p>
          )}
        </div>
      </section>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="mb-1 font-bold text-neutral-100">The drill</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pick a pair of positions. Play up the lower one, but when you hit a <span className="text-amber-300">pivot note</span> on the G or B string, <em>slide</em> into the upper one and keep going.</li>
          <li>Come back down crossing on a different string.</li>
          <li>Tap any note to hear it. Use “hear the crossing” for the idea, then make your own path — that&apos;s the melody part.</li>
        </ol>
      </div>
    </div>
  );
}
