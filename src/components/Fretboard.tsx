"use client";

import { midiAt } from "@/lib/theory";
import { pluck } from "@/lib/audio";

export interface FbNote {
  string: number; // 0 = low E .. 5 = high E
  fret: number;
  label: string;
  fill: string; // css color
  ring?: string; // optional outline color (pivot/chord-tone emphasis)
  dim?: boolean;
  /** Diamond marks a note as part of something played over the scale, e.g. a chord. */
  shape?: "circle" | "diamond";
  /** A dashed outer ring: "this same note, elsewhere on the neck". */
  halo?: boolean;
}

interface Props {
  notes: FbNote[];
  maxFret?: number;
  onNoteClick?: (n: FbNote) => void;
  /** Pointer over a note (or off all of them: null). */
  onNoteHover?: (n: FbNote | null) => void;
  playOnClick?: boolean;
  /** Scale to the container's width instead of scrolling inside it. */
  fit?: boolean;
  /**
   * Stand the neck up: nut at the top, low E on the left, as in a chord chart.
   * A portrait phone has the room for a neck this way round. Always fits.
   */
  vertical?: boolean;
  /** Drawn over the notes, with the neck's geometry, for anything that moves. */
  overlay?: (geo: FretGeo) => React.ReactNode;
}

/**
 * The neck's layout, for drawing on top of it. `u` runs along the neck and
 * `v` across the strings; `at` turns those into x/y for either orientation.
 * `across` takes fractional strings, so a bend can push a dot between them.
 */
export interface FretGeo {
  vertical: boolean;
  R: number;
  fretL: number;
  stringGap: number;
  maxFret: number;
  at: (u: number, v: number) => { x: number; y: number };
  across: (s: number) => number;
  fretLine: (f: number) => number;
  fretMid: (f: number) => number;
  /** x/y of the dot for string `s`, fret `f` (fractional frets slide). */
  pos: (s: number, f: number) => { x: number; y: number };
}

const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

/**
 * Label colour for a dot, taken from the dot's own brightness. Roots are dark
 * on a pale board and scale tones are bright, so one fixed ink colour would be
 * unreadable on half of them.
 */
function inkOn(fill: string): string {
  const hex = fill.replace("#", "");
  if (hex.length !== 6) return "#0a0a0a";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#0a0a0a" : "#fafafa";
}

/** A square on its point, `d` from centre to each corner. */
const diamond = ({ x, y }: { x: number; y: number }, d: number) =>
  `M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z`;

