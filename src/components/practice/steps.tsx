import { Dress, compassLines, formulaOf } from "@/lib/compass";
import { DiatonicChord } from "@/lib/harmony";
import { ANY_STRINGS, Rhythm, Segment, shapeLines, toneLines } from "@/lib/lines";
import { RiffNote } from "@/lib/riffs";
import { STRING_SETS } from "@/lib/shapes";
import { Phrase, PracticeCtx, defineStep } from "./types";

/** A chord as a segment: its pitch classes in this key, root first, each named as the chord names it. */
const seg = (ctx: PracticeCtx, c: DiatonicChord): Segment => ({
  pcs: c.tones.map((t) => (ctx.keyPc + t) % 12),
  labels: Object.fromEntries(formulaOf(c, ctx.scale, "chord").tones.map((t) => [t.semis, t.label])),
});
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

/**
 * A step over the progression from a line maker: one line per bar, or —
 * with no progression — the chord in focus on its own. The next bar's first
 * notes are ringed: where the change lands.
 */
function overBars(
  ctx: PracticeCtx, id: string, name: string, make: (bars: Segment[][]) => RiffNote[][],
  numbered = false,
): Phrase {
  const lines = make(barsOf_(ctx, null));
  const many = ctx.progression.length > 0;
  return {
    id, name, roles: true, numbered,
    notesFor: (chord, idx) => (many ? lines[idx % lines.length] : make(barsOf_(ctx, chord))[0]),
    targetAfter: (idx) => (many && lines.length > 1 ? lines[(idx + 1) % lines.length].filter((x) => x.at === 0) : []),
  };
}

const RHYTHMS: { value: Rhythm; label: string }[] = [
  { value: "quarters", label: "♩ one per beat" },
  { value: "eighths", label: "♫ two per beat" },
];

// ---------- Chord tones ----------

export const chordTones = defineStep<{ rhythm: Rhythm }>({
  id: "tones",
  label: "Chord tones",
  how: "Climb and fall through each chord's notes inside the position, starting where the last chord left off. The ringed note is where the next chord begins.",
  initial: { rhythm: "quarters" },
  phrase: (ctx, sel) => overBars(ctx, `tones-${sel.rhythm}`, "Chord tones", (bars) => toneLines(bars, ctx.lo, sel.rhythm)),
  Options: ({ ctx, sel, setSel }) => (
    <Toggle options={RHYTHMS} value={sel.rhythm} onPick={(rhythm) => {
      setSel({ rhythm });
      ctx.preview(chordTones.phrase(ctx, { rhythm }));
    }} />
  ),
});

// ---------- Shapes ----------

const SETS = [{ value: ANY_STRINGS, label: "any strings" }, ...STRING_SETS.map((s) => ({ value: s.low, label: s.label }))];

export const shapes = defineStep<{ low: number }>({
  id: "shapes",
  label: "Triads",
  how: "Each chord as a three-string triad inside the position, the one nearest the last. Watch how little the hand moves between chords.",
  initial: { low: ANY_STRINGS },
  phrase: (ctx, sel) => overBars(ctx, `shapes-${sel.low}`, "Shapes", (bars) => shapeLines(bars, sel.low, ctx.lo)),
  Options: ({ ctx, sel, setSel }) => (
    <Toggle options={SETS} value={sel.low} onPick={(low) => {
      setSel({ low });
      ctx.preview(shapes.phrase(ctx, { low }));
    }} />
  ),
});

// ---------- Intervals ----------

const DRESSES: { value: Dress; label: string }[] = [
  { value: "chord", label: "as played" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "9", label: "9" },
  { value: "11", label: "11" },
];

/** Every bar's compass, or — with no progression — the chord in focus (else I) alone. */
const compassBars = (ctx: PracticeCtx, dress: Dress, alone: DiatonicChord | null) =>
  compassLines(
    ctx.progression.length ? ctx.progression : [[alone ?? ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind })]],
    ctx.keyPc, ctx.scale, ctx.lo, dress,
  );

export const intervals = defineStep<{ dress: Dress }>({
  id: "intervals",
  label: "Intervals",
  how: "Find the major triad on the chord's root, then reach: ♭7 and 7 sit just under the 1, 9 just over it; ♭3 one fret under the 3, 11 one over; 6 two over the 5. Play up the chord and land on the note that names it.",
  initial: { dress: "chord" },
  phrase: (ctx, sel) => {
    const bars = compassBars(ctx, sel.dress, null);
    const many = ctx.progression.length > 0;
    const at = (chord: DiatonicChord | null, idx: number) => (many ? bars[idx % bars.length] : compassBars(ctx, sel.dress, chord)[0]);
    return {
      id: `intervals-${sel.dress}`,
      name: "Intervals",
      numbered: true,
      lands: true,
      notesFor: (chord, idx) => at(chord, idx).notes,
      targetAfter: (idx) => (many && bars.length > 1 ? bars[(idx + 1) % bars.length].notes.slice(0, 1) : []),
      compassFor: (idx) => at(ctx.focus, idx),
    };
  },
  Options: ({ ctx, sel, setSel }) => {
    const chord = ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind });
    const f = formulaOf(chord, ctx.scale, sel.dress);
    return (
      <div className="space-y-2">
        <Toggle options={DRESSES} value={sel.dress} onPick={(dress) => {
          setSel({ dress });
          ctx.preview(intervals.phrase(ctx, { dress }));
        }} />
        {/* The chord in focus as its formula, and the note that names it. */}
        <p className="text-center text-sm text-neutral-600">
          <b className="text-neutral-900">{f.name}</b>
          <span className="mx-2 text-neutral-300">=</span>
          {f.tones.map((t) => (
            <span key={t.semis} className={`mx-0.5 inline-block min-w-6 rounded-md px-1 tabular-nums ${
              t === f.aim ? "bg-neutral-800 font-bold text-neutral-50" : "bg-neutral-100"}`}>{t.label}</span>
          ))}
          <span className="ml-2 text-xs text-neutral-400">land on the {f.aim.label}</span>
        </p>
      </div>
    );
  },
});

/** The steps, in order: a chord's notes, then its triad shapes, then every interval found from the triad. */
export const STEPS = [chordTones, shapes, intervals];
