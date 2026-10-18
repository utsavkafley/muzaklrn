"use client";

import { useRef, useState } from "react";
import ChordHover from "./ChordHover";
import { ChordRef, DiatonicChord, MOOD_FILL } from "@/lib/harmony";
import { Bar } from "@/lib/progressions";
import { DropSpot } from "@/lib/useChordDrag";
import { NoteName } from "@/lib/theory";

interface Props {
  bars: Bar[];
  chordOf: (bar: Bar, half: number) => DiatonicChord;
  /** The bar the next tapped chord lands in. */
  target: number | null;
  playing: { bar: number; half: number } | null;
  /** Where a chord being dragged would land, to preview it. */
  over: DropSpot | null;
  canAdd: boolean;
  keyNote: NoteName;
  fillFor: (string: number, fret: number) => string;
  /** Every chord this bar-half could become, in key or out. */
  variantsFor: (bar: number, half: number) => DiatonicChord[];
  onAlter: (bar: number, half: number, ref: ChordRef) => void;
  onTapBar: (i: number) => void;
  onAddBar: () => void;
  onClear: () => void;
}

const LIFT = "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50";
/** How long a press must last to open the change menu. */
const HOLD_MS = 450;

/**
 * The progression: one row is a four-bar phrase. A bar holds one chord, or
 * two that split it — the first on beats 1–2, the second on 3–4. Hover a
 * chord for its fingerings; hold one to change it into another chord on the
 * same root, in the key or out of it.
 */
export default function ProgressionStrip({
  bars, chordOf, target, playing, over, canAdd, keyNote, fillFor, variantsFor, onAlter,
  onTapBar, onAddBar, onClear,
}: Props) {
  const [menu, setMenu] = useState<{ bar: number; half: number } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A hold just opened the menu: the click that ends it isn't a tap. */
  const held = useRef(false);

  const startHold = (bar: number, half: number) => {
    held.current = false;
    if (hold.current) clearTimeout(hold.current);
    hold.current = setTimeout(() => {
      held.current = true;
      setMenu({ bar, half });
    }, HOLD_MS);
  };
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };

  return (
    <div className="flex items-start gap-2">
      <div className="grid flex-1 grid-cols-4 gap-2">
        {bars.map((bar, i) => {
          const aimed = target === i;
          const isPlaying = playing?.bar === i;
          const drop = over && over.bar === i ? over.side : null;
          const label = bar.length ? bar.map((_, h) => chordOf(bar, h).numeral).join(" ") : "empty";
          return (
            <div key={i} className="relative">
              <div role="button" tabIndex={0} data-bar={i}
                onClick={() => {
                  if (held.current) { held.current = false; return; }
                  onTapBar(i);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") onTapBar(i); }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`bar ${i + 1}: ${label}`}
                className={`relative flex h-16 cursor-pointer select-none rounded-xl leading-tight transition ${
                  bar.length ? "" : `border-2 border-dashed ${aimed ? "border-neutral-500" : "border-neutral-200"}`
                } ${isPlaying ? `scale-105 ${LIFT}` : bar.length && aimed ? "ring-2 ring-neutral-400 ring-offset-2 ring-offset-neutral-50" : ""}`}>
                {bar.map((_, h) => {
                  const c = chordOf(bar, h);
                  const live = isPlaying && playing!.half === h && bar.length === 2;
                  return (
                    <ChordHover key={h} chord={c} keyNote={keyNote} fillFor={fillFor}
                      align={i % 4 === 0 && h === 0 ? "left" : i % 4 === 3 && h === bar.length - 1 ? "right" : "center"}
                      className="flex flex-1">
                      <span
                        onPointerDown={() => startHold(i, h)}
                        onPointerUp={endHold}
                        onPointerLeave={endHold}
                        onPointerCancel={endHold}
                        style={{ background: MOOD_FILL[c.mood] }}
                        className={`flex flex-1 flex-col items-center justify-center text-neutral-950 ${
                          h === 0 ? "rounded-l-xl" : ""} ${h === bar.length - 1 ? "rounded-r-xl" : ""} ${
                          h === 1 ? "border-l-2 border-neutral-50" : ""
                        } ${bar.length === 2 && isPlaying && !live ? "opacity-50" : ""}`}>
                        <span className={`${bar.length === 2 ? "text-sm" : "text-lg"} font-bold`}>{c.numeral}</span>
                        <span className="text-xs text-neutral-800">{c.name}</span>
                      </span>
                    </ChordHover>
                  );
                })}
                {/* While a chord is dragged over: left half swaps the bar, right
                    half appends it as the bar's second chord. */}
                {drop && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex overflow-hidden rounded-xl">
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
              </div>

              {menu && menu.bar === i && bar[menu.half] && (
                <ChangeMenu
                  current={chordOf(bar, menu.half)}
                  variants={variantsFor(i, menu.half)}
                  align={i % 4 === 0 ? "left" : i % 4 === 3 ? "right" : "center"}
                  onPick={(c) => {
                    onAlter(i, menu.half, { degree: c.degree, kind: c.kind, alt: c.alt });
                    setMenu(null);
                  }}
                  onClose={() => setMenu(null)}
                />
              )}
            </div>
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

/**
 * The chords a bar-half can turn into: the same root, every shape. Ones that
 * reach outside the key read as tension — they lean toward the next chord.
 */
function ChangeMenu({ current, variants, align, onPick, onClose }: {
  current: DiatonicChord;
  variants: DiatonicChord[];
  align: "left" | "center" | "right";
  onPick: (c: DiatonicChord) => void;
  onClose: () => void;
}) {
  const place = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <>
      {/* A click anywhere else closes it. */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={`change ${current.numeral}`}
        className={`absolute top-full z-40 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl ${place}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-neutral-600">
            Change <b className="text-neutral-900">{current.numeral}</b> to…
          </span>
          <button onClick={onClose} aria-label="close" className="h-7 w-7 rounded-full text-neutral-400 hover:text-neutral-700">✕</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {variants.map((v) => (
            <button key={v.alt} onClick={() => onPick(v)} title={v.why}
              style={{ background: MOOD_FILL[v.mood] }}
              className={`flex flex-col items-center rounded-lg py-1.5 leading-tight text-neutral-950 ${
                v.name === current.name ? "ring-2 ring-neutral-900" : ""
              }`}>
              <span className="text-sm font-bold">{v.numeral}</span>
              <span className="text-[11px] text-neutral-800">{v.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-neutral-500">
          Same root, any shape. A note from outside the key leans toward the next chord — lift ii to II or II7
          and it pulls into V.
        </p>
      </div>
    </>
  );
}
