import { DiatonicChord, MOOD_FILL } from "@/lib/harmony";

/** The seven chords of the key as small mood-coloured pills; one is chosen. */
export default function ChordPicker({ chords, degree, onPick }: {
  chords: (DiatonicChord | null)[];
  degree: number;
  onPick: (degree: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {chords.map((c, i) => c ? (
        <button key={i} onClick={() => onPick(i)} aria-pressed={degree === i}
          style={{ background: MOOD_FILL[c.mood] }}
          className={`min-w-11 rounded-lg px-2 py-1 text-sm font-bold text-neutral-950 transition-shadow ${
            degree === i ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50" : ""
          }`}>
          {c.numeral}
        </button>
      ) : (
        <span key={i} aria-hidden className="min-w-11 rounded-lg border border-dashed border-neutral-200 px-2 py-1 text-center text-sm text-neutral-300">–</span>
      ))}
    </div>
  );
}
