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
}

interface Props {
  notes: FbNote[];
  maxFret?: number;
  onNoteClick?: (n: FbNote) => void;
  playOnClick?: boolean;
  /** string/fret currently sounding — gets a pulsing ring, e.g. during scheduled playback */
  activeNote?: { string: number; fret: number } | null;
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
  notes, maxFret = 22, onNoteClick, playOnClick = true, activeNote, fit = false, vertical = false, overlay,
}: Props) {
  // Everything is laid out in neck terms, `u` along the neck and `v` across
  // the strings, then turned into x/y at the end — so one drawing serves both
  // orientations.
  let fretL: number, R: number, stringGap: number, nut: number, W: number, H: number;
  let across: (s: number) => number;
  if (vertical) {
    fretL = 42;
    R = 13;
    stringGap = 44;
    nut = 34; // room above for open-string notes
    const side = 38; // room on the left for fret numbers
    across = (s) => side + s * stringGap;
    W = side + 5 * stringGap + 20;
    H = nut + maxFret * fretL + 14;
  } else {
    // Tighten the grid on a full neck so 22 frets stay on screen at a glance.
    fretL = maxFret > 17 ? 34 : 46;
    R = maxFret > 17 ? 9 : 10.5;
    stringGap = 26;
    nut = 34; // room for open-string notes
    const top = 18;
    // string 5 (high E) drawn on top
    across = (s) => top + (5 - s) * stringGap;
    W = nut + (maxFret + 1) * fretL + 10;
    H = top + 5 * stringGap + 34;
  }
  const at = (u: number, v: number) => (vertical ? { x: v, y: u } : { x: u, y: v });
  const fretLine = (f: number) => nut + f * fretL;
  // Fractional frets glide smoothly from the open position into fret 1.
  const fretMid = (f: number) => (f <= 0 ? nut - 14 : f < 1 ? nut - 14 + f * (fretL / 2 + 14) : nut + (f - 0.5) * fretL);
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
    <div className={`${scaled ? "" : "overflow-x-auto"} rounded-2xl border border-neutral-200 bg-neutral-50/60`}>
      <svg
        {...(scaled ? { viewBox: `0 0 ${W} ${H}`, width: "100%" } : { width: W, height: H })}
        className={`block ${vertical ? "mx-auto max-w-sm" : ""}`}>
        {/* frets */}
        {Array.from({ length: maxFret + 1 }, (_, f) => (
          <line
            key={f}
            {...line(fretLine(f), acrossLo, fretLine(f), acrossHi)}
            stroke={f === 0 ? "#3f3f46" : "#d4d4d8"}
            strokeWidth={f === 0 ? 4 : 1.5}
          />
        ))}
        {/* inlays + fret numbers */}
        {INLAYS.filter((f) => f <= maxFret).map((f) => {
          const dots = f === 12
            ? vertical ? [across(1.5), across(3.5)] : [acrossMid, across(3.8)]
            : [acrossMid];
          const num = vertical
            ? { x: 14, y: fretMid(f) + 4 }
            : { x: fretMid(f), y: H - 8 };
          return (
            <g key={f}>
              {dots.map((v, i) => {
                const c = at(fretMid(f), v);
                return <circle key={i} cx={c.x} cy={c.y} r={4.5} fill="#e4e4e7" />;
              })}
              <text x={num.x} y={num.y} textAnchor="middle"
                className="fill-neutral-500" fontSize={11}>{f}</text>
            </g>
          );
        })}
        {/* strings */}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s}
            {...line(nut - 4, across(s), fretLine(maxFret) + fretL * 0.4, across(s))}
            stroke="#8b8b93" strokeWidth={0.8 + (5 - s) * 0.35}
          />
        ))}
        {/* notes */}
        {notes.filter((n) => n.fret <= maxFret).map((n, i) => (
          <g
            key={`${n.string}-${n.fret}-${i}`}
            className="cursor-pointer"
            opacity={n.dim ? 0.28 : 1}
            onClick={() => {
              if (playOnClick) pluck(midiAt(n.string, n.fret));
              onNoteClick?.(n);
            }}
          >
            {n.shape === "diamond" ? (
              <path d={diamond(noteAtPos(n.string, n.fret), R * 1.4)}
                fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} strokeLinejoin="round" />
            ) : (
              <circle cx={noteAtPos(n.string, n.fret).x} cy={noteAtPos(n.string, n.fret).y} r={R}
                fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} />
            )}
            <text x={noteAtPos(n.string, n.fret).x} y={noteAtPos(n.string, n.fret).y + R * 0.34} textAnchor="middle"
              fontSize={R * 0.9} fontWeight={700} fill={inkOn(n.fill)}>{n.label}</text>
          </g>
        ))}
        {activeNote && activeNote.fret <= maxFret && (
          // Keyed so the pop animation restarts on every note of a run.
          <g key={`${activeNote.string}-${activeNote.fret}`} pointerEvents="none">
            <circle
              cx={noteAtPos(activeNote.string, activeNote.fret).x} cy={noteAtPos(activeNote.string, activeNote.fret).y} r={R + 7}
              fill="none" stroke="#18181b" strokeWidth={1.5} opacity={0.4}
            >
              <animate attributeName="r" from={R} to={R + 7} dur="0.16s" fill="freeze" />
              <animate attributeName="opacity" from="0.9" to="0.4" dur="0.16s" fill="freeze" />
            </circle>
            <circle
              cx={noteAtPos(activeNote.string, activeNote.fret).x} cy={noteAtPos(activeNote.string, activeNote.fret).y} r={R + 3}
              fill="none" stroke="#18181b" strokeWidth={3}
            >
              <animate attributeName="r" from={R} to={R + 3} dur="0.16s" fill="freeze" />
            </circle>
          </g>
        )}
        {overlay?.({
          vertical, R, fretL, stringGap, maxFret, at, across, fretLine, fretMid,
          pos: (s, f) => at(fretMid(f), across(s)),
        })}
      </svg>
    </div>
  );
}
