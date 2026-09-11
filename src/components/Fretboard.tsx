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

export default function Fretboard({ notes, maxFret = 17, onNoteClick, playOnClick = true, activeNote }: Props) {
  const fretW = 46;
  const stringGap = 26;
  const left = 34; // room for open-string notes
  const top = 18;
  const W = left + (maxFret + 1) * fretW + 10;
  const H = top + 5 * stringGap + 34;

  const fretX = (f: number) => (f === 0 ? left - 14 : left + (f - 0.5) * fretW);
  // string 5 (high E) drawn on top
  const stringY = (s: number) => top + (5 - s) * stringGap;

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/60">
      <svg width={W} height={H} className="block">
        {/* frets */}
        {Array.from({ length: maxFret + 1 }, (_, f) => (
          <line
            key={f}
            x1={left + f * fretW} y1={top}
            x2={left + f * fretW} y2={top + 5 * stringGap}
            stroke={f === 0 ? "#d4d4d4" : "#3f3f46"}
            strokeWidth={f === 0 ? 4 : 1.5}
          />
        ))}
        {/* inlays + fret numbers */}
        {INLAYS.filter((f) => f <= maxFret).map((f) => (
          <g key={f}>
            <circle cx={left + (f - 0.5) * fretW} cy={top + 2.5 * stringGap} r={4.5}
              fill="#27272a" />
            {f === 12 && (
              <circle cx={left + (f - 0.5) * fretW} cy={top + 1.2 * stringGap} r={4.5} fill="#27272a" />
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
            stroke="#71717a" strokeWidth={0.8 + (5 - s) * 0.35}
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
            <circle cx={fretX(n.fret)} cy={stringY(n.string)} r={10.5}
              fill={n.fill} stroke={n.ring ?? "transparent"} strokeWidth={2.5} />
            <text x={fretX(n.fret)} y={stringY(n.string) + 3.5} textAnchor="middle"
              fontSize={9.5} fontWeight={700} fill="#0a0a0a">{n.label}</text>
          </g>
        ))}
        {activeNote && activeNote.fret <= maxFret && (
          <circle
            cx={fretX(activeNote.fret)} cy={stringY(activeNote.string)} r={10.5}
            fill="none" stroke="#ffffff" strokeWidth={2.5}
            className="animate-ping"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}
      </svg>
    </div>
  );
}
