"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Metronome, audioCtx, click, strumNoise } from "@/lib/audio";
import { STRUM_PATTERNS, COUNT_LABELS, patternGlyphs } from "@/lib/strums";
import { logDrill, takePendingSong, tempoFor } from "@/lib/store";

type Tab = "metronome" | "tap" | "strum";

interface TapStat {
  offset: number; // ms, signed (+ = late)
}

export default function GroovePage() {
  const met = useRef<Metronome | null>(null);
  if (!met.current) met.current = new Metronome();
  const m = met.current;

  const [tab, setTab] = useState<Tab>("metronome");
  const [bpm, setBpm] = useState(90);
  const [logged, setLogged] = useState<{ ms: number; delta: number } | null>(null);
  const [subs, setSubs] = useState(1);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState(-1); // current sub within bar for UI
  const [muteClick, setMuteClick] = useState(false);

  // tap trainer
  const [taps, setTaps] = useState<TapStat[]>([]);
  const [lastOffset, setLastOffset] = useState<number | null>(null);

  // tap tempo
  const tapTimes = useRef<number[]>([]);
  const [song, setSong] = useState<{ song: string; artist: string; bpm?: number } | null>(null);

  // strum
  const [patternId, setPatternId] = useState(STRUM_PATTERNS[1].id);
  const pattern = useMemo(() => STRUM_PATTERNS.find((p) => p.id === patternId)!, [patternId]);

  const stateRef = useRef({ tab, muteClick, pattern });
  stateRef.current = { tab, muteClick, pattern };

  useEffect(() => {
    // No logging on mount — opening a page is not practice. The Clock drill
    // logs itself when a scored run ends, further down in `toggle`.
    setBpm(tempoFor("clock"));
    // Read the deep link straight off the URL rather than via useSearchParams,
    // which would force a Suspense boundary on this prerendered route.
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "tap" || t === "strum" || t === "metronome") setTab(t);
    const pending = takePendingSong();
    if (pending) setSong(pending); // guard: StrictMode runs effects twice and the take is destructive
    return () => m.stop();
  }, [m]);

  useEffect(() => { m.bpm = bpm; }, [bpm, m]);
  useEffect(() => { m.subsPerBeat = subs; }, [subs, m]);

  m.onTick = (t) => {
    const { tab: tb, muteClick: mc, pattern: pat } = stateRef.current;
    const isBeat = t.sub % t.subsPerBeat === 0;
    const beat = Math.floor(t.sub / t.subsPerBeat);
    if (tb === "strum") {
      // strum tab always runs on 8ths grid
      const slot = pat.slots[t.sub % 8];
      if (slot?.stroke) strumNoise(t.when, slot.stroke === "U", slot.accent);
      if (isBeat && !mc) click(t.when, beat === 0, 0.5);
    } else {
      if (!mc || isBeat) click(t.when, t.sub === 0, isBeat ? 1 : 0.45);
    }
    const delay = Math.max(0, (t.when - audioCtx().currentTime) * 1000);
    setTimeout(() => setPos(t.sub), delay);
  };

  const PASS_MS = 25; // the Stage 1 gate
  const MIN_TAPS = 8; // below this it isn't a measurement

  const toggle = () => {
    if (running) {
      m.stop();
      setRunning(false);
      setPos(-1);
      // A completed run is the only thing that counts as practice.
      if (tab === "tap" && taps.length >= MIN_TAPS) {
        const ms = taps.reduce((a, t) => a + Math.abs(t.offset), 0) / taps.length;
        const { tempoChanged } = logDrill({
          drill: "clock", value: Math.round(ms), unit: "ms",
          tempo: bpm, passed: ms < PASS_MS,
        });
        setLogged({ ms: Math.round(ms), delta: tempoChanged });
      }
    } else {
      setLogged(null);
      audioCtx();
      m.subsPerBeat = tab === "strum" ? 2 : subs;
      m.start();
      setRunning(true);
      setTaps([]);
      setLastOffset(null);
    }
  };

  // switching tabs restarts subdivision appropriately
  useEffect(() => {
    m.subsPerBeat = tab === "strum" ? 2 : subs;
  }, [tab, subs, m]);

  const registerTap = () => {
    if (!running) return;
    const off = m.tapOffset(audioCtx().currentTime);
    if (off === null || Math.abs(off) > 250) return;
    setLastOffset(off);
    setTaps((ts) => [...ts.slice(-15), { offset: off }]);
  };

  // spacebar taps too
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" && stateRef.current.tab === "tap") {
        e.preventDefault();
        registerTap();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const tapTempo = () => {
    const now = performance.now();
    const ts = tapTimes.current.filter((t) => now - t < 3000);
    ts.push(now);
    tapTimes.current = ts;
    if (ts.length >= 3) {
      const gaps = ts.slice(1).map((t, i) => t - ts[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(Math.max(30, Math.min(240, Math.round(60000 / avg))));
    }
  };

  const meanAbs = taps.length ? taps.reduce((a, t) => a + Math.abs(t.offset), 0) / taps.length : null;
  const meanSigned = taps.length ? taps.reduce((a, t) => a + t.offset, 0) / taps.length : null;

  const beatsRow = COUNT_LABELS[tab === "strum" ? 2 : subs] ?? COUNT_LABELS[1];

  return (
    <div className="space-y-5">
      <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Groove</h1>

      {song && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-700">
            {song.song} <span className="font-normal text-neutral-500">— {song.artist}</span>
          </p>
        </div>
      )}

      {/* tab switcher */}
      <div className="flex overflow-hidden rounded-xl border border-neutral-200 text-sm">
        {(["metronome", "tap", "strum"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-label={t}
            className={`flex-1 py-2.5 text-lg ${tab === t ? "bg-amber-400/15 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
            {t === "tap" ? "◎" : t === "strum" ? "↓↑" : "♩"}
          </button>
        ))}
      </div>

      {/* BPM control */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setBpm((b) => Math.max(30, b - 5))}
            className="h-12 w-12 rounded-full border border-neutral-300 text-xl">−</button>
          <div className="text-center">
            <div className="text-5xl font-bold tabular-nums text-neutral-950">{bpm}</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">bpm</div>
          </div>
          <button onClick={() => setBpm((b) => Math.min(240, b + 5))}
            className="h-12 w-12 rounded-full border border-neutral-300 text-xl">+</button>
        </div>
        <input type="range" min={30} max={240} value={bpm}
          onChange={(e) => setBpm(+e.target.value)}
          style={{ "--fill": `${((bpm - 30) / 210) * 100}%` } as React.CSSProperties}
          className="mt-3 w-full" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={toggle} aria-label="play"
            className={`h-12 w-12 rounded-full text-xl font-bold ${running ? "bg-neutral-900 text-neutral-50" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"}`}>
            {running ? "■" : "▶"}
          </button>
          {/* Tap this in time with a track and it sets the BPM from your taps. */}
          <button onClick={tapTempo} aria-label="tap tempo"
            className="h-12 rounded-full border border-neutral-300 px-4 text-base tabular-nums text-neutral-700">
            ◎{song?.bpm ? <span className="ml-1.5 text-sm text-neutral-500">{song.bpm}</span> : null}
          </button>
          {tab === "metronome" && (
            <div className="ml-auto flex overflow-hidden rounded-lg border border-neutral-300 text-xs">
              {[1, 2, 3, 4].map((v) => (
                <button key={v} onClick={() => setSubs(v)}
                  className={`px-3 py-2 tabular-nums ${subs === v ? "bg-amber-400/20 text-amber-700" : "bg-neutral-100 text-neutral-600"}`}>
                  <span aria-hidden>×</span>{v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* count display */}
        <div className="mt-4 flex gap-1.5">
          {beatsRow.map((label, i) => (
            <div key={i}
              className={`flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-bold transition-all duration-75 ${
                running && pos === i
                  ? label === "1" || (i === 0)
                    ? "scale-105 bg-amber-400 text-neutral-950"
                    : /^[1-4]$/.test(label)
                      ? "scale-105 bg-neutral-900 text-neutral-50"
                      : "scale-105 bg-neutral-500 text-neutral-50"
                  : /^[1-4]$/.test(label)
                    ? "bg-neutral-200 text-neutral-700"
                    : "bg-neutral-100 text-neutral-400"
              }`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {tab === "tap" && (
        <div className="space-y-3">
          <button
            onPointerDown={registerTap}
            disabled={!running}
            className="h-44 w-full rounded-3xl border-2 border-dashed border-neutral-300 text-xl font-bold text-neutral-600 active:border-amber-400 active:bg-amber-400/10 active:text-amber-700 disabled:opacity-40">
            <span aria-label="tap" className={running ? "text-4xl" : "text-4xl opacity-40"}>◎</span>
            {lastOffset !== null && (
              <div className={`mt-2 text-3xl tabular-nums ${Math.abs(lastOffset) < 25 ? "text-emerald-700" : Math.abs(lastOffset) < 60 ? "text-amber-700" : "text-red-700"}`}>
                {lastOffset > 0 ? "+" : ""}{Math.round(lastOffset)} ms
              </div>
            )}
          </button>
          {logged && (
            <div className={`rounded-2xl border p-4 text-sm ${logged.ms < 25 ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-neutral-100/50"}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 tabular-nums">
                <span className={`text-3xl font-bold ${logged.ms < 25 ? "text-emerald-700" : "text-neutral-900"}`}>
                  {logged.ms}<span className="ml-1 text-base font-normal text-neutral-500">ms</span>
                </span>
                <span className="text-neutral-700">
                  {bpm + logged.delta}
                  <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
                  <span aria-hidden className={`ml-1 ${logged.delta > 0 ? "text-emerald-700" : logged.delta < 0 ? "text-amber-700" : "text-neutral-400"}`}>
                    {logged.delta > 0 ? "↑" : logged.delta < 0 ? "↓" : "="}
                  </span>
                </span>
              </div>
            </div>
          )}
          {meanAbs !== null && meanSigned !== null && taps.length >= 4 && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4 text-sm">
              <div className="flex items-baseline justify-between tabular-nums">
                <span className="text-neutral-500">{taps.length}<span aria-hidden>×</span></span>
                {/* Signed mean: negative is early, positive is late. */}
                <span className="font-bold text-neutral-900">
                  {meanSigned > 0 ? "+" : ""}{Math.round(meanSigned)}
                  <span className="ml-1 font-normal text-neutral-500">ms</span>
                </span>
              </div>
              {/* dot strip */}
              <div className="relative mt-3 h-8 rounded bg-neutral-200">
                <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-500" />
                {taps.map((t, i) => (
                  <div key={i}
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${50 + Math.max(-48, Math.min(48, t.offset / 2.5))}%`,
                      background: Math.abs(t.offset) < 25 ? "#34d399" : Math.abs(t.offset) < 60 ? "#fbbf24" : "#f87171",
                      opacity: 0.35 + (0.65 * i) / taps.length,
                    }} />
                ))}
              </div>
              <p aria-hidden className="mt-2 flex justify-between text-xs text-neutral-400"><span>←</span><span>·</span><span>→</span></p>
            </div>
          )}
          <button onClick={() => setMuteClick((v) => !v)}
            className={`rounded-full border px-4 py-2 text-base ${muteClick ? "border-amber-400 text-amber-700" : "border-neutral-300 text-neutral-600"}`}>
            <span aria-label="mute subdivisions">{muteClick ? "♩" : "♩♪"}</span>
          </button>
        </div>
      )}

      {tab === "strum" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STRUM_PATTERNS.map((p) => (
              <button key={p.id} onClick={() => setPatternId(p.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${patternId === p.id ? "border-amber-400 bg-amber-400/15 text-amber-700" : "border-neutral-300 text-neutral-600"}`}>
                <span className="tracking-tight">{patternGlyphs(p).join("")}</span>
                <span className="ml-2 text-xs text-neutral-400">{"·".repeat(p.level)}</span>
              </button>
            ))}
          </div>

          {/* pattern arrows on the 8th grid */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4">
            <div className="flex gap-1.5">
              {pattern.slots.map((slot, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`flex h-16 w-full items-center justify-center rounded-lg text-2xl font-bold transition-all duration-75 ${
                      running && pos === i ? "bg-amber-400 text-neutral-950" :
                      slot.stroke ? "bg-neutral-200 text-neutral-900" : "bg-neutral-100 text-neutral-300"
                    } ${slot.accent && !(running && pos === i) ? "ring-2 ring-amber-400/60" : ""}`}>
                    {slot.stroke === "D" ? "↓" : slot.stroke === "U" ? "↑" : "·"}
                  </div>
                  <span className="text-xs text-neutral-500">{COUNT_LABELS[2][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
