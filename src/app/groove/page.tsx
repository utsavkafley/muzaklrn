"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Metronome, audioCtx, click, strumNoise } from "@/lib/audio";
import { STRUM_PATTERNS, COUNT_LABELS } from "@/lib/strums";
import { logPractice, takePendingSong } from "@/lib/store";
import TipCard from "@/components/TipCard";

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
    logPractice("groove");
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

  const toggle = () => {
    if (running) {
      m.stop();
      setRunning(false);
      setPos(-1);
    } else {
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
  const grade =
    meanAbs === null ? null :
    meanAbs < 20 ? "locked in 🔒" :
    meanAbs < 40 ? "solid — tighten up" :
    meanAbs < 70 ? "getting there" : "slow the tempo down";

  const beatsRow = COUNT_LABELS[tab === "strum" ? 2 : subs] ?? COUNT_LABELS[1];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-400">Groove</h1>
        <p className="text-sm text-neutral-400">Count it in your head. Tap it with your foot. Then make the guitar do it.</p>
      </header>

      {song && (
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-900/20 p-4 text-sm">
          <p className="font-bold text-emerald-300">Find the tempo of “{song.song}” — {song.artist}</p>
          <p className="mt-1 text-neutral-300">
            Play it in Spotify, then hit <em>tap tempo</em> below on every beat until the BPM settles. Then start the metronome and strum along.
          </p>
        </div>
      )}

      {/* tab switcher */}
      <div className="flex overflow-hidden rounded-xl border border-neutral-800 text-sm">
        {(["metronome", "tap", "strum"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 capitalize ${tab === t ? "bg-amber-400/15 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
            {t === "tap" ? "tap trainer" : t === "strum" ? "strumming" : t}
          </button>
        ))}
      </div>

      {/* BPM control */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setBpm((b) => Math.max(30, b - 5))}
            className="h-12 w-12 rounded-full border border-neutral-700 text-xl">−</button>
          <div className="text-center">
            <div className="text-5xl font-bold tabular-nums text-neutral-50">{bpm}</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">bpm</div>
          </div>
          <button onClick={() => setBpm((b) => Math.min(240, b + 5))}
            className="h-12 w-12 rounded-full border border-neutral-700 text-xl">+</button>
        </div>
        <input type="range" min={30} max={240} value={bpm}
          onChange={(e) => setBpm(+e.target.value)}
          className="mt-3 w-full accent-amber-400" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={toggle}
            className={`rounded-full px-6 py-2.5 font-bold ${running ? "bg-neutral-200 text-neutral-950" : "bg-amber-400 text-neutral-950 hover:bg-amber-300"}`}>
            {running ? "■ stop" : "▶ start"}
          </button>
          <button onClick={tapTempo}
            className="rounded-full border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300">
            tap tempo{song?.bpm ? ` (song ≈ ${song.bpm})` : ""}
          </button>
          {tab === "metronome" && (
            <div className="ml-auto flex overflow-hidden rounded-lg border border-neutral-700 text-xs">
              {[{ v: 1, l: "♩" }, { v: 2, l: "♪♪" }, { v: 3, l: "3s" }, { v: 4, l: "16s" }].map((o) => (
                <button key={o.v} onClick={() => setSubs(o.v)}
                  className={`px-3 py-2 ${subs === o.v ? "bg-amber-400/20 text-amber-300" : "bg-neutral-900 text-neutral-400"}`}>
                  {o.l}
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
                      ? "scale-105 bg-neutral-200 text-neutral-950"
                      : "scale-105 bg-neutral-500 text-neutral-950"
                  : /^[1-4]$/.test(label)
                    ? "bg-neutral-800 text-neutral-300"
                    : "bg-neutral-900 text-neutral-600"
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
            className="h-44 w-full rounded-3xl border-2 border-dashed border-neutral-700 text-xl font-bold text-neutral-400 active:border-amber-400 active:bg-amber-400/10 active:text-amber-300 disabled:opacity-40">
            {running ? "TAP ON EVERY BEAT" : "start the metronome first"}
            {lastOffset !== null && (
              <div className={`mt-2 text-3xl tabular-nums ${Math.abs(lastOffset) < 25 ? "text-emerald-400" : Math.abs(lastOffset) < 60 ? "text-amber-400" : "text-red-400"}`}>
                {lastOffset > 0 ? "+" : ""}{Math.round(lastOffset)} ms
              </div>
            )}
          </button>
          {meanAbs !== null && meanSigned !== null && taps.length >= 4 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">last {taps.length} taps</span>
                <span className="font-bold text-amber-300">{grade}</span>
              </div>
              <p className="mt-1 text-neutral-300">
                avg miss <b className="tabular-nums">{Math.round(meanAbs)} ms</b> · tendency:{" "}
                <b>{meanSigned > 12 ? "dragging (late)" : meanSigned < -12 ? "rushing (early)" : "centered"}</b>
              </p>
              {/* dot strip */}
              <div className="relative mt-3 h-8 rounded bg-neutral-800">
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
              <p className="mt-2 text-xs text-neutral-500">early ← center = perfect → late</p>
            </div>
          )}
          <p className="text-sm text-neutral-400">
            Tap the pad (or spacebar) on every click. Under 20 ms average and you can trust your foot on stage. Pro move: mute the click every other bar and stay locked.
          </p>
          <button onClick={() => setMuteClick((v) => !v)}
            className={`rounded-full border px-4 py-2 text-sm ${muteClick ? "border-amber-400 text-amber-300" : "border-neutral-700 text-neutral-400"}`}>
            {muteClick ? "subdivisions muted — beats only" : "mute subdivisions"}
          </button>
        </div>
      )}

      {tab === "strum" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STRUM_PATTERNS.map((p) => (
              <button key={p.id} onClick={() => setPatternId(p.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${patternId === p.id ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-neutral-700 text-neutral-400"}`}>
                {p.name} {"·".repeat(p.level)}
              </button>
            ))}
          </div>

          {/* pattern arrows on the 8th grid */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex gap-1.5">
              {pattern.slots.map((slot, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`flex h-16 w-full items-center justify-center rounded-lg text-2xl font-bold transition-all duration-75 ${
                      running && pos === i ? "bg-amber-400 text-neutral-950" :
                      slot.stroke ? "bg-neutral-800 text-neutral-100" : "bg-neutral-900 text-neutral-700"
                    } ${slot.accent && !(running && pos === i) ? "ring-2 ring-amber-400/60" : ""}`}>
                    {slot.stroke === "D" ? "↓" : slot.stroke === "U" ? "↑" : "·"}
                  </div>
                  <span className="text-xs text-neutral-500">{COUNT_LABELS[2][i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-neutral-300">{pattern.hint}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Ringed slots are accents — dig in. Your arm moves on every slot, even the dots. Downstrokes sound fuller, ups lighter: that&apos;s the built-in dynamics.
            </p>
          </div>
        </div>
      )}

      {tab === "metronome" && (
        <p className="text-sm text-neutral-400">
          Daily dose: 2 minutes at 60 BPM just counting out loud, foot on the beats. Then switch to ♪♪ and say “1 & 2 &…” — the & is where your upstrums live.
        </p>
      )}

      <TipCard room="groove" ctx={{ root: "A", kind: "minorPent" }} label="Rhythm tip" />
    </div>
  );
}
