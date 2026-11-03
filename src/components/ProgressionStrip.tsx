"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Take one chord out of a bar: the bar's only one empties it, a split bar keeps the other. */
  onRemove: (bar: number, half: number) => void;
  onTapBar: (i: number) => void;
  onAddBar: () => void;
  onClear: () => void;
  /** Move bars (or copy them) to a drop spot; returns where they now start, or null if they don't fit. */
  onMove: (from: number[], spot: DropSpot, copy: boolean) => number | null;
  /** Take whole bars out. */
  onDelete: (bars: number[]) => void;
}

const LIFT = "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50";
const PICKED = "ring-2 ring-amber-500 ring-offset-2 ring-offset-neutral-50";
/** How far a press must travel before it is a drag rather than a tap. */
const SLOP = 6;

/** Bars being dragged: which, where the pointer is, where they'd land, and whether they'd be copied. */
interface BarDrag { from: number[]; x: number; y: number; over: DropSpot | null; copy: boolean }

const spotAt = (x: number, y: number): DropSpot | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-bar]");
  if (!el) return null;
  if (el.dataset.bar === "new") return { bar: "new" };
  const r = el.getBoundingClientRect();
  return { bar: Number(el.dataset.bar), side: x < r.left + r.width / 2 ? "left" : "right" };
};
/** How long a press must last to open the change menu. */
const HOLD_MS = 450;

/**
 * The progression: one row is a four-bar phrase. A bar holds one chord, or
 * two that split it — the first on beats 1–2, the second on 3–4. Hover a
 * chord for its fingerings; hold one to change it into another chord on the
 * same root, in the key or out of it.
 */
