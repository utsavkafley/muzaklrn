"use client";

import { useRef } from "react";
import { FretGeo } from "./Fretboard";

const INK = "#18181b";
/** The board inside the window, a shade warmer than the rest of the neck. */
const TINT = "#fdf6e3";
/** The narrowest window: two frets. */
const MIN_SPAN = 2;

interface Props {
  geo: FretGeo;
  /** The window's lowest fret. */
  lo: number;
  /** How many frets it spans: five is one hand position, wider takes in several. */
  span: number;
  /** Move or resize the window. */
  onWindow: (lo: number, span: number) => void;
  /** While set, every tap on the board is an answer: the string and fret it landed on. The hand stays put. */
  onTap?: (string: number, fret: number) => void;
}

/** The window's rectangle on the neck, in x/y, open strings included at the nut. */
function box(geo: FretGeo, lo: number, span: number) {
  const u0 = lo <= 0 ? geo.fretLine(0) - geo.fretL * 0.7 : geo.fretLine(lo - 1);
  const u1 = geo.fretLine(Math.min(lo + span - 1, geo.maxFret));
  const a = geo.at(u0, geo.across(-0.55)), b = geo.at(u1, geo.across(5.55));
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/** A strip along one end of the window, for grabbing that edge. */
function edge(geo: FretGeo, lo: number, span: number, end: "lo" | "hi") {
  const r = box(geo, lo, span);
  const t = geo.fretL * 0.28;
  if (geo.vertical) return { x: r.x, width: r.width, height: t * 2, y: (end === "lo" ? r.y : r.y + r.height) - t };
  return { y: r.y, height: r.height, width: t * 2, x: (end === "lo" ? r.x : r.x + r.width) - t };
}

type Grab = { kind: "move"; offset: number; id: number } | { kind: "lo" | "hi"; id: number };

/**
 * Where the hand is, as something to grab. Under the notes, so they stay
 * hoverable: drag inside the window to slide it along the neck, drag either
 * end to make it wider or narrower — one position, or several joined up —
 * or click the board anywhere else to put the hand there. On a touch screen
 * only the window itself drags, so the rest of the neck still scrolls the page.
 */
export function HandBoard({ geo, lo, span, onWindow, onTap }: Props) {
  const grab = useRef<Grab | null>(null);
  const top = geo.maxFret + 1;
  const clampLo = (n: number) => Math.max(0, Math.min(top - span, Math.round(n)));
  const all = box(geo, 0, 1);
  const whole = { ...all, ...(geo.vertical
    ? { height: geo.fretLine(geo.maxFret) - all.y }
    : { width: geo.fretLine(geo.maxFret) - all.x }) };
  if (onTap) {
    return (
      <rect {...whole} fill="transparent" className="cursor-crosshair"
        onPointerDown={(e) => onTap(
          Math.max(0, Math.min(5, Math.round(geo.stringAt(e)))),
          Math.max(0, Math.min(geo.maxFret, Math.round(geo.fretAt(e)))),
        )} />
    );
  }
  const start = (g: Grab) => (e: React.PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = g;
  };
  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const g = grab.current;
    if (g?.id !== e.pointerId) return;
    const f = geo.fretAt(e);
    if (g.kind === "move") {
      const next = clampLo(f + g.offset);
      if (next !== lo) onWindow(next, span);
    } else if (g.kind === "lo") {
      // The low end follows the pointer; the high end stays put.
      const hi = lo + span - 1;
      const nlo = Math.max(0, Math.min(hi - MIN_SPAN + 1, Math.round(f)));
      if (nlo !== lo) onWindow(nlo, hi - nlo + 1);
    } else {
      const hi = Math.max(lo + MIN_SPAN - 1, Math.min(top - 1, Math.round(f)));
      if (hi - lo + 1 !== span) onWindow(lo, hi - lo + 1);
    }
  };
  const end = () => { grab.current = null; };
  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end, style: { touchAction: "none" as const } };
  const resize = geo.vertical ? "cursor-ns-resize" : "cursor-ew-resize";
  return (
    <g>
      <rect {...whole} fill="transparent"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          // Centre the hand on the fret clicked.
          onWindow(clampLo(geo.fretAt(e) - span / 2), span);
        }} />
      <rect {...box(geo, lo, span)} fill={TINT} rx={10}
        className="cursor-grab active:cursor-grabbing" {...handlers}
        onPointerDown={(e) => start({ kind: "move", offset: lo - geo.fretAt(e), id: e.pointerId })(e)} />
      <rect {...edge(geo, lo, span, "lo")} fill="transparent" className={resize} {...handlers}
        onPointerDown={(e) => start({ kind: "lo", id: e.pointerId })(e)} />
      <rect {...edge(geo, lo, span, "hi")} fill="transparent" className={resize} {...handlers}
        onPointerDown={(e) => start({ kind: "hi", id: e.pointerId })(e)} />
    </g>
  );
}

/**
 * The window's outline, over the notes: where the hand is, and that it
 * moves. A grip on each end says the ends drag too.
 */
export function HandFrame({ geo, lo, span }: { geo: FretGeo; lo: number; span: number }) {
  const r = box(geo, lo, span);
  const grip = (end: "lo" | "hi") => {
    const e = edge(geo, lo, span, end);
    const c = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    const long = geo.vertical ? { width: 22, height: 5 } : { width: 5, height: 22 };
    return <rect key={end} x={c.x - long.width / 2} y={c.y - long.height / 2} {...long} rx={2.5} fill={INK} fillOpacity={0.35} />;
  };
  return (
    <g pointerEvents="none">
      <rect {...r} rx={10} fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={1.5} />
      {grip("lo")}
      {grip("hi")}
    </g>
  );
}
