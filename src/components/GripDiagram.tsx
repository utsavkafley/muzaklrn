import { Grip } from "@/lib/harmony";

/**
 * A chord box for one fingering: strings low E to high E left to right, a
 * four-fret window, dots coloured by `fillFor` so the grip speaks the same
 * colour language as the neck.
 */
export default function GripDiagram({ grip, label, fillFor }: {
  grip: Grip;
  label: string;
  fillFor: (string: number, fret: number) => string;
}) {
  const pressed = grip.filter((f) => f > 0);
  // Start at the nut if the grip fits there, otherwise at its lowest fret.
  const lo = pressed.length && Math.max(...pressed) > 4 ? Math.min(...pressed) : 1;

  const W = 92, H = 100;
  const gridL = 18, gridT = 22, gridW = 60, gridH = 64;
  const colX = (s: number) => gridL + (s * gridW) / 5;
  const rowY = (r: number) => gridT + (r * gridH) / 4;

  return (
    <figure className="flex flex-col items-center">
      <svg width={W} height={H} aria-hidden>
        {lo === 1 ? (
          <line x1={gridL} y1={gridT} x2={gridL + gridW} y2={gridT} stroke="#3f3f46" strokeWidth={3} />
        ) : (
          <text x={gridL - 5} y={rowY(0) + 12} textAnchor="end" fontSize={9} className="fill-neutral-500">{lo}fr</text>
        )}
        {Array.from({ length: 5 }, (_, r) => (
          <line key={r} x1={gridL} y1={rowY(r)} x2={gridL + gridW} y2={rowY(r)} stroke="#d4d4d8" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={s} x1={colX(s)} y1={gridT} x2={colX(s)} y2={gridT + gridH} stroke="#a1a1aa" strokeWidth={1} />
        ))}
        {grip.map((f, s) => {
          if (f < 0) {
            return <text key={s} x={colX(s)} y={gridT - 5} textAnchor="middle" fontSize={9} className="fill-neutral-400">✕</text>;
          }
          if (f === 0) {
            return <circle key={s} cx={colX(s)} cy={gridT - 8} r={3.4} fill="none" stroke={fillFor(s, 0)} strokeWidth={2} />;
          }
          return (
            <circle key={s} cx={colX(s)} cy={rowY(f - lo) + gridH / 8} r={5.5}
              fill={fillFor(s, f)} stroke="#18181b" strokeWidth={0.75} />
          );
        })}
      </svg>
      <figcaption className="text-xs text-neutral-500">{label}</figcaption>
    </figure>
  );
}
