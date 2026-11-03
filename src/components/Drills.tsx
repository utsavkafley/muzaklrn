"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fretboard, { FbNote } from "./Fretboard";
import { HandFrame } from "./HandWindow";
import { Metronome, Voice, audioCtx, click, fretNote, sticks } from "@/lib/audio";
import {
  Direction, Drill, DrillSettings, Layout, METERS, Picking, Sequence, accents, buildDrill, countAt, subsFor,
} from "@/lib/drills";
import { midiAt, pitchAt } from "@/lib/theory";

const INK = "#18181b";
const AMBER = "#f59e0b";
const clampBpm = (n: number) => Math.max(30, Math.min(240, Math.round(n)));

interface Props {
  keyPc: number;
  /** "A Dorian", or the key alone when no mode is picked. */
  title: string;
  /** Semitones above the key in play, the key itself included. */
  scale: number[];
  lo: number;
  span: number;
  fillFor: (string: number, fret: number) => string;
  /** A note's name in the key: its degree. */
  degreeOf: (pc: number) => string;
  /** The page's own tempo, to start from. */
  bpm: number;
  /** Set to this drill's stop, for the page to call when the progression starts: two clicks at once are noise. */
  stopRef: React.RefObject<(() => void) | null>;
  /** This one is starting: the page should stop its own. */
  onStart: () => void;
  /** Set while the drill is on screen, so space plays and pauses it rather than the progression. */
  space: React.RefObject<(() => void) | null>;
}

const LAYOUTS: { value: Layout; label: string; tip: string }[] = [
  { value: "window", label: "in the window", tip: "Every scale note in the frame, one position: the shape you already see on the neck." },
  { value: 2, label: "2 per string", tip: "Two per string: the pentatonic-style stretch, lots of string crossings." },
  { value: 3, label: "3 per string", tip: "Three per string: the same picking motion on every string — built for speed. It runs past the frame." },
  { value: 4, label: "4 per string", tip: "Four per string: long stretches and shifts, a workout for the fretting hand." },
];
const SEQUENCES: { value: Sequence; label: string }[] = [
  { value: "straight", label: "straight" },
  { value: "threes", label: "groups of 3" },
  { value: "fours", label: "groups of 4" },
  { value: "thirds", label: "in 3rds" },
];
const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "up", label: "up" },
  { value: "down", label: "down" },
  { value: "updown", label: "up & down" },
];
const PICKINGS: { value: Picking; label: string; tip: string }[] = [
  { value: "alternate", label: "alternate", tip: "Strict down-up, even across strings: the steadiest time. Listen: downstrokes come out a little brighter and louder than upstrokes — make them match." },
  { value: "economy", label: "economy", tip: "Alternate on a string, then sweep onto the next in the direction the pick is already moving. Listen: two strokes the same way in a row at each string change — the sweep should sound as even as the rest." },
  { value: "legato", label: "legato", tip: "Pick the first note on each string; hammer on and pull off the rest. The fretting hand does the work. Listen: only the first note on a string has a pick attack — the rest are softer and rounder and run into each other, so hammer hard enough to keep them level." },
];
const SUB_NAMES: Record<string, string> = { "4-1": "♩", "4-2": "♫ 8ths", "4-3": "triplets", "4-4": "16ths", "8-1": "♪", "8-2": "16ths" };
const BUMPS = [0, 2, 5];

/** Settings with some changed. A meter that can't hold this many notes a beat takes the nearest it can. */
function merged(s: DrillSettings, p: Partial<DrillSettings>): DrillSettings {
  const next = { ...s, ...p };
  const ok = subsFor(next.meter);
  if (!ok.includes(next.subs)) next.subs = Math.min(...ok.filter((x) => x >= Math.min(next.subs, 2)));
  return next;
}

