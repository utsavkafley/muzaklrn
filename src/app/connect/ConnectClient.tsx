"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Fretboard, { FbNote } from "@/components/Fretboard";
import {
  NOTES, NoteName, ScaleKind, SCALE_LABEL, POSITION_SHAPE, BoxNote, pentatonicBoxes,
  noteAt, midiAt, chordName, chordTonePcs, noteIndex, Chord,
} from "@/lib/theory";
import { PROGRESSIONS, Progression, progressionsFor, realize, sample } from "@/lib/progressions";
import { pluck, strumChord, click, audioCtx, Metronome, Voice } from "@/lib/audio";
import { DRILL_BASE_BPM, logDrill, subscribe, tempoFor } from "@/lib/store";
import TipCard from "@/components/TipCard";

const BOX_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#c084fc"]; // position 1..5
const MAX_FRET = 22;
const NOTE_SEC = 0.55;

/** Strings the crossing gets called on — D, G and B, where the shared notes fall usefully. */
const CROSS_STRINGS = [2, 3, 4] as const;
const STRING_NAME = ["low E", "A", "D", "G", "B", "high E"];

const REPS = 5;
const PASS_PCT = 80;

type Mode = "map" | "connect";
type Phase = "idle" | "showing" | "playing" | "marking" | "done";

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

  const keyParam = sp.get("key");
  const root: NoteName = (NOTES as readonly string[]).includes(keyParam ?? "")
    ? (keyParam as NoteName)
    : "A";
  const kind: ScaleKind = sp.get("scale") === "major" ? "majorPent" : "minorPent";
  const mode: Mode = sp.get("mode") === "map" ? "map" : "connect";
  const pair = Math.min(5, Math.max(1, Number(sp.get("pos")) || 1));
  /**
   * Position 5 hands off to position 1 again — the numbering wraps, so this is
   * the seam most players never drill even though it's the next shape up.
   */
  const upper = pair === 5 ? 1 : pair + 1;

  const [visible, setVisible] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [labelDegrees, setLabelDegrees] = useState(false);
  const [activeNote, setActiveNote] = useState<{ string: number; fret: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shuffled, setShuffled] = useState<Progression[] | null>(null);

  // --- scored drill ---
  const [phase, setPhase] = useState<Phase>("idle");
  const [rep, setRep] = useState(0);
  const [hits, setHits] = useState(0);
  const [prompt, setPrompt] = useState<{ crossString: number; target: BoxNote } | null>(null);
  const [outcome, setOutcome] = useState<{ pct: number; delta: number; hits: number } | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voices = useRef<Voice[]>([]);
  // The metronome is mutable, so it lives in a ref — and is only ever reached
  // through getMet(), which is called from effects and handlers, never render.
  const metRef = useRef<Metronome | null>(null);
  const getMet = useCallback(() => {
    if (!metRef.current) metRef.current = new Metronome();
    return metRef.current;
  }, []);

  // The drill's tempo comes from the ladder, never from the student. Derived
  // from the store so it needs no effect and no client/server mismatch.
  const bpm = useSyncExternalStore(
    subscribe,
    () => tempoFor("seam"),
    () => DRILL_BASE_BPM.seam,
  );

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
    setPlaying(false);
  }, [getMet]);

  const abortDrill = useCallback(() => {
    stopAll();
    setPhase("idle");
    setPrompt(null);
    setRep(0);
    setHits(0);
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

  const pool = useMemo(() => progressionsFor(kind), [kind]);
  const picks = useMemo(() => {
    if (shuffled && shuffled.every((p) => pool.includes(p))) return shuffled;
    if (!pool.length) return [];
    const off = (noteIndex(root) + (kind === "minorPent" ? 0 : 5)) % pool.length;
    return [0, 1, 2].map((i) => pool[(off + i) % pool.length]).filter(Boolean);
  }, [pool, shuffled, root, kind]);

  const boxes = useMemo(() => pentatonicBoxes(root, kind, MAX_FRET), [root, kind]);

  /**
   * One occurrence of a position. Shapes repeat every octave, so `after` picks
   * the occurrence sitting above a given fret rather than the lowest — which is
   * what makes 5↔1 resolve to the octave above instead of dropping below.
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

  /** The two shapes of the selected seam, and the notes they share. */
  const seam = useMemo(() => {
    const lower = cycle(pair);
    if (!lower.length) return { lower, upper: [] as BoxNote[], pivots: [] as BoxNote[] };
    const lowerLo = Math.min(...lower.map((n) => n.fret));
    const up = cycle(upper, lowerLo);
    const pivots = lower.filter((n) => up.some((u) => u.string === n.string && u.fret === n.fret));
    return { lower, upper: up, pivots };
  }, [cycle, pair, upper]);

  const inSeam = useCallback(
    (n: { string: number; fret: number }) =>
      seam.lower.some((x) => x.string === n.string && x.fret === n.fret) ||
      seam.upper.some((x) => x.string === n.string && x.fret === n.fret),
    [seam],
  );

  const isPivot = useCallback(
    (n: { string: number; fret: number }) =>
      seam.pivots.some((p) => p.string === n.string && p.fret === n.fret),
    [seam],
  );

  /** Once you're playing, the route is hidden — remembering it is the drill. */
  const routeHidden = phase === "playing" || phase === "marking";

  const notes: FbNote[] = useMemo(() => {
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
          fill: n.isRoot ? "#18181b" : BOX_COLORS[(n.box - 1) % 5],
        }));
    }

    const byPos = new Map<string, BoxNote>();
    for (const n of boxes) {
      const k = `${n.string}:${n.fret}`;
      const cur = byPos.get(k);
      if (!cur || (inSeam(n) && !inSeam(cur))) byPos.set(k, n);
    }
    return [...byPos.values()].map((n) => {
      const here = inSeam(n);
      const piv = isPivot(n);
      const isTarget = !!prompt && prompt.target.string === n.string && prompt.target.fret === n.fret;
      const reveal = !routeHidden;
      return {
        string: n.string,
        fret: n.fret,
        label: labelDegrees ? n.degree : noteAt(n.pc),
        fill:
          isTarget && reveal ? "#18181b"
          : piv && reveal ? "#18181b"
          : n.isRoot ? "#e11d48"
          : BOX_COLORS[(n.box - 1) % 5],
        ring: isTarget && reveal ? "#34d399" : piv && reveal ? "#fbbf24" : undefined,
        dim: routeHidden ? true : !here,
      };
    });
  }, [boxes, mode, visible, labelDegrees, inSeam, isPivot, prompt, routeHidden]);

  const flashNote = (n: { string: number; fret: number }) => {
    setActiveNote(n);
    timers.current.push(setTimeout(() => setActiveNote(null), 320));
  };

  // ---------- demo run ----------
  const playRun = () => {
    if (playing) { stopAll(); return; }
    const ac = audioCtx();
    const { lower, upper: up } = seam;
    if (!lower.length) return;

    const seq: { string: number; fret: number }[] = [];
    for (let s = 0; s < 6; s++) {
      const fr = lower.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
      const frB = up.filter((n) => n.string === s).map((n) => n.fret).sort((x, y) => x - y);
      if (s <= 2) fr.forEach((f) => seq.push({ string: s, fret: f }));
      else if (s === 3) {
        fr.forEach((f) => seq.push({ string: s, fret: f }));
        frB.filter((f) => f > (fr.at(-1) ?? 0)).forEach((f) => seq.push({ string: s, fret: f }));
      } else frB.forEach((f) => seq.push({ string: s, fret: f }));
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
    timers.current.push(
      setTimeout(
        () => { setActiveNote(null); setPlaying(false); },
        Math.max(0, (t0 + seq.length * NOTE_SEC - ac.currentTime) * 1000),
      ),
    );
  };

  // ---------- the scored drill ----------
  const newPrompt = useCallback(() => {
    const strings = CROSS_STRINGS.filter((s) => seam.pivots.some((p) => p.string === s));
    const choices = strings.length ? strings : [...CROSS_STRINGS];
    const crossString = choices[Math.floor(Math.random() * choices.length)];
    const landings = seam.upper.length ? seam.upper : seam.lower;
    if (!landings.length) return null;
    const target = landings[Math.floor(Math.random() * landings.length)];
    return { crossString, target };
  }, [seam]);

  // The metronome is the drill's clock and only ever clicks.
  useEffect(() => {
    const met = getMet();
    met.onTick = (t) => { click(t.when, t.sub === 0, 0.5); };
    return () => { met.onTick = null; };
  }, [getMet]);

  const startRep = useCallback(
    (n: number) => {
      const p = newPrompt();
      if (!p) return;
      clearTimers();
      setPrompt(p);
      setRep(n);
      setPhase("showing");

      audioCtx();
      const met = getMet();
      met.bpm = bpm;
      met.beatsPerBar = 4;
      met.subsPerBeat = 1;
      met.start();

      const barMs = (60 / bpm) * 4 * 1000;
      // One bar to memorise the route, two to play it, then you mark it.
      timers.current.push(setTimeout(() => setPhase("playing"), barMs));
      timers.current.push(setTimeout(() => { met.stop(); setPhase("marking"); }, barMs * 3));
    },
    [newPrompt, bpm, getMet],
  );

  const startDrill = () => {
    setHits(0);
    setOutcome(null);
    startRep(1);
  };

  const mark = (landed: boolean) => {
    clearTimers();
    const nextHits = hits + (landed ? 1 : 0);
    setHits(nextHits);
    if (rep >= REPS) {
      const pct = Math.round((nextHits / REPS) * 100);
      const { tempoChanged } = logDrill({
        drill: "seam", value: pct, unit: "pct", tempo: bpm, passed: pct >= PASS_PCT,
      });
      setOutcome({ pct, delta: tempoChanged, hits: nextHits });
      setPhase("done");
      setPrompt(null);
    } else {
      startRep(rep + 1);
    }
  };

  const shapeOf = (box: number) => POSITION_SHAPE[kind][(box - 1) % 5];
  const scaleWord = kind === "minorPent" ? "minor" : "major";
  const drillRunning = phase !== "idle" && phase !== "done";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Connect</h1>
        <p className="text-sm text-neutral-600">
          You know all five positions. The neck is one scale — these are the seams.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select value={root} onChange={(e) => setParams({ key: e.target.value })}
          className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-neutral-300 text-sm">
          {(["minor", "major"] as const).map((k) => (
            <button key={k} onClick={() => setParams({ scale: k })}
              className={`px-3 py-2 ${scaleWord === k ? "bg-amber-400/20 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-neutral-300 text-sm">
          {(["map", "connect"] as Mode[]).map((md) => (
            <button key={md} onClick={() => setParams({ mode: md })}
              className={`px-3 py-2 ${mode === md ? "bg-amber-400/20 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
              {md === "map" ? "full map" : "connect"}
            </button>
          ))}
        </div>
        <button onClick={() => setLabelDegrees((v) => !v)}
          className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
          {labelDegrees ? "showing degrees" : "showing notes"}
        </button>
      </div>

      <p className="text-sm text-neutral-700">
        <span className="text-amber-700">{root} {SCALE_LABEL[kind]}</span>
        {mode === "connect" && (
          <> — Position {pair} ({shapeOf(pair)}) into Position {upper} ({shapeOf(upper)})
          {pair === 5 && <span className="text-amber-700/80"> — the wrap, where the numbering starts over</span>}. Gold-ringed white
          notes are shared by both: slide through them and the position change disappears.</>
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
              className={`rounded-full border px-3 py-1.5 text-sm ${visible.has(b) ? "border-transparent text-neutral-950" : "border-neutral-300 text-neutral-500"}`}
              style={visible.has(b) ? { background: BOX_COLORS[b - 1] } : {}}>
              {b} · {shapeOf(b)}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} onClick={() => setParams({ pos: String(p) })} disabled={drillRunning}
              title={`${shapeOf(p)} into ${shapeOf(p === 5 ? 1 : p + 1)}`}
              className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${pair === p ? "border-amber-400 bg-amber-400/15 text-amber-700" : "border-neutral-300 text-neutral-600"}`}>
              {p} ↔ {p === 5 ? "1" : p + 1}{p === 5 && <span className="text-xs text-neutral-500"> wrap</span>}
            </button>
          ))}
          <button onClick={playRun} disabled={drillRunning}
            className={`ml-auto rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-40 ${playing ? "border border-neutral-400 text-neutral-800" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"}`}>
            {playing ? "■ stop" : "▶ hear the crossing"}
          </button>
        </div>
      )}

      {mode === "connect" && (
        <section className={`rounded-2xl border p-4 ${drillRunning ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-neutral-200 bg-neutral-100/50"}`}>
          {phase === "idle" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-neutral-900">Seam drill</p>
                  <p className="text-sm text-neutral-600">
                    {REPS} crossings at {bpm} BPM. The route shows for one bar, then hides — you play it from memory.
                  </p>
                </div>
                <button onClick={startDrill}
                  className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-neutral-950 hover:bg-amber-300">
                  Start drill →
                </button>
              </div>
              <p className="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
                You mark your own hits for now — the app can&apos;t hear you yet. Be honest; the
                tempo ladder is only as useful as what you tell it.
              </p>
            </>
          )}

          {drillRunning && prompt && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Rep {rep} of {REPS} · {bpm} BPM
                </p>
                <button onClick={abortDrill} className="text-xs text-neutral-500 hover:text-neutral-700">
                  stop
                </button>
              </div>
              <p className="mt-2 text-lg font-bold text-neutral-950">
                Position {pair} → {upper}, cross on the {STRING_NAME[prompt.crossString]} string.
              </p>
              <p className="mt-1 text-neutral-700">
                Land on <b className="text-emerald-700">{noteAt(prompt.target.pc)}</b>{" "}
                (fret {prompt.target.fret}, {STRING_NAME[prompt.target.string]}) on beat 1 of bar 2.
              </p>
              <p className="mt-2 text-sm text-amber-700/90">
                {phase === "showing" ? "Route shown — memorise it." : "Route hidden. Play it."}
              </p>
              {phase === "marking" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => mark(true)}
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-neutral-950 hover:bg-emerald-400">
                    Landed it
                  </button>
                  <button onClick={() => mark(false)}
                    className="rounded-full border border-neutral-400 px-5 py-2 text-sm text-neutral-800 hover:border-neutral-600">
                    Missed
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "done" && outcome && (
            <div>
              <p className="text-lg font-bold text-neutral-950">
                {outcome.pct}% — {outcome.hits} of {REPS} landed at {bpm} BPM.
              </p>
              <p className="mt-1 text-neutral-700">
                {outcome.delta > 0
                  ? `Two clean runs in a row. Next session goes to ${bpm + outcome.delta} BPM.`
                  : outcome.delta < 0
                    ? `Dropping to ${bpm + outcome.delta} BPM next session — slowing down is the drill working.`
                    : outcome.pct >= PASS_PCT
                      ? `Cleared ${PASS_PCT}%. Hold it once more and the tempo goes up.`
                      : `${PASS_PCT}% is the bar. Stay at this tempo until the seam is automatic.`}
              </p>
              <button onClick={() => { setPhase("idle"); setOutcome(null); }}
                className="mt-3 rounded-full border border-neutral-400 px-5 py-2 text-sm text-neutral-800 hover:border-neutral-600">
                Again
              </button>
            </div>
          )}
        </section>
      )}

      <Fretboard notes={notes} maxFret={MAX_FRET} activeNote={activeNote} onNoteClick={flashNote} />

      <section className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-neutral-900">
            Chords that work over {root} {SCALE_LABEL[kind]}
          </p>
          <button onClick={() => setShuffled(sample(pool, 3))}
            className="text-xs text-neutral-500 hover:text-amber-700">
            shuffle →
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {picks.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
              <p className="text-sm font-bold text-amber-700">{p.name}</p>
              <p className="text-xs text-neutral-500">{p.vibe}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {realize(p, root).map((pc, i) => (
                  <button key={`${pc.numeral}-${i}`}
                    onClick={() => { audioCtx(); strumChord(voicing(pc.chord)); }}
                    title={`${pc.numeral} — tap to hear`}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-bold text-neutral-800 hover:border-amber-400/60 hover:text-amber-700">
                    {chordName(pc.chord)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-600">{p.tip}</p>
            </div>
          ))}
          {picks.length === 0 && (
            <p className="text-xs text-neutral-400">
              {PROGRESSIONS.length ? "Loading…" : "No progressions available."}
            </p>
          )}
        </div>
      </section>

      <TipCard room="connect" ctx={{ root, kind, position: pair }} label="Scale tip" />
    </div>
  );
}
