"use client";

import { useRef, useState } from "react";
import { ChordRef } from "./harmony";

/** Where a drag would land: a bar and which half of it, or a new bar. */
export type DropSpot = { bar: number; side: "left" | "right" } | { bar: "new" };

export interface DragState {
  ref: ChordRef;
  x: number;
  y: number;
  over: DropSpot | null;
}

/** How far a press must travel before it is a drag rather than a tap. */
const SLOP = 6;

/**
 * Drag a chord from the chord row onto the progression, by pointer events
 * rather than HTML drag-and-drop, which touch screens never fire. Drop
 * targets are any element with `data-bar` (a bar's index, or "new"); which
 * half of it the pointer is over decides swap (left) or append (right).
 *
 * A press that never travels stays a tap: `wasDrag()` lets the click handler
 * tell the two apart, since a drag still ends in a click on the source.
 */
export function useChordDrag(onDrop: (ref: ChordRef, spot: DropSpot) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const press = useRef<{ ref: ChordRef; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const spotAt = (x: number, y: number): DropSpot | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-bar]");
    if (!el) return null;
    if (el.dataset.bar === "new") return { bar: "new" };
    const r = el.getBoundingClientRect();
    return { bar: Number(el.dataset.bar), side: x < r.left + r.width / 2 ? "left" : "right" };
  };

  const bind = (ref: ChordRef) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      press.current = { ref, x: e.clientX, y: e.clientY, moved: false };
      dragged.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < SLOP) return;
      p.moved = true;
      setDrag({ ref: p.ref, x: e.clientX, y: e.clientY, over: spotAt(e.clientX, e.clientY) });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const p = press.current;
      press.current = null;
      if (!p?.moved) return;
      dragged.current = true;
      const spot = spotAt(e.clientX, e.clientY);
      setDrag(null);
      if (spot) onDrop(p.ref, spot);
    },
    onPointerCancel: () => {
      press.current = null;
      setDrag(null);
    },
  });

  /** True once, right after a drag ends, so the click it causes is ignored. */
  const wasDrag = () => {
    const d = dragged.current;
    dragged.current = false;
    return d;
  };

  return { drag, bind, wasDrag };
}
