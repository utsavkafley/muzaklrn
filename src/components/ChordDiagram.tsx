"use client";

import { Chord, chordName, chordShape, midiAt } from "@/lib/theory";
import { strumChord } from "@/lib/audio";

export default function ChordDiagram({ chord, active = false }: { chord: Chord; active?: boolean }) {
  const shape = chordShape(chord);
  const { frets, base } = shape;
  // window of 4 frets shown, starting at `lo`
  const played = frets.filter((f) => f > 0);
  const hasOpen = frets.some((f) => f === 0);
  const lo = !hasOpen && played.length && Math.min(...played) > 1 ? Math.min(...played) : 1;

  const W = 92, H = 112;
  const gridL = 16, gridT = 24, gridW = 62, gridH = 68;
  const colX = (s: number) => gridL + (s * gridW) / 5;
  const rowY = (r: number) => gridT + (r * gridH) / 4;

  const play = () => {
    const midis = frets
      .map((f, s) => (f >= 0 ? midiAt(s, f) : null))
      .filter((m): m is number => m !== null);
    strumChord(midis, undefined, 0.4);
  };

  return (
    <button
      onClick={play}
      className={`rounded-xl border p-1 transition-colors ${
        active
          ? "border-amber-400 bg-amber-400/10"
          : "border-neutral-200 bg-neutral-100/60 hover:border-neutral-400"
      }`}
      title={`${chordName(chord)} — tap to hear`}
    >
      <svg width={W} height={H}>
        <text x={W / 2} y={13} textAnchor="middle" fontSize={12} fontWeight={700}
          className={active ? "fill-amber-600" : "fill-neutral-800"}>
          {chordName(chord)}
        </text>
        {/* nut or fret label */}
        {lo === 1 ? (
          <line x1={gridL} y1={gridT} x2={gridL + gridW} y2={gridT} stroke="#3f3f46" strokeWidth={3} />
        ) : (
          <text x={gridL - 6} y={rowY(0) + 14} textAnchor="end" fontSize={9} className="fill-neutral-600">
            {lo}fr
          </text>
        )}
        {Array.from({ length: 5 }, (_, r) => (
          <line key={r} x1={gridL} y1={rowY(r)} x2={gridL + gridW} y2={rowY(r)} stroke="#c4c4c8" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s} x1={colX(s)} y1={gridT} x2={colX(s)} y2={gridT + gridH} stroke="#c4c4c8" strokeWidth={1} />
        ))}
        {frets.map((f, s) => {
          if (f < 0)
            return <text key={s} x={colX(s)} y={gridT - 4} textAnchor="middle" fontSize={9} className="fill-neutral-500">✕</text>;
          if (f === 0)
            return <circle key={s} cx={colX(s)} cy={gridT - 7} r={3.2} fill="none" stroke="#71717a" strokeWidth={1.2} />;
          const row = f - lo; // 0-based row within window
          return (
            <circle key={s} cx={colX(s)} cy={rowY(row) + gridH / 8} r={5.5}
              fill={active ? "#fbbf24" : "#3f3f46"} />
          );
        })}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={8} className="fill-neutral-500">
          tap to hear
        </text>
      </svg>
    </button>
  );
}
