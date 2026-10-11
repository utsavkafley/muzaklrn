import { DiatonicChord } from "@/lib/harmony";
import { ARP_PATTERNS, ArpPattern, arpeggio, homeFret } from "@/lib/shapes";
import ChordPicker from "./ChordPicker";
import { Phrase, StudyCtx, defineModule } from "./types";

interface Sel {
  degree: number;
  pattern: ArpPattern;
}

const pcsOf = (ctx: StudyCtx, c: DiatonicChord) => c.tones.map((t) => (ctx.keyPc + t) % 12);
const chosen = (ctx: StudyCtx, sel: Sel) =>
  ctx.chords[sel.degree] ?? ctx.chordOf({ degree: sel.degree, kind: "triad" });

/**
 * A chord's notes one at a time, in the key's home position. Following a
 * progression it stays in that position and plays each bar's chord there —
 * the way to find every chord inside one box instead of jumping around.
 */
function phrase(ctx: StudyCtx, sel: Sel): Phrase {
  const c = chosen(ctx, sel);
  return {
    id: `arp-${sel.degree}-${c.kind}-${sel.pattern}`,
    name: `${c.name} arpeggio`,
    notesFor: (bar) => arpeggio(pcsOf(ctx, bar ?? c), homeFret(ctx.keyPc), sel.pattern),
  };
}

export const arpeggioModule = defineModule<Sel>({
  id: "arpeggios",
  label: "Arpeggios",
  initial: { degree: 0, pattern: "up-back" },
  phrase,
  Panel: ({ ctx, sel, setSel }) => {
    const pick = (next: Sel) => {
      setSel(next);
      ctx.preview(phrase(ctx, next));
    };
    const c = chosen(ctx, sel);
    return (
      <div className="space-y-3">
        <ChordPicker chords={ctx.chords} degree={sel.degree} onPick={(degree) => pick({ ...sel, degree })} />
        <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
          {ARP_PATTERNS.map((p) => (
            <button key={p.pattern} onClick={() => pick({ ...sel, pattern: p.pattern })} aria-pressed={sel.pattern === p.pattern}
              className={`rounded-full px-3 py-1 transition-colors ${
                sel.pattern === p.pattern ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-neutral-600">
          <span className="font-bold text-neutral-900">{c.name}</span>
          {" "}— {c.tones.length === 4 ? "root, 3rd, 5th and 7th" : c.kind === "triad" ? "root, 3rd and 5th" : c.kind === "sus2" ? "root, 2nd and 5th" : "root, 4th and 5th"},
          one at a time, all inside one hand position. The chord-type switch above changes it to a 7th or a sus.
        </p>
      </div>
    );
  },
});
