"use client";

import { useEffect, useState } from "react";
import { FretGeo } from "./Fretboard";
import { audioCtx } from "@/lib/audio";
import { RiffEvent, RiffNote, moveWindow, steps } from "@/lib/riffs";

const INK = "#18181b";
const BOARD = "#fafaf9";
const STRING = "#8b8b93";

interface Props {
  geo: FretGeo;
  /** The phrase as it sits on the neck now: drawn as numbered ghosts. */
  notes: RiffNote[];
  /** Mark the last note as where the phrase lands. */
  lands?: boolean;
  /** Notes on the audio clock; read every frame while `live`. */
  events: React.RefObject<RiffEvent[]>;
  live: boolean;
  /** Fill for the note at a string and fret: the same colours as the neck. */
  colorOf: (string: number, fret: number) => string;
  /** A riff note outside the key has no dot under it; this draws one. */
  outside: (string: number, fret: number) => string | null;
}

/**
 * The riff on the neck. Still, it is a numbered map of where the hand goes
 * and how: arcs for hammer-ons and pull-offs, a track for a slide, an arrow
 * and a waiting target for a bend. Playing, each note lights in time — a
 * ripple where it is picked, none where the fretting hand sounds it, the dot
 * travelling up the string on a slide, and on a bend the string itself
 * bowing as the dot rises and its colour turns into the note it reaches.
 */
export default function RiffLayer({ geo, notes, lands, events, live, colorOf, outside }: Props) {
  const [frame, setFrame] = useState<{ now: number; on: RiffEvent[] }>({ now: 0, on: [] });

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      const now = audioCtx().currentTime;
      setFrame({ now, on: events.current.filter((e) => e.start <= now && now < e.end + 0.12) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, events]);

  const on = live ? frame.on : [];
  return (
    <g pointerEvents="none">
      {/* Bent strings first, so the map and the moving dots sit on top. */}
      {on.map((e) => <Live key={`s${e.start}-${e.string}`} part="string" geo={geo} e={e} now={frame.now} colorOf={colorOf} />)}
      <Ghosts geo={geo} notes={notes} lands={lands} faded={on.length > 0} colorOf={colorOf} outside={outside} />
      {on.map((e) => <Live key={`d${e.start}-${e.string}`} part="dot" geo={geo} e={e} now={frame.now} colorOf={colorOf} />)}
    </g>
  );
}

/** Which way a bend pushes the string: the treble strings up toward the bass, the bass strings down. */
const bendDir = (s: number) => (s >= 3 ? -1 : 1);
/** How far across the strings one semitone of bend moves the dot. */
const PER_SEMI = 0.42;

