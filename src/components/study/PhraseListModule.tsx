import { Riff, licksFor, riffShift, riffsFor, shifted } from "@/lib/riffs";
import { ModeId } from "@/lib/modes";
import { Phrase, StudyCtx, defineModule } from "./types";

const MAX_FRET = 15;

/** A hand-written riff or lick as a phrase: slid as one shape to the key, or to the bar's chord. */
export function riffPhrase(r: Riff, keyPc: number): Phrase {
  return {
    id: r.id,
    name: r.name,
    lands: r.lands,
    notesFor: (chord) => shifted(r, riffShift(r, keyPc, chord ? chord.semis : 0, MAX_FRET)),
  };
}

/**
 * A module that offers a list of hand-written phrases for the mode: riffs or
 * licks. Tapping one plays it once and puts it on the neck; tapping it again
 * puts it away.
 */
function phraseList(id: string, label: string, listFor: (m: ModeId) => Riff[], empty: string) {
  const phrase = (ctx: StudyCtx, sel: string | null) => {
    const r = ctx.mode ? listFor(ctx.mode.id).find((x) => x.id === sel) : undefined;
    return r ? riffPhrase(r, ctx.keyPc) : null;
  };
  return defineModule<string | null>({
    id, label, initial: null, phrase,
    Panel: ({ ctx, sel, setSel }) => {
      if (!ctx.mode) return <p className="text-center text-sm text-neutral-500">{empty}</p>;
      const list = listFor(ctx.mode.id);
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {list.map((r) => {
            const on = sel === r.id;
            return (
              <button key={r.id} aria-pressed={on}
                onClick={() => {
                  setSel(on ? null : r.id);
                  if (!on) ctx.preview(riffPhrase(r, ctx.keyPc));
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  on ? "bg-neutral-800 text-neutral-50" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}>
                {r.name}
              </button>
            );
          })}
        </div>
      );
    },
  });
}

export const riffsModule = phraseList("riffs", "Riffs", riffsFor, "Pick a mode to see its riffs.");
export const licksModule = phraseList("licks", "Licks", licksFor, "Pick a mode to see its licks.");
