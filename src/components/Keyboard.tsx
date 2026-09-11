"use client";

import { pluck } from "@/lib/audio";

export interface KeyNote {
  midi: number;
  label: string;
  fill: string;
  ring?: string;
  dim?: boolean;
}

interface Props {
  notes: KeyNote[];
  startMidi?: number; // default C4
  octaves?: number;
  onKeyClick?: (n: KeyNote) => void;
  playOnClick?: boolean;
}

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B, semitones from octave root
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]); // black key sits after these white-key indices

export default function Keyboard({
  notes, startMidi = 60, octaves = 2, onKeyClick, playOnClick = true,
}: Props) {
  const WKW = 42, WKH = 152, BKW = 26, BKH = 94;
  const totalWhite = octaves * 7 + 1; // trailing C
  const W = totalWhite * WKW;
  const H = WKH;

  const byMidi = new Map(notes.map((n) => [n.midi, n]));

  const whiteKeys: { midi: number; x: number; letter: string }[] = [];
  let wi = 0;
  for (let o = 0; o <= octaves; o++) {
    for (let i = 0; i < 7; i++) {
      if (o === octaves && i > 0) break;
      whiteKeys.push({ midi: startMidi + o * 12 + WHITE_OFFSETS[i], x: wi * WKW, letter: "CDEFGAB"[i] });
      wi++;
    }
  }
  const blackKeys: { midi: number; x: number }[] = [];
  wi = 0;
  for (let o = 0; o < octaves; o++) {
    for (let i = 0; i < 7; i++) {
      if (BLACK_AFTER.has(i)) {
        blackKeys.push({ midi: startMidi + o * 12 + WHITE_OFFSETS[i] + 1, x: (wi + 1) * WKW - BKW / 2 });
      }
      wi++;
    }
  }

  const press = (midi: number) => {
    if (playOnClick) pluck(midi, undefined, 1.1, 0.45);
    const n = byMidi.get(midi);
    if (n) onKeyClick?.(n);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2">
      <svg width={W} height={H} className="block">
        {whiteKeys.map((k) => {
          const n = byMidi.get(k.midi);
          return (
            <g key={`w${k.midi}`} className="cursor-pointer" onClick={() => press(k.midi)}>
              <rect x={k.x} y={0} width={WKW - 1.5} height={WKH} rx={5}
                fill={n ? n.fill : "#f5f5f4"} opacity={n?.dim ? 0.5 : 1}
                stroke={n?.ring ?? "#a3a3a3"} strokeWidth={n?.ring ? 3 : 1} />
              {n && (
                <text x={k.x + (WKW - 1.5) / 2} y={WKH - 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0a0a0a">
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
        {blackKeys.map((k) => {
          const n = byMidi.get(k.midi);
          return (
            <g key={`b${k.midi}`} className="cursor-pointer" onClick={() => press(k.midi)}>
              <rect x={k.x} y={0} width={BKW} height={BKH} rx={3}
                fill={n ? n.fill : "#18181b"} opacity={n?.dim ? 0.5 : 1}
                stroke={n?.ring ?? "#000"} strokeWidth={n?.ring ? 3 : 1} />
              {n && (
                <text x={k.x + BKW / 2} y={BKH - 10} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fafafa">
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
