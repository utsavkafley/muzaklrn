"use client";

import { DiatonicChord, MOOD_FILL } from "@/lib/harmony";
import { Bar } from "@/lib/progressions";
import { DropSpot } from "@/lib/useChordDrag";

interface Props {
  bars: Bar[];
  chordOf: (bar: Bar, half: number) => DiatonicChord;
  /** The bar the next tapped chord lands in. */
  target: number | null;
  playing: { bar: number; half: number } | null;
  /** Where a chord being dragged would land, to preview it. */
  over: DropSpot | null;
  canAdd: boolean;
  onTapBar: (i: number) => void;
  onAddBar: () => void;
  onClear: () => void;
}

const LIFT = "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50";

/**
 * The progression: one row is a four-bar phrase. A bar holds one chord, or
 * two that split it — the first on beats 1–2, the second on 3–4.
 */
export default function ProgressionStrip({
  bars, chordOf, target, playing, over, canAdd, onTapBar, onAddBar, onClear,
}: Props) {
  return (
    <div className="flex items-start gap-2">
      <div className="grid flex-1 grid-cols-4 gap-2">
        {bars.map((bar, i) => {
          const aimed = target === i;
          const isPlaying = playing?.bar === i;
          const drop = over && over.bar === i ? over.side : null;
          const label = bar.length
            ? bar.map((_, h) => chordOf(bar, h).numeral).join(" ")
            : "empty";
          return (
            <button key={i} data-bar={i} onClick={() => onTapBar(i)}
              aria-label={`bar ${i + 1}: ${label}`}
              className={`relative flex h-16 overflow-hidden rounded-xl leading-tight transition ${
                bar.length ? "" : `border-2 border-dashed ${aimed ? "border-neutral-500" : "border-neutral-200"}`
              } ${isPlaying ? `scale-105 ${LIFT}` : bar.length && aimed ? "ring-2 ring-neutral-400 ring-offset-2 ring-offset-neutral-50" : ""}`}>
              {bar.map((_, h) => {
                const c = chordOf(bar, h);
                const live = isPlaying && playing!.half === h && bar.length === 2;
                return (
                  <span key={h} style={{ background: MOOD_FILL[c.mood] }}
                    className={`flex flex-1 flex-col items-center justify-center text-neutral-950 ${
                      h === 1 ? "border-l-2 border-neutral-50" : ""
                    } ${bar.length === 2 && isPlaying && !live ? "opacity-50" : ""}`}>
                    <span className={`${bar.length === 2 ? "text-sm" : "text-lg"} font-bold`}>{c.numeral}</span>
                    <span className="text-xs text-neutral-800">{c.name}</span>
                  </span>
                );
              })}
              {/* While a chord is dragged over: left half swaps the bar, right
                  half appends it as the bar's second chord. */}
              {drop && (
                <span aria-hidden className="pointer-events-none absolute inset-0 flex">
                  <span className={`flex flex-1 items-center justify-center text-xs font-bold ${
                    drop === "left" || !bar.length ? "bg-neutral-900/75 text-neutral-50" : ""}`}>
                    {(drop === "left" || !bar.length) && (bar.length ? "swap" : "add")}
                  </span>
                  {bar.length > 0 && (
                    <span className={`flex flex-1 items-center justify-center text-xs font-bold ${
                      drop === "right" ? "bg-neutral-900/75 text-neutral-50" : ""}`}>
                      {drop === "right" && "+ split"}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
        {canAdd && (
          <button data-bar="new" onClick={onAddBar} aria-label="add a bar"
            className={`flex h-16 items-center justify-center rounded-xl text-sm transition ${
              over?.bar === "new" ? "bg-neutral-900/75 text-neutral-50" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            }`}>
            + bar
          </button>
        )}
      </div>
      <button onClick={onClear} aria-label="clear progression"
        className="mt-2.5 h-11 w-11 shrink-0 rounded-full text-neutral-400 hover:text-neutral-700">✕</button>
    </div>
  );
}