export default function ProgressionStrip({
  bars, chordOf, target, playing, over: chordOver, canAdd, keyNote, fillFor, variantsFor, onAlter, onRemove,
  onTapBar, onAddBar, onClear, onMove, onDelete,
}: Props) {
  /** Bars picked with ⌘-click or shift-click, to drag, copy or delete together. */
  const [picked, setPicked] = useState<number[]>([]);
  const anchor = useRef<number | null>(null);
  const [drag, setDragState] = useState<BarDrag | null>(null);
  // Kept in a ref too: a quick drag can end before the render that started it.
  const dragNow = useRef<BarDrag | null>(null);
  const setDrag = (d: BarDrag | null) => {
    dragNow.current = d;
    setDragState(d);
  };
  const press = useRef<{ bar: number; x: number; y: number; id: number } | null>(null);
  /** A drag just ended: the click it causes isn't a tap. */
  const dragged = useRef(false);
  // A bar dragged from the strip previews like a chord dragged from the row.
  const over = drag?.over ?? chordOver;
  // Picks name bars by index: a different strip makes them meaningless.
  const live = picked.filter((i) => bars[i]?.length);

  // With bars picked, Escape lets them go and Delete removes them.
  useEffect(() => {
    if (!live.length) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") setPicked([]);
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onDelete(live);
        setPicked([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, onDelete]);

  const pickClick = (i: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (!bars[i].length) return true;
      setPicked(live.includes(i) ? live.filter((x) => x !== i) : [...live, i].sort((a, b) => a - b));
      anchor.current = i;
      return true;
    }
    if (e.shiftKey && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
      setPicked(Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((x) => bars[x].length));
      return true;
    }
    setPicked([]);
    anchor.current = i;
    return false;
  };

  const barDrag = (i: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || e.pointerType === "touch" || !bars[i].length) return;
      press.current = { bar: i, x: e.clientX, y: e.clientY, id: e.pointerId };
      // Held from the start, so a quick flick off the bar still drags. The
      // hold menu's timer then hears its pointer-up from here.
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      const d = dragNow.current;
      if (!d && Math.hypot(e.clientX - p.x, e.clientY - p.y) < SLOP) return;
      if (!d) endHold();
      const from = d?.from ?? (live.includes(p.bar) ? live : [p.bar]);
      setDrag({ from, x: e.clientX, y: e.clientY, over: spotAt(e.clientX, e.clientY), copy: e.shiftKey || e.altKey });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      press.current = null;
      endHold();
      const d = dragNow.current;
      if (!d) return;
      dragged.current = true;
      setDrag(null);
      const spot = spotAt(e.clientX, e.clientY);
      if (!spot) return;
      const at = onMove(d.from, spot, e.shiftKey || e.altKey);
      if (at !== null) {
        setPicked(d.from.length > 1 ? Array.from({ length: d.from.length }, (_, k) => at + k) : []);
        anchor.current = at;
      }
    },
    onPointerCancel: () => {
      press.current = null;
      endHold();
      setDrag(null);
    },
  });
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
                {...barDrag(i)}
                onClick={(e) => {
                  if (held.current) { held.current = false; return; }
                  if (dragged.current) { dragged.current = false; return; }
                  if (pickClick(i, e)) return;
                  onTapBar(i);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") onTapBar(i); }}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`bar ${i + 1}: ${label}`}
                className={`relative flex h-16 cursor-pointer select-none rounded-xl leading-tight transition ${
                  bar.length ? "" : `border-2 border-dashed ${aimed ? "border-neutral-500" : "border-neutral-200"}`
                } ${isPlaying ? `scale-105 ${LIFT}` : live.includes(i) ? PICKED : bar.length && aimed ? "ring-2 ring-neutral-400 ring-offset-2 ring-offset-neutral-50" : ""} ${
                  drag?.from.includes(i) && !drag.copy ? "opacity-40" : ""}`}>
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
                {drop && drag && (
                  <InsertMark side={bar.length ? drop : null} copy={drag.copy} n={drag.from.length} />
                )}
                {drop && !drag && (
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
                  onRemove={() => {
                    onRemove(i, menu.half);
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
      {/* The bars being dragged follow the pointer. */}
      {drag && (
        <div aria-hidden className="pointer-events-none fixed z-40 flex -translate-x-1/2 -translate-y-1/2 gap-1 rounded-xl bg-white/80 p-1 shadow-lg"
          style={{ left: drag.x, top: drag.y }}>
          {drag.from.map((b) => (
            <span key={b} className="flex gap-px">
              {bars[b].map((_, h) => {
                const c = chordOf(bars[b], h);
                return (
                  <span key={h} style={{ background: MOOD_FILL[c.mood] }}
                    className="rounded-lg px-2 py-1 text-sm font-bold text-neutral-950">{c.numeral}</span>
                );
              })}
            </span>
          ))}
          {drag.copy && (
            <span className="absolute -top-2 -right-2 rounded-full bg-neutral-900 px-1.5 text-xs font-bold text-neutral-50">+</span>
          )}
        </div>
      )}
      <button onClick={onClear} aria-label="clear progression"
        className="mt-2.5 h-11 w-11 shrink-0 rounded-full text-neutral-400 hover:text-neutral-700">✕</button>
    </div>
  );
}

/**
 * Where dragged bars would go: a bar's left or right edge (in between
 * bars), or — over an empty bar — into it.
 */
function InsertMark({ side, copy, n }: { side: "left" | "right" | null; copy: boolean; n: number }) {
  const what = `${copy ? "copy" : "move"}${n > 1 ? ` ${n}` : ""}`;
  if (!side) {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-neutral-900/75 text-xs font-bold text-neutral-50">
        {what} here
      </span>
    );
  }
  return (
    <span aria-hidden className={`pointer-events-none absolute -inset-y-1 w-1 rounded-full bg-neutral-900 ${
      side === "left" ? "-left-1.5" : "-right-1.5"}`}>
      <span className={`absolute -top-5 whitespace-nowrap text-xs font-bold text-neutral-900 ${side === "left" ? "left-0" : "right-0"}`}>{what}</span>
    </span>
  );
}

/**
 * The chords a bar-half can turn into: the same root, every shape. Ones that
 * reach outside the key read as tension — they lean toward the next chord.
 */
function ChangeMenu({ current, variants, align, onPick, onRemove, onClose }: {
  current: DiatonicChord;
  variants: DiatonicChord[];
  align: "left" | "center" | "right";
  onPick: (c: DiatonicChord) => void;
  onRemove: () => void;
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
        <button onClick={onRemove}
          className="mt-2 w-full rounded-lg border border-neutral-200 py-1 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-800">
          Remove {current.name}
        </button>
        <p className="mt-2 text-xs leading-snug text-neutral-500">
          Same root, any shape. A note from outside the key leans toward the next chord — lift ii to II or II7
          and it pulls into V.
        </p>
      </div>
    </>
  );
}
