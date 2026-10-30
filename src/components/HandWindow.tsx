"use client";

import { useRef } from "react";
import { FretGeo } from "./Fretboard";

const INK = "#18181b";
/** The window spans this many frets: lo to lo + 4, one finger per fret plus a stretch. */
const SPAN = 5;

interface Props {
  geo: FretGeo;
  /** The window's lowest fret. */
  lo: number;
  maxLo: number;
  onLo: (lo: number) => void;
}

/** The window's rectangle on the neck, in x/y, open strings included at the nut. */
function box(geo: FretGeo, lo: number) {
  const u0 = lo <= 0 ? geo.fretLine(0) - geo.fretL * 0.7 : geo.fretLine(lo - 1);
  const u1 = geo.fretLine(Math.min(lo + SPAN - 1, geo.maxFret));
  const a = geo.at(u0, geo.across(-0.55)), b = geo.at(u1, geo.across(5.55));
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/**
 * Where the hand is, as something to grab. Under the notes, so they stay
 * hoverable: drag inside the window to slide it along the neck, or click
 * the board anywhere else to put the hand there. On a touch screen only
 * the window itself drags, so the rest of the neck still scrolls the page.
 */
export function HandBoard({ geo, lo, maxLo, onLo }: Props) {
  const drag = useRef<{ offset: number; id: number } | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(maxLo, Math.round(n)));
  const all = box(geo, 0);
  const whole = { ...all, ...(geo.vertical
    ? { height: geo.fretLine(geo.maxFret) - all.y }
    : { width: geo.fretLine(geo.maxFret) - all.x }) };
  return (
    <g>
      <rect {...whole} fill="transparent"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          // Centre the hand on the fret clicked.
          onLo(clamp(geo.fretAt(e) - SPAN / 2));
        }} />
      <rect {...box(geo, lo)} fill="transparent" rx={10}
        className="cursor-grab active:cursor-grabbing" style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { offset: lo - geo.fretAt(e), id: e.pointerId };
        }}
        onPointerMove={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          const next = clamp(geo.fretAt(e) + drag.current.offset);
          if (next !== lo) onLo(next);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }} />
    </g>
  );
}

/** The window's outline, over the notes: where the hand is, and that it moves. */
export function HandFrame({ geo, lo }: { geo: FretGeo; lo: number }) {
  return (
    <rect {...box(geo, lo)} rx={10} fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={1.5}
      pointerEvents="none" />
  );
}
