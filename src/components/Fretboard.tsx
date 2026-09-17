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
}

interface Props {
  notes: FbNote[];
  maxFret?: number;
  onNoteClick?: (n: FbNote) => void;
  playOnClick?: boolean;
  /** string/fret currently sounding — gets a pulsing ring, e.g. during scheduled playback */
  activeNote?: { string: number; fret: number } | null;
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

export default function Fretboard({ notes, maxFret = 22, onNoteClick, playOnClick = true, activeNote }: Props) {
  // Tighten the grid on a full neck so 22 frets stay on screen at a glance.
  const fretW = maxFret > 17 ? 34 : 46;
  const R = maxFret > 17 ? 9 : 10.5; // note radius
  const stringGap = 26;
  const left = 34; // room for open-string notes
  const top = 18;
  const W = left + (maxFret + 1) * fretW + 10;
  const H = top + 5 * stringGap + 34;

  const fretX = (f: number) => (f === 0 ? left - 14 : left + (f - 0.5) * fretW);
  // string 5 (high E) drawn on top
  const stringY = (s: number) => top + (5 - s) * stringGap;

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-neutral-50/60">
      <svg width={W} height={H} className="block">
        {/* frets */}
        {Array.from({ length: maxFret + 1 }, (_, f) => (
          <line
            key={f}
            x1={left + f * fretW} y1={top}
            x2={left + f * fretW} y2={top + 5 * stringGap}
            stroke={f === 0 ? "#3f3f46" : "#d4d4d8"}
            strokeWidth={f === 0 ? 4 : 1.5}
          />
        ))}
        {/* inlays + fret numbers */}
        {INLAYS.filter((f) => f <= maxFret).map((f) => (
          <g key={f}>
            <circle cx={left + (f - 0.5) * fretW} cy={top + 2.5 * stringGap} r={4.5}
              fill="#e4e4e7" />
            {f === 12 && (
              <circle cx={left + (f - 0.5) * fretW} cy={top + 1.2 * stringGap} r={4.5} fill="#e4e4e7" />
            )}
            <text x={left + (f - 0.5) * fretW} y={H - 8} textAnchor="middle"
              className="fill-neutral-500" fontSize={11}>{f}</text>
          </g>
        ))}
        {/* strings */}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s}
            x1={left - 4} y1={stringY(s)}
            x2={left + maxFret * fretW + fretW * 0.4} y2={stringY(s)}
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
            <circle cx={fretX(n.fret)} cy={stringY(n.string)} r={R}
              fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} />
            <text x={fretX(n.fret)} y={stringY(n.string) + R * 0.34} textAnchor="middle"
              fontSize={R * 0.9} fontWeight={700} fill={inkOn(n.fill)}>{n.label}</text>
          </g>
        ))}
        {activeNote && activeNote.fret <= maxFret && (
          // Keyed so the pop animation restarts on every note of a run.
          <g key={`${activeNote.string}-${activeNote.fret}`} pointerEvents="none">
            <circle
              cx={fretX(activeNote.fret)} cy={stringY(activeNote.string)} r={R + 7}
              fill="none" stroke="#18181b" strokeWidth={1.5} opacity={0.4}
            >
              <animate attributeName="r" from={R} to={R + 7} dur="0.16s" fill="freeze" />
              <animate attributeName="opacity" from="0.9" to="0.4" dur="0.16s" fill="freeze" />
            </circle>
            <circle
              cx={fretX(activeNote.fret)} cy={stringY(activeNote.string)} r={R + 3}
              fill="none" stroke="#18181b" strokeWidth={3}
            >
              <animate attributeName="r" from={R} to={R + 3} dur="0.16s" fill="freeze" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
}
