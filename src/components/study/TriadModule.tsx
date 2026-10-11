import { DiatonicChord } from "@/lib/harmony";
import { INVERSION, STRING_SETS, triadPhrase, triadShapes } from "@/lib/shapes";
import ChordPicker from "./ChordPicker";
import { Phrase, StudyCtx, defineModule } from "./types";

interface Sel {
  degree: number;
  /** Lowest string of the three. */
  low: number;
}

/** A triad is three notes: a seventh chord gives up its 7th here. */
const pcsOf = (ctx: StudyCtx, c: DiatonicChord) => c.tones.slice(0, 3).map((t) => (ctx.keyPc + t) % 12);
const chosen = (ctx: StudyCtx, sel: Sel) =>
  ctx.chords[sel.degree] ?? ctx.chordOf({ degree: sel.degree, kind: "triad" });

/**
 * The same three notes, stacked three ways, climbing the neck on one set of
 * strings. Following a progression, each bar gets its own chord's shapes —
 * look for the shape of the next chord sitting right beside the last one.
 */
function phrase(ctx: StudyCtx, sel: Sel): Phrase {
  const c = chosen(ctx, sel);
  return {
    id: `triad-${sel.degree}-${sel.low}`,
    name: `${c.name} triads`,
    notesFor: (bar) => triadPhrase(triadShapes(pcsOf(ctx, bar ?? c), sel.low), sel.low),
  };
}

const TONE = ["root", "3rd", "5th"];

export const triadModule = defineModule<Sel>({
  id: "triads",
  label: "Triads",
  initial: { degree: 0, low: 3 },
  phrase,
  Panel: ({ ctx, sel, setSel }) => {
    const pick = (next: Sel) => {
      setSel(next);
      ctx.preview(phrase(ctx, next));
    };
    const c = chosen(ctx, sel);
    const shapes = triadShapes(pcsOf(ctx, c), sel.low).slice(0, 8);
    const third = c.tones[1] - c.tones[0];
    const tone = (inv: number, k: number) => {
      // Which chord tone sits on string k of a shape in this inversion.
      const name = TONE[(inv + k) % 3];
      return c.kind === "sus2" && name === "3rd" ? "2nd" : c.kind === "sus4" && name === "3rd" ? "4th" : name;
    };
    return (
      <div className="space-y-3">
        <ChordPicker chords={ctx.chords} degree={sel.degree} onPick={(degree) => pick({ ...sel, degree })} />
        <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
          {STRING_SETS.map((s) => (
            <button key={s.low} onClick={() => pick({ ...sel, low: s.low })} aria-pressed={sel.low === s.low}
              className={`rounded-full px-3 py-1 transition-colors ${
                sel.low === s.low ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-neutral-600">
          <span className="font-bold text-neutral-900">{c.name}</span> is three notes —{" "}
          {c.kind === "sus2" || c.kind === "sus4" ? "root, " + (c.kind === "sus2" ? "2nd" : "4th") + " and 5th"
            : `root, a ${third === 4 ? "major" : "minor"} 3rd, and the 5th`}. Stack them
          three ways and you get three shapes that repeat up the neck: whichever note is lowest names the shape.
        </p>
        <ol className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-neutral-600">
          {shapes.map((sh, i) => (
            <li key={i}>
              <span className="font-bold text-neutral-900">{i + 1}</span> {INVERSION[sh.inversion]}
              <span className="text-neutral-400"> · {tone(sh.inversion, 0)} low, {tone(sh.inversion, 2)} on top · fret {Math.min(...sh.frets)}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  },
});