function Pills<T extends string | number>({ options, value, onPick }: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onPick(o.value)} aria-pressed={value === o.value}
          className={`rounded-full px-3 py-1 transition-colors ${
            value === o.value ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-20 shrink-0 text-xs font-bold tracking-wide text-neutral-400 uppercase">{label}</span>
      {children}
    </div>
  );
}

/**
 * The practice area: the key's notes in the hand window as a dexterity
 * drill — laid out across the strings, sequenced, picked a set way, in a
 * set meter — written as tab and played against its own click. Change any
 * setting and the tab is rewritten at once, even mid-loop.
 */
export default function Drills({ keyPc, title, scale, lo, span, fillFor, degreeOf, bpm: startBpm, stopRef, onStart, space }: Props) {
  const [settings, setSettings] = useState<DrillSettings>({
    layout: 3, sequence: "straight", direction: "updown", picking: "alternate", meter: METERS[0], subs: 2,
  });
  const set = (p: Partial<DrillSettings>) => {
    setSettings((s) => merged(s, p));
    // A new meter or note rate starts the count again.
    if (playing && (p.meter || p.subs)) start(merged(settings, p));
  };
  const [sound, setSound] = useState(true);
  const [bump, setBump] = useState(0);
  const [bpmText, setBpmText] = useState(String(startBpm));
  const parsed = parseInt(bpmText, 10);
  const bpm = Number.isFinite(parsed) ? clampBpm(parsed) : startBpm;

  const pcs = useMemo(() => scale.map((s) => (keyPc + s) % 12), [scale, keyPc]);
  const drill = useMemo(() => buildDrill(pcs, lo, span, settings), [pcs, lo, span, settings]);

  // ---- the click ----
  const [playing, setPlaying] = useState(false);
  /** The note slot sounding now, and whether we're still counting in. */
  const [at, setAt] = useState<{ slot: number; countIn: boolean } | null>(null);
  const [loops, setLoops] = useState(0);
  const met = useRef<Metronome | null>(null);
  const voices = useRef<Voice[]>([]);
  /** The note sounding on each string. */
  const ringing = useRef<Record<number, Voice>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** What the tick callback plays, kept current while it runs. */
  const now = useRef({ drill, settings, sound, bump });
  useEffect(() => {
    now.current = { drill, settings, sound, bump };
  }, [drill, settings, sound, bump]);

  const stop = () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    ringing.current = {};
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(false);
    setAt(null);
  };

  const start = (s = settings) => {
    if (!drill.notes.length) return;
    onStart();
    if (!met.current) met.current = new Metronome();
    const m = met.current;
    m.stop();
    m.bpm = bpm;
    m.beatsPerBar = s.meter.beats;
    m.subsPerBeat = s.subs;
    setLoops(0);
    // A bar of sticks to count in, then the drill on a loop under the click.
    m.onTick = (t) => {
      const { drill: d, settings: s, sound: snd, bump: b } = now.current;
      const countIn = t.count < d.perBar;
      const onBeat = t.sub % s.subs === 0;
      const beat = Math.floor(t.sub / s.subs);
      if (onBeat) {
        voices.current.push(countIn ? sticks(t.when) : click(t.when, accents(s.meter).includes(beat), accents(s.meter).includes(beat) ? 1 : 0.7));
      }
      let slot = 0;
      if (!countIn && d.notes.length) {
        slot = (t.count - d.perBar) % d.notes.length;
        const n = d.notes[slot];
        if (snd) {
          // One note a string, as under a fretting hand: a new one cuts the last.
          ringing.current[n.string]?.stop(t.when);
          const slurred = n.stroke === "h" || n.stroke === "p";
          const gap = 60 / m.bpm / s.subs;
          // Picked notes are short and separate; slurred ones ring on into the next.
          const v = fretNote(midiAt(n.string, n.fret), t.when, Math.min(slurred ? 1.2 : 0.6, gap * (slurred ? 3 : 1.6)),
            n.stroke, t.sub % s.subs === 0 && accents(s.meter).includes(beat));
          voices.current.push(v);
          ringing.current[n.string] = v;
        }
        // Each time round, a little faster.
        if (slot === 0 && t.count > d.perBar) {
          if (b) m.bpm = clampBpm(m.bpm + b);
          const nb = m.bpm;
          timers.current.push(setTimeout(() => {
            setLoops((x) => x + 1);
            if (b) setBpmText(String(nb));
          }, Math.max(0, (t.when - audioCtx().currentTime) * 1000)));
        }
      }
      if (voices.current.length > 64) voices.current = voices.current.slice(-64);
      const shown = { slot, countIn };
      timers.current.push(setTimeout(() => setAt(shown), Math.max(0, (t.when - audioCtx().currentTime) * 1000)));
      if (timers.current.length > 48) timers.current = timers.current.slice(-48);
    };
    m.start();
    setPlaying(true);
  };

  // Tempo edits land at once; a new meter or note rate restarts the count.
  useEffect(() => {
    if (met.current) met.current.bpm = bpm;
  }, [bpm]);
  useEffect(() => {
    stopRef.current = stop;
  });
  useEffect(() => () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    timers.current.forEach(clearTimeout);
  }, []);

  // Space plays and pauses this drill while it's on screen.
  const toggle = useRef<() => void>(() => {});
  useEffect(() => {
    toggle.current = playing ? stop : () => start();
  });
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      space.current = e.isIntersecting ? () => toggle.current() : null;
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      space.current = null;
    };
  }, [space]);

  // ---- the neck: the drill's notes, the one sounding ringed ----
  const active = playing && at && !at.countIn ? drill.notes[at.slot] : null;
  const maxFret = Math.max(15, ...drill.notes.map((n) => n.fret));
  const dots: FbNote[] = [];
  for (const n of drill.notes) {
    if (dots.some((d) => d.string === n.string && d.fret === n.fret)) continue;
    const pc = pitchAt(n.string, n.fret);
    dots.push({
      string: n.string, fret: n.fret, label: degreeOf(pc), fill: fillFor(n.string, n.fret),
      ring: active && active.string === n.string && active.fret === n.fret ? AMBER : undefined,
    });
  }
  const frets = drill.notes.map((n) => n.fret);
  const tips = [
    LAYOUTS.find((l) => l.value === settings.layout)?.tip,
    PICKINGS.find((p) => p.value === settings.picking)?.tip,
    settings.meter.groups.length > 1 ? `${settings.meter.id} groups as ${settings.meter.groups.join("+")}: the bold counts are accented, in the click and in the note.` : null,
  ];

  return (
    <section ref={box} aria-label="practice" className="w-full scroll-mt-6 space-y-4 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Practice</h2>
          <p className="text-sm text-neutral-500">
            {title} · {drill.notes.length
              ? <>frets {Math.min(...frets)}–{Math.max(...frets)} · {drill.cycle} notes, {drill.bars} bar{drill.bars > 1 ? "s" : ""} of {settings.meter.id}</>
              : "no notes here — pick a mode, or move the frame"}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col items-center text-[11px] text-neutral-400">
            {settings.meter.unit === 8 ? "♪" : "♩"} =
            <input value={bpmText} inputMode="numeric" aria-label="practice bpm" autoComplete="off"
              onChange={(e) => setBpmText(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={() => setBpmText(String(bpm))}
              className="w-12 border-b-2 border-neutral-300 bg-transparent text-center text-xl font-bold tabular-nums text-neutral-900 outline-none! focus:border-amber-500" />
          </label>
          <button onClick={playing ? stop : () => start()} disabled={!drill.notes.length} aria-pressed={playing}
            className={`h-11 rounded-full px-5 text-sm font-bold transition-colors disabled:opacity-30 ${
              playing ? "bg-amber-400 text-neutral-950" : "bg-neutral-800 text-neutral-50 hover:bg-neutral-700"}`}>
            {playing ? (at?.countIn ? "count in…" : "stop") : "play"}
          </button>
        </div>
      </header>

      <div className="space-y-2">
        <Row label="notes"><Pills options={LAYOUTS} value={settings.layout} onPick={(layout) => set({ layout })} /></Row>
        <Row label="sequence"><Pills options={SEQUENCES} value={settings.sequence} onPick={(sequence) => set({ sequence })} /></Row>
        <Row label="direction"><Pills options={DIRECTIONS} value={settings.direction} onPick={(direction) => set({ direction })} /></Row>
        <Row label="picking"><Pills options={PICKINGS} value={settings.picking} onPick={(picking) => set({ picking })} /></Row>
        <Row label="meter">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Pills options={METERS.map((m) => ({ value: m.id, label: m.id }))} value={settings.meter.id}
              onPick={(id) => set({ meter: METERS.find((m) => m.id === id)! })} />
            <span aria-hidden className="h-4 w-px bg-neutral-200" />
            <Pills options={subsFor(settings.meter).map((n) => ({ value: n, label: SUB_NAMES[`${settings.meter.unit}-${n}`] }))}
              value={settings.subs} onPick={(subs) => set({ subs })} />
          </div>
        </Row>
        <Row label="loop">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
            <Pills options={BUMPS.map((b) => ({ value: b, label: b ? `+${b} bpm each time` : "same tempo" }))} value={bump} onPick={setBump} />
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-neutral-800" />
              hear the notes
            </label>
            {playing && loops > 0 && <span className="tabular-nums text-neutral-400">× {loops}</span>}
          </div>
        </Row>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">{tips.filter(Boolean).join(" ")}</p>

      {drill.notes.length > 0 && (
        <>
          <Fretboard notes={dots} maxFret={maxFret} fit
            overlay={(geo) => <HandFrame geo={geo} lo={lo} span={span} />} />
          <Tab drill={drill} settings={settings} active={playing && at && !at.countIn ? at.slot : null} />
        </>
      )}
    </section>
  );
}

/**
 * The drill as tab: six lines, high e on top, a fret number for each note,
 * the pick stroke over it (⊓ down, V up) or an arc for a hammer-on or
 * pull-off, and the count under each beat. The note sounding is lit.
 */
function Tab({ drill, settings, active }: { drill: Drill; settings: DrillSettings; active: number | null }) {
  const W = 1000, LEFT = 30, GAP = 13, TOP = 30, RH = 136;
  const { perBar } = drill;
  const perRow = Math.max(1, Math.min(4, Math.floor((W - LEFT) / (perBar * 44))));
  const rows = Math.ceil(drill.bars / perRow);
  const barW = (W - LEFT) / perRow;
  const slotW = (barW - 14) / perBar;
  const lineY = (s: number) => TOP + (5 - s) * GAP;
  const strong = accents(settings.meter).map((b) => b * settings.subs);
  const place = (i: number) => {
    const bar = Math.floor(i / perBar);
    const row = Math.floor(bar / perRow);
    return { row, x: LEFT + (bar % perRow) * barW + 10 + ((i % perBar) + 0.5) * slotW, y0: row * RH };
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <svg viewBox={`0 0 ${W} ${rows * RH}`} width="100%" className="block">
        {Array.from({ length: rows }, (_, r) => {
          const y0 = r * RH;
          const barsHere = Math.min(perRow, drill.bars - r * perRow);
          const right = LEFT + barsHere * barW;
          return (
            <g key={r}>
              {Array.from({ length: 6 }, (_, s) => (
                <g key={s}>
                  <line x1={LEFT} x2={right} y1={y0 + lineY(s)} y2={y0 + lineY(s)} stroke="#d6d3d1" />
                  <text x={LEFT - 10} y={y0 + lineY(s) + 3.5} fontSize={10} textAnchor="middle" fill="#a8a29e">
                    {"EADGBe"[s]}
                  </text>
                </g>
              ))}
              {Array.from({ length: barsHere + 1 }, (_, b) => (
                <line key={b} x1={LEFT + b * barW} x2={LEFT + b * barW} y1={y0 + lineY(5)} y2={y0 + lineY(0)}
                  stroke={INK} strokeWidth={b === barsHere && r === rows - 1 ? 3 : 1} />
              ))}
            </g>
          );
        })}
        {drill.notes.map((n, i) => {
          const { x, y0 } = place(i);
          const y = y0 + lineY(n.string);
          const on = active === i;
          const slot = i % perBar;
          const prev = drill.notes[i - 1];
          const legato = (n.stroke === "h" || n.stroke === "p") && prev && slot > 0;
          const px = x - slotW;
          return (
            <g key={i}>
              {on && <rect x={x - slotW / 2 + 1} y={y0 + 4} width={slotW - 2} height={RH - 12} rx={6} fill={AMBER} fillOpacity={0.18} />}
              {legato ? (
                <>
                  <path d={`M${px + 4} ${y0 + lineY(prev.string) - 8}Q${(px + x) / 2} ${y0 + lineY(Math.max(prev.string, n.string)) - 20} ${x - 4} ${y - 8}`}
                    fill="none" stroke={INK} strokeWidth={1.1} />
                  <text x={(px + x) / 2} y={y0 + 14} fontSize={10} fontWeight={700} textAnchor="middle" fill={INK}>{n.stroke}</text>
                </>
              ) : n.stroke === "h" || n.stroke === "p" ? (
                // Slurred over a barline: the letter alone.
                <text x={x} y={y0 + 14} fontSize={10} fontWeight={700} textAnchor="middle" fill={INK}>{n.stroke}</text>
              ) : (
                <path d={n.stroke === "D"
                  ? `M${x - 4.5} ${y0 + 16}V${y0 + 8}H${x + 4.5}V${y0 + 16}`
                  : `M${x - 4} ${y0 + 7}L${x} ${y0 + 16}L${x + 4} ${y0 + 7}`}
                  fill="none" stroke="#57534e" strokeWidth={n.stroke === "D" ? 2.2 : 1.6} strokeLinejoin="round" />
              )}
              <rect x={x - 9} y={y - 7.5} width={18} height={15} fill="#fff" />
              <text x={x} y={y + 4.5} fontSize={13} fontWeight={700} textAnchor="middle" fill={on ? "#b45309" : INK}>{n.fret}</text>
              <text x={x} y={y0 + lineY(0) + 22} fontSize={10} textAnchor="middle"
                fontWeight={strong.includes(slot) ? 700 : 400} fill={strong.includes(slot) ? INK : "#a8a29e"}>
                {countAt(settings.meter, settings.subs, slot)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
