import { DiatonicChord } from "@/lib/harmony";
import { Rhythm, Segment, shapeLines, toneLines } from "@/lib/lines";
import { Riff, barsOf, licksFor, riffsFor, shifted } from "@/lib/riffs";
import { STRING_SETS } from "@/lib/shapes";
import { PracticeCtx, defineStep } from "./types";

const MAX_FRET = 15;

/** A chord as a segment: its pitch classes in this key, root first. */
const seg = (ctx: PracticeCtx, c: DiatonicChord): Segment => ({ pcs: c.tones.map((t) => (ctx.keyPc + t) % 12) });
/** The progression as segments, or — with none — the chord in focus (else I) on its own. */
const barsOf_ = (ctx: PracticeCtx, alone: DiatonicChord | null): Segment[][] =>
  ctx.progression.length
    ? ctx.progression.map((cs) => cs.map((c) => seg(ctx, c)))
    : [[seg(ctx, alone ?? ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind }))]];

function Toggle<T extends string | number>({ options, value, onPick }: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1 text-sm">
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onPick(o.value)} aria-pressed={value === o.value}
          className={`rounded-full px-3 py-1 transition-colors ${
            value === o.value ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Chord tones ----------

const RHYTHMS: { value: Rhythm; label: string }[] = [
  { value: "quarters", label: "♩ one per beat" },
  { value: "eighths", label: "♫ two per beat" },
];

export const chordTones = defineStep<{ rhythm: Rhythm }>({
  id: "tones",
  label: "Chord tones",
  how: "Play each chord's notes inside the position, starting where the last chord left off. The ringed note is where the next chord begins — the nearest one.",
  initial: { rhythm: "quarters" },
  phrase: (ctx, sel) => {
    const lines = toneLines(barsOf_(ctx, null), ctx.lo, sel.rhythm);
    const many = ctx.progression.length > 0;
    return {
      id: `tones-${sel.rhythm}`,
      name: "Chord tones",
      roles: true,
      numbered: false,
      notesFor: (chord, idx) => (many ? lines[idx % lines.length] : toneLines(barsOf_(ctx, chord), ctx.lo, sel.rhythm)[0]),
      targetAfter: (idx) => (many && lines.length > 1 ? lines[(idx + 1) % lines.length].slice(0, 1) : []),
    };
  },
  Options: ({ ctx, sel, setSel }) => (
    <Toggle options={RHYTHMS} value={sel.rhythm} onPick={(rhythm) => {
      setSel({ rhythm });
      ctx.preview(chordTones.phrase(ctx, { rhythm }));
    }} />
  ),
});

// ---------- Shapes ----------

export const shapes = defineStep<{ low: number }>({
  id: "shapes",
  label: "Shapes",
  how: "Each chord as three notes on three strings, the shape nearest the last one. Watch how little the hand moves between chords.",
  initial: { low: 3 },
  phrase: (ctx, sel) => {
    const lines = shapeLines(barsOf_(ctx, null), sel.low, ctx.lo);
    const many = ctx.progression.length > 0;
    return {
      id: `shapes-${sel.low}`,
      name: "Shapes",
      roles: true,
      numbered: false,
      notesFor: (chord, idx) => (many ? lines[idx % lines.length] : shapeLines(barsOf_(ctx, chord), sel.low, ctx.lo)[0]),
      targetAfter: (idx) => (many && lines.length > 1 ? lines[(idx + 1) % lines.length].filter((x) => x.at === 0) : []),
    };
  },
  Options: ({ ctx, sel, setSel }) => (
    <Toggle options={STRING_SETS.map((s) => ({ value: s.low, label: s.label }))} value={sel.low} onPick={(low) => {
      setSel({ low });
      ctx.preview(shapes.phrase(ctx, { low }));
    }} />
  ),
});

// ---------- Phrases ----------

/** 1 to 3: how much there is to a phrase — notes, techniques, bars. */
function difficulty(r: Riff): number {
  const tech = r.notes.filter((x) => x.tech).length;
  const score = r.notes.length + tech * 2 + (barsOf(r.notes) - 1) * 4;
  return score < 9 ? 1 : score < 15 ? 2 : 3;
}

/** Riffs and licks for the mode, easiest first. */
const phrasesFor = (ctx: PracticeCtx) =>
  ctx.mode
    ? [...riffsFor(ctx.mode.id), ...licksFor(ctx.mode.id)].sort((a, b) => difficulty(a) - difficulty(b))
    : [];

/**
 * Slide a phrase (written in A) to the key, `extra` semitones higher when it
 * moves with a chord, and to whichever octave sits nearest the position.
 */
function shiftNear(r: Riff, keyPc: number, extra: number, lo: number): number {
  const frets = r.notes.flatMap((x) => (x.to === undefined ? [x.fret] : [x.fret, x.to]));
  const centre = frets.reduce((a, b) => a + b, 0) / frets.length;
  const d = (((keyPc - 9 + extra) % 12) + 12) % 12;
  const fits = (s: number) => frets.every((f) => f + s >= 0 && f + s <= MAX_FRET);
  const options = [d - 12, d, d + 12].filter(fits);
  if (!options.length) return d;
  return options.reduce((a, b) => (Math.abs(centre + a - (lo + 2)) <= Math.abs(centre + b - (lo + 2)) ? a : b));
}

export const phrases = defineStep<{ id: string | null; move: boolean }>({
  id: "phrases",
  label: "Phrases",
  how: "Riffs and licks for this mode, easiest first. Licks end on the root — the ringed note. Turn on “move with chords” to carry one through the progression.",
  initial: { id: null, move: false },
  phrase: (ctx, sel) => {
    const r = phrasesFor(ctx).find((x) => x.id === sel.id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      lands: r.lands,
      numbered: true,
      notesFor: (chord) => shifted(r, shiftNear(r, ctx.keyPc, sel.move && chord ? chord.semis : 0, ctx.lo)),
    };
  },
  Options: ({ ctx, sel, setSel }) => {
    if (!ctx.mode) return <p className="text-center text-sm text-neutral-500">Pick a mode to see its riffs and licks.</p>;
    const list = phrasesFor(ctx);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          {list.map((r) => {
            const on = sel.id === r.id;
            const d = difficulty(r);
            return (
              <button key={r.id} aria-pressed={on}
                onClick={() => {
                  const next = { ...sel, id: on ? null : r.id };
                  setSel(next);
                  if (!on) ctx.preview(phrases.phrase(ctx, next));
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  on ? "bg-neutral-800 text-neutral-50" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}>
                <span aria-label={`difficulty ${d} of 3`} className="flex gap-0.5">
                  {[1, 2, 3].map((k) => (
                    <span key={k} className={`h-1.5 w-1.5 rounded-full ${k <= d ? (on ? "bg-neutral-50" : "bg-neutral-600") : on ? "bg-neutral-600" : "bg-neutral-300"}`} />
                  ))}
                </span>
                {r.name}
                <span className={`text-xs ${on ? "text-neutral-300" : "text-neutral-400"}`}>{r.lands ? "lick" : "riff"}</span>
              </button>
            );
          })}
        </div>
        <label className="flex items-center justify-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={sel.move} onChange={(e) => setSel({ ...sel, move: e.target.checked })}
            className="accent-neutral-800" />
          move with chords
        </label>
      </div>
    );
  },
});

/** The steps, in order: the ladder from chord notes to whole phrases. */
export const STEPS = [chordTones, shapes, phrases];
