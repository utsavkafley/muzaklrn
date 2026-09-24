"use client";

import { useEffect, useRef, useState } from "react";
import Fretboard, { FbNote } from "@/components/Fretboard";
import { Metronome, Voice, audioCtx, click, sticks } from "@/lib/audio";
import { fretNotesFor, parseNote, spellNote } from "@/lib/theory";

const MAX_FRET = 15;
const COUNT_OFF = 4;
const clampBpm = (n: number) => Math.max(30, Math.min(240, Math.round(n)));

export default function V2Page() {
  const [text, setText] = useState("");
  const note = parseNote(text);
  const name = spellNote(text);

  const [bpmText, setBpmText] = useState("90");
  const parsedBpm = parseInt(bpmText, 10);
  const bpm = Number.isFinite(parsedBpm) ? clampBpm(parsedBpm) : 90;
  const [running, setRunning] = useState(false);
  /** The beat sounding now (0-3), and whether it is still the count-in. */
  const [beat, setBeat] = useState<{ sub: number; countIn: boolean } | null>(null);

  const met = useRef<Metronome | null>(null);
  const voices = useRef<Voice[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const silence = () => {
    met.current?.stop();
    voices.current.forEach((v) => v.stop());
    voices.current = [];
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const stop = () => {
    silence();
    setRunning(false);
    setBeat(null);
  };

  const start = () => {
    if (!met.current) met.current = new Metronome();
    const m = met.current;
    m.bpm = bpm;
    m.beatsPerBar = 4;
    m.subsPerBeat = 1;
    // Every start counts in with sticks for a bar, then the click takes over
    // on the next downbeat.
    m.onTick = (t) => {
      voices.current.push(t.count < COUNT_OFF ? sticks(t.when) : click(t.when, t.sub === 0));
      if (voices.current.length > 32) voices.current = voices.current.slice(-32);
      // Ticks are scheduled ahead; move the dot when the sound actually lands.
      const beatNow = { sub: t.sub, countIn: t.count < COUNT_OFF };
      const delay = Math.max(0, (t.when - audioCtx().currentTime) * 1000);
      timers.current.push(setTimeout(() => setBeat(beatNow), delay));
      if (timers.current.length > 32) timers.current = timers.current.slice(-32);
    };
    m.start();
    setRunning(true);
  };

  // Tempo edits land on the running click straight away.
  useEffect(() => {
    if (met.current) met.current.bpm = bpm;
  }, [bpm]);

  // Leaving the page takes the click with it.
  useEffect(() => silence, []);

  // Every place the note lives on the neck, up to MAX_FRET.
  const dots: FbNote[] = note && name
    ? fretNotesFor(note, [0], [name], MAX_FRET).map((n) => ({
        string: n.string, fret: n.fret, label: n.degree, fill: "#fbbf24",
      }))
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 px-4 pt-12 pb-24">
      {/* Three columns so the note stays dead centre whatever sits beside it. */}
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-end">
        <div />
        {/* outline-none! beats the global :focus-visible ring, which is unlayered
            and would otherwise win over a plain utility. */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
          aria-label="note"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-32 border-b-2 border-neutral-300 bg-transparent pb-1 text-center text-5xl font-bold text-neutral-900 caret-amber-600 outline-none! focus:border-amber-500"
        />
        <div className="flex items-end justify-end gap-3">
          <input
            value={bpmText}
            onChange={(e) => setBpmText(e.target.value.replace(/\D/g, "").slice(0, 3))}
            onBlur={() => setBpmText(String(bpm))}
            aria-label="bpm"
            inputMode="numeric"
            autoComplete="off"
            className="w-14 border-b-2 border-neutral-300 bg-transparent pb-0.5 text-center text-xl font-bold tabular-nums text-neutral-900 caret-amber-600 outline-none! focus:border-amber-500"
          />
          <button
            onClick={running ? stop : start}
            aria-label="metronome"
            aria-pressed={running}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              running ? "bg-amber-400 text-neutral-950" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <MetronomeIcon />
          </button>
        </div>

        {/* Beat dots sit under the note. Space is always held for them so the
            neck doesn't jump when the click starts. */}
        <div aria-hidden className="col-start-2 mt-4 flex h-2.5 justify-center gap-2.5">
          {running && Array.from({ length: 4 }, (_, i) => (
            <span key={i}
              className={`h-2.5 w-2.5 rounded-full transition-colors duration-75 ${
                beat?.sub !== i ? "bg-neutral-200"
                  : beat.countIn ? "bg-neutral-500"
                  : "bg-amber-500"
              }`} />
          ))}
        </div>
      </div>

      {note && name && (
        <div className="w-full">
          <Fretboard notes={dots} maxFret={MAX_FRET} />
        </div>
      )}
    </div>
  );
}

function MetronomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 3h5l4.5 18H5z" />
      <path d="M12 17 17 7" />
      <circle cx={15.2} cy={10.6} r={1.3} fill="currentColor" />
      <path d="M7 17h10" />
    </svg>
  );
}