function Ghosts({ geo, notes, lands, faded, colorOf, outside }: {
  geo: FretGeo; notes: RiffNote[]; lands?: boolean; faded: boolean;
  colorOf: Props["colorOf"]; outside: Props["outside"];
}) {
  const { pos, R } = geo;
  // Notes at the same spot share one ring and one badge: "1·3·4". Notes
  // struck together (a triad) share one step number.
  const order = steps(notes);
  const spots = new Map<string, { s: number; f: number; orders: number[] }>();
  notes.forEach((x, i) => {
    const k = `${x.string}:${x.fret}`;
    const spot = spots.get(k) ?? { s: x.string, f: x.fret, orders: [] };
    if (!spot.orders.includes(order[i])) spot.orders.push(order[i]);
    spots.set(k, spot);
  });
  const landing = lands && notes.length ? notes[notes.length - 1] : null;
  const last: Record<number, number> = {};

  return (
    <g opacity={faded ? 0.35 : 1}>
      {notes.map((x, i) => {
        const p = pos(x.string, x.fret);
        const from = last[x.string];
        last[x.string] = x.tech === "slide" && x.to !== undefined ? x.to : x.fret;
        if ((x.tech === "hammer" || x.tech === "pull") && from !== undefined && from !== x.fret) {
          return <Arc key={i} geo={geo} s={x.string} a={from} b={x.fret} label={x.tech === "hammer" ? "h" : "p"} />;
        }
        if (x.tech === "slide" && x.to !== undefined) {
          const q = pos(x.string, x.to);
          return (
            <g key={i}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INK} strokeWidth={2} strokeDasharray="3 3" />
              <circle cx={q.x} cy={q.y} r={R + 3} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="2 2" />
              <Arrowhead from={p} to={q} />
            </g>
          );
        }
        if ((x.tech === "bend" || x.tech === "release") && x.to !== undefined) {
          const semis = x.to - x.fret;
          const tip = geo.at(geo.fretMid(x.fret), geo.across(x.string + bendDir(x.string) * semis * PER_SEMI));
          const target = pos(x.string, x.to);
          return (
            <g key={i}>
              <line x1={p.x} y1={p.y} x2={tip.x} y2={tip.y} stroke={INK} strokeWidth={2} />
              <Arrowhead from={x.tech === "bend" ? p : tip} to={x.tech === "bend" ? tip : p} />
              <text x={tip.x + (geo.vertical ? 0 : 9)} y={tip.y + (geo.vertical ? -9 : 4)} fontSize={10} fontWeight={700}
                textAnchor="middle" fill={INK}>{semis === 1 ? "½" : semis === 2 ? "1" : `${semis / 2}`}</text>
              <circle cx={target.x} cy={target.y} r={R + 3} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="2 2" />
            </g>
          );
        }
        if (x.tech === "vibrato") {
          return <text key={i} x={p.x} y={p.y - R - 5} fontSize={12} fontWeight={700} textAnchor="middle" fill={INK}>~</text>;
        }
        return null;
      })}
      {[...spots.values()].map(({ s, f, orders }) => {
        const p = pos(s, f);
        // Long runs (an arpeggio up and back) would make an unreadable badge.
        const label = orders.length > 3 ? `${orders[0]}…${orders[orders.length - 1]}` : orders.join("·");
        const w = Math.max(12, label.length * 5.6 + 6);
        const out = outside(s, f);
        return (
          <g key={`${s}:${f}`}>
            {out && (
              <>
                <circle cx={p.x} cy={p.y} r={R} fill={colorOf(s, f)} />
                <text x={p.x} y={p.y + R * 0.34} fontSize={R * 0.9} fontWeight={700} textAnchor="middle" fill={INK}>{out}</text>
              </>
            )}
            <circle cx={p.x} cy={p.y} r={R + 3} fill="none" stroke={INK} strokeWidth={1.75} />
            {/* Where a lick lands: a second ring, the target. */}
            {landing && landing.string === s && landing.fret === f && (
              <circle cx={p.x} cy={p.y} r={R + 7} fill="none" stroke={INK} strokeWidth={1.25} />
            )}
            <rect x={p.x + R * 0.55} y={p.y - R - 9} width={w} height={12} rx={6} fill="#fff" stroke={INK} strokeWidth={1} />
            <text x={p.x + R * 0.55 + w / 2} y={p.y - R - 0.5} fontSize={8.5} fontWeight={700} textAnchor="middle" fill={INK}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}

function Live({ geo, e, now, colorOf, part }: {
  geo: FretGeo; e: RiffEvent; now: number; colorOf: (s: number, f: number) => string; part: "string" | "dot";
}) {
  const { at, across, fretMid, fretLine, R, pos } = geo;
  const secPerEighth = (e.end - e.start) / e.len;
  const [m0, m1] = moveWindow(e, secPerEighth);
  const prog = m1 > m0 ? clamp((now - m0) / (m1 - m0)) : 0;
  const ease = prog * prog * (3 - 2 * prog);

  let fret = e.fret;
  let bend = 0; // semitones the string is pushed
  let fill = colorOf(e.string, e.fret);
  if (e.tech === "slide" && e.to !== undefined) {
    fret = e.fret + (e.to - e.fret) * ease;
    fill = colorOf(e.string, Math.round(fret));
  } else if ((e.tech === "bend" || e.tech === "release") && e.to !== undefined) {
    const k = e.tech === "bend" ? ease : 1 - ease;
    bend = (e.to - e.fret) * k;
    fill = mix(colorOf(e.string, e.fret), colorOf(e.string, e.to), k);
  }
  let wobble = 0;
  if (e.tech === "vibrato") {
    const t = now - e.start;
    wobble = Math.sin(t * Math.PI * 2 * 5.5) * 0.09 * clamp((t - (e.end - e.start) * 0.3) / 0.15);
  }
  const off = bendDir(e.string) * (bend * PER_SEMI + wobble);
  const p = at(fretMid(fret), across(e.string + off));
  const fade = clamp((e.end + 0.12 - now) / 0.12);
  const picked = e.tech !== "hammer" && e.tech !== "pull" && e.tech !== "release";
  const sinceStart = now - e.start;

  if (part === "string") {
    // A bent string bows across its fret: the straight run is painted out
    // (only where no dot already hides it) and a curve through the dot drawn.
    if (Math.abs(off) <= 0.01) return null;
    const u0 = fretLine(Math.max(e.fret - 1, 0)), u1 = fretLine(e.fret), mid = fretMid(e.fret);
    const a = at(u0, across(e.string)), b = at(u1, across(e.string));
    const c = { x: 2 * p.x - (a.x + b.x) / 2, y: 2 * p.y - (a.y + b.y) / 2 };
    const seg = (from: number, to: number) => {
      const x = at(from, across(e.string)), y = at(to, across(e.string));
      return <line x1={x.x} y1={x.y} x2={y.x} y2={y.y} stroke={BOARD} strokeWidth={3.5} />;
    };
    return (
      <g opacity={fade}>
        {seg(u0 + 1, mid - R)}
        {seg(mid + R, u1 - 1)}
        <path d={`M${a.x} ${a.y}Q${c.x} ${c.y} ${b.x} ${b.y}`} fill="none" stroke={STRING} strokeWidth={1.6} />
      </g>
    );
  }

  return (
    <g opacity={fade}>
      {(e.tech === "hammer" || e.tech === "pull") && e.from !== undefined && e.from !== e.fret && sinceStart < 0.35 && (
        <g opacity={1 - sinceStart / 0.35}>
          <Arc geo={geo} s={e.string} a={e.from} b={e.fret} label={e.tech === "hammer" ? "h" : "p"} />
        </g>
      )}
      {picked && sinceStart < 0.28 && (
        <circle cx={p.x} cy={p.y} r={R + 14 * (sinceStart / 0.28)} fill="none" stroke={INK} strokeWidth={2}
          opacity={0.6 * (1 - sinceStart / 0.28)} />
      )}
      <circle cx={p.x} cy={p.y} r={R * 1.2} fill={fill} stroke={INK} strokeWidth={2.5} />
      {/* Where a slide or bend is headed, kept in view as it travels. */}
      {e.to !== undefined && (e.tech === "slide" || e.tech === "bend") && prog < 1 && (
        <circle {...xy(pos(e.string, e.to))} r={R + 3} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="2 2" />
      )}
    </g>
  );
}

/** A hammer-on or pull-off: an arc over the string between the two frets. */
function Arc({ geo, s, a, b, label }: { geo: FretGeo; s: number; a: number; b: number; label: string }) {
  const p = geo.pos(s, a), q = geo.pos(s, b);
  // Bulge away from the string, toward the treble side in either orientation.
  const lift = geo.at(geo.fretMid((a + b) / 2), geo.across(s + (s >= 3 ? 0.7 : -0.7)));
  const c = { x: 2 * lift.x - (p.x + q.x) / 2, y: 2 * lift.y - (p.y + q.y) / 2 };
  return (
    <g>
      <path d={`M${p.x} ${p.y}Q${c.x} ${c.y} ${q.x} ${q.y}`} fill="none" stroke={INK} strokeWidth={2} />
      <text x={lift.x} y={lift.y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill={INK}
        stroke={BOARD} strokeWidth={3} paintOrder="stroke">{label}</text>
    </g>
  );
}

function Arrowhead({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const L = 7, W = 0.5;
  const p1 = { x: to.x - L * Math.cos(a - W), y: to.y - L * Math.sin(a - W) };
  const p2 = { x: to.x - L * Math.cos(a + W), y: to.y - L * Math.sin(a + W) };
  return <path d={`M${to.x} ${to.y}L${p1.x} ${p1.y}L${p2.x} ${p2.y}Z`} fill={INK} />;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const xy = (p: { x: number; y: number }) => ({ cx: p.x, cy: p.y });

/** Blend two #rrggbb colours, `k` of the way from a to b. */
function mix(a: string, b: string, k: number) {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
