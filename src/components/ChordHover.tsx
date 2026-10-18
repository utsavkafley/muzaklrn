"use client";

import { useEffect, useMemo, useState } from "react";
import GripDiagram from "./GripDiagram";
import { audioCtx, pluck } from "@/lib/audio";
import { fingeringsFor } from "@/lib/fingerings";
import { DiatonicChord } from "@/lib/harmony";
import { NoteName, midiAt } from "@/lib/theory";

interface Props {
  chord: DiatonicChord;
  keyNote: NoteName;
  /** Dot colour for a string and fret: the neck's colours. */
  fillFor: (string: number, fret: number) => string;
  /** Which way the popup hangs, so it stays on screen at the edges. */
  align?: "left" | "center" | "right";
  /** Open below rather than above. */
  below?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps anything that names a chord. Hovering it shows one fingering at a
 * time — open, barre, three-string — with ‹ › (or the arrow keys) to step
 * through them; click the diagram to hear that one. Hover only, so a touch
 * screen never leaves one stuck open.
 */
export default function ChordHover({ chord, keyNote, fillFor, align = "center", below = false, className = "", children }: Props) {
  const list = useMemo(() => fingeringsFor(keyNote, chord), [keyNote, chord]);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const k = list.length ? i % list.length : 0;

  // While open, the arrow keys step through the fingerings.
  useEffect(() => {
    if (!open || list.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { setI((x) => x + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { setI((x) => x + list.length - 1); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, list.length]);

  const strum = () => {
    const g = list[k]?.grip;
    if (!g) return;
    const t = audioCtx().currentTime;
    g.forEach((f, s) => { if (f >= 0) pluck(midiAt(s, f), t + s * 0.02, 1.4, 0.3); });
  };

  const place = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <div className={`relative ${className}`}
      onMouseEnter={() => { setI(0); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}>
      {children}
      {open && list.length > 0 && (
        // Padding, not margin, toward the trigger: the pointer can cross the
        // gap into the popup without it closing.
        <div role="tooltip" className={`absolute z-30 ${place} ${below ? "top-full pt-2" : "bottom-full pb-2"} hidden [@media(hover:hover)]:block`}>
          <div className="w-44 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between">
              <button onClick={() => setI((x) => x + list.length - 1)} aria-label="previous fingering"
                disabled={list.length < 2}
                className="h-8 w-8 rounded-full text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-0">‹</button>
              <span className="text-sm font-bold text-neutral-900">{chord.name}</span>
              <button onClick={() => setI((x) => x + 1)} aria-label="next fingering"
                disabled={list.length < 2}
                className="h-8 w-8 rounded-full text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-0">›</button>
            </div>
            <button onClick={strum} aria-label={`play ${list[k].label}`} className="mx-auto block">
              <GripDiagram grip={list[k].grip} label="" fillFor={fillFor} />
            </button>
            <p className="text-center text-xs leading-snug text-neutral-600">{list[k].label}</p>
            <p className="mt-0.5 text-center text-[11px] tabular-nums text-neutral-400">{k + 1} of {list.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