export default function Fretboard({
  notes, maxFret = 22, onNoteClick, onNoteHover, playOnClick = true, fit = false, vertical = false, overlay,
}: Props) {
  // Everything is laid out in neck terms, `u` along the neck and `v` across
  // the strings, then turned into x/y at the end — so one drawing serves both
  // orientations. Proportions are generous on purpose: a dot never crowds
  // its neighbour, on a string or across one.
  let fretL: number, R: number, stringGap: number, nut: number, W: number, H: number;
  let across: (s: number) => number;
  if (vertical) {
    fretL = 50;
    R = 14;
    stringGap = 52;
    nut = 38; // room above for open-string notes
    const side = 40; // room on the left for fret numbers
    across = (s) => side + s * stringGap;
    W = side + 5 * stringGap + 24;
    H = nut + maxFret * fretL + 16;
  } else {
    // Tighten the grid on a full neck so 22 frets stay on screen at a glance.
    fretL = maxFret > 17 ? 38 : 58;
    R = maxFret > 17 ? 10 : 12.5;
    stringGap = maxFret > 17 ? 28 : 34;
    nut = 40; // room for open-string notes
    const top = 22;
    // string 5 (high E) drawn on top
    across = (s) => top + (5 - s) * stringGap;
    W = nut + (maxFret + 1) * fretL + 12;
    H = top + 5 * stringGap + 34;
  }
  const at = (u: number, v: number) => (vertical ? { x: v, y: u } : { x: u, y: v });
  const fretLine = (f: number) => nut + f * fretL;
  // Fractional frets glide smoothly from the open position into fret 1.
  const fretMid = (f: number) => (f <= 0 ? nut - 17 : f < 1 ? nut - 17 + f * (fretL / 2 + 17) : nut + (f - 0.5) * fretL);
  const noteAtPos = (s: number, f: number) => at(fretMid(f), across(s));
  const acrossMid = (across(0) + across(5)) / 2;
  const acrossLo = Math.min(across(0), across(5));
  const acrossHi = Math.max(across(0), across(5));
  const line = (u1: number, v1: number, u2: number, v2: number) => {
    const a = at(u1, v1), b = at(u2, v2);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };

  const scaled = fit || vertical;

  return (
    <div className={`${scaled ? "" : "overflow-x-auto"} rounded-2xl border border-neutral-200 bg-white`}>
      <svg
        {...(scaled ? { viewBox: `0 0 ${W} ${H}`, width: "100%" } : { width: W, height: H })}
        className={`block ${vertical ? "mx-auto max-w-md" : ""}`}
        onMouseLeave={() => onNoteHover?.(null)}>
        {/* frets: hairlines, so the dots carry the picture */}
        {Array.from({ length: maxFret + 1 }, (_, f) => (
          <line
            key={f}
            {...line(fretLine(f), acrossLo - 4, fretLine(f), acrossHi + 4)}
            stroke={f === 0 ? "#3f3f46" : "#e7e5e4"}
            strokeWidth={f === 0 ? 5 : 1.5}
            strokeLinecap="round"
          />
        ))}
        {/* inlays + fret numbers */}
        {INLAYS.filter((f) => f <= maxFret).map((f) => {
          const dots = f === 12
            ? vertical ? [across(1.5), across(3.5)] : [across(1.5), across(3.5)]
            : [acrossMid];
          const num = vertical
            ? { x: 16, y: fretMid(f) + 4 }
            : { x: fretMid(f), y: H - 9 };
          return (
            <g key={f}>
              {dots.map((v, i) => {
                const c = at(fretMid(f), v);
                return <circle key={i} cx={c.x} cy={c.y} r={4} fill="#f0efed" />;
              })}
              <text x={num.x} y={num.y} textAnchor="middle"
                className="fill-neutral-400" fontSize={11}>{f}</text>
            </g>
          );
        })}
        {/* strings: thicker toward the bass */}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s}
            {...line(nut - 4, across(s), fretLine(maxFret) + fretL * 0.35, across(s))}
            stroke="#a8a29e" strokeWidth={0.7 + (5 - s) * 0.3}
          />
        ))}
        {/* notes */}
        {notes.filter((n) => n.fret <= maxFret).map((n, i) => {
          const p = noteAtPos(n.string, n.fret);
          return (
            <g
              key={`${n.string}-${n.fret}-${i}`}
              className="cursor-pointer"
              opacity={n.dim ? 0.28 : 1}
              onMouseEnter={() => onNoteHover?.(n)}
              onClick={() => {
                if (playOnClick) pluck(midiAt(n.string, n.fret));
                onNoteClick?.(n);
              }}
            >
              {n.halo && (
                <circle cx={p.x} cy={p.y} r={R + 5} fill="none" stroke="#18181b" strokeWidth={1.25} strokeDasharray="3 2.5" />
              )}
              {n.shape === "diamond" ? (
                <path d={diamond(p, R * 1.4)}
                  fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} strokeLinejoin="round" />
              ) : (
                <circle cx={p.x} cy={p.y} r={R}
                  fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} />
              )}
              <text x={p.x} y={p.y + R * 0.32} textAnchor="middle"
                fontSize={R * 0.82} fontWeight={700} fill={inkOn(n.fill)}>{n.label}</text>
            </g>
          );
        })}
        {overlay?.({
          vertical, R, fretL, stringGap, maxFret, at, across, fretLine, fretMid,
          pos: (s, f) => at(fretMid(f), across(s)),
        })}
      </svg>
    </div>
  );
}
