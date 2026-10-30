import { LOW, compassLines, formulaOf, reachSpot, reachWords } from "@/lib/compass";
import { DiatonicChord } from "@/lib/harmony";
import { ANY_STRINGS, NEAREST, Placed, Rhythm, Segment, placeShapes, shapeLines, shapeOrder, toneLines } from "@/lib/lines";
import { RiffNote } from "@/lib/riffs";
import { STRING_SETS } from "@/lib/shapes";
import { pitchAt } from "@/lib/theory";
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
  how: "Each chord's notes inside the frame, starting where the last chord left off. The ringed note is where the next chord begins.",
  initial: { rhythm: "quarters" },
  phrase: (ctx, sel) => overBars(ctx, `tones-${sel.rhythm}`, "Chord tones", (bars) => toneLines(bars, ctx.lo, sel.rhythm)),
  Options: ({ ctx, sel, setSel }) => (
    <Toggle options={RHYTHMS} value={sel.rhythm} onPick={(rhythm) => {
      setSel({ rhythm });
      ctx.preview(chordTones.phrase(ctx, { rhythm }));
    }} />
  ),
});

// ---------- Triads ----------

const SETS = [{ value: ANY_STRINGS, label: "any strings" }, ...STRING_SETS.map((s) => ({ value: s.low, label: s.label }))];
const BOTTOMS = [
  { value: NEAREST, label: "nearest" },
  { value: 0, label: "1 low" },
  { value: 1, label: "3 low" },
  { value: 2, label: "5 low" },
];

interface ShapeSel { low: number; bottom: number }

/**
 * Which triad shape: on which strings, and which note lowest. The strings
 * keep the hand in one place; the lowest note fixes one grip, to learn it
 * chord after chord.
 */
function ShapePicker({ sel, onPick }: { sel: ShapeSel; onPick: (s: ShapeSel) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <Toggle options={SETS} value={sel.low} onPick={(low) => onPick({ ...sel, low })} />
      <span aria-hidden className="h-4 w-px bg-neutral-200" />
      <Toggle options={BOTTOMS} value={sel.bottom} onPick={(bottom) => onPick({ ...sel, bottom })} />
    </div>
  );
}

/** The shape on show, named: its strings, and its notes low to high. */
function ShapeName({ seg, placed }: { seg: Segment | undefined; placed: Placed | null | undefined }) {
  if (!seg || !placed) return null;
  const strings = STRING_SETS.find((x) => x.low === placed.s)?.label;
  return (
    <p className="text-center text-xs text-neutral-500">
      shape <b className="text-neutral-800">{strings}</b>
      <span className="mx-1.5 text-neutral-300">·</span>
      <span className="tabular-nums text-neutral-800">{shapeOrder(seg, placed)}</span>
      <span className="ml-1.5 text-neutral-400">low to high</span>
    </p>
  );
}

export const shapes = defineStep<ShapeSel>({
  id: "shapes",
  label: "Triads",
  how: "Each chord as a three-string triad inside the frame. Nearest barely moves the hand; a lowest note fixes one shape to learn.",
  initial: { low: ANY_STRINGS, bottom: NEAREST },
  phrase: (ctx, sel) => overBars(ctx, `shapes-${sel.low}-${sel.bottom}`, "Shapes", (bars) => shapeLines(bars, sel.low, ctx.lo, sel.bottom)),
  Options: ({ ctx, sel, setSel }) => {
    const bars = barsOf_(ctx, null);
    const idx = ctx.bar % bars.length;
    const placed = placeShapes(bars, sel.low, ctx.lo, sel.bottom)[idx]?.[0];
    return (
      <div className="space-y-2">
        <ShapePicker sel={sel} onPick={(next) => {
          setSel(next);
          ctx.preview(shapes.phrase(ctx, next));
        }} />
        <ShapeName seg={bars[idx]?.[0]} placed={placed} />
      </div>
    );
  },
});

// ---------- Intervals ----------

/** Every bar's compass, or — with no progression — the chord in focus (else I) alone. */
const compassBars = (ctx: PracticeCtx, sel: ShapeSel, alone: DiatonicChord | null) =>
  compassLines(
    ctx.progression.length ? ctx.progression : [[alone ?? ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind })]],
    ctx.keyPc, ctx.scale, ctx.lo, "chord", sel.low, sel.bottom,
  );

/** The chord on the neck, and its root's pitch class. */
const onShow = (ctx: PracticeCtx) => {
  const chord = ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind });
  return { chord, root: (ctx.keyPc + chord.semis) % 12 };
};

/**
 * The drill: the triad is on the neck, one interval is named, you tap
 * where it is. Asked from the chord's own colour notes (its ♭3, ♭7, 9…) or
 * from any interval at all.
 */
interface Quiz {
  pool: "chord" | "any";
  /** The interval asked for, in semitones above the root. */
  ask: number;
  /** Where you tapped, once you have. */
  tapped: { string: number; fret: number } | null;
  right: number;
  asked: number;
}

interface IntervalSel extends ShapeSel { quiz: Quiz | null }

/** Every interval that isn't the major triad itself: each one a reach from it. */
const REACHES = [1, 2, 3, 5, 6, 8, 9, 10, 11];

/** The chord's own name for an interval (its 9, its 11), else the plain one. */
const nameOf = (ctx: PracticeCtx, semis: number) =>
  formulaOf(onShow(ctx).chord, ctx.scale, "chord").tones.find((t) => t.semis === semis)?.label ?? LOW[semis];

/** The next interval to ask for: a different one from the last, from the pool. */
function nextAsk(ctx: PracticeCtx, pool: Quiz["pool"], last: number | null): number {
  const colour = formulaOf(onShow(ctx).chord, ctx.scale, "chord").tones.map((t) => t.semis).filter((x) => REACHES.includes(x));
  const from = pool === "chord" && colour.length ? colour : REACHES;
  const fresh = from.length > 1 ? from.filter((x) => x !== last) : from;
  return fresh[Math.floor(Math.random() * fresh.length)];
}

const MODES = [{ value: "watch", label: "watch" }, { value: "find", label: "find it" }];
const POOLS: { value: Quiz["pool"]; label: string }[] = [
  { value: "chord", label: "its notes" },
  { value: "any", label: "any interval" },
];

export const intervals = defineStep<IntervalSel>({
  id: "intervals",
  label: "Intervals",
  how: "Find the major triad on the chord's root, then reach a fret or two: twos and sevens around the 1, the ♭3 and 4 around the 3, sixes around the 5.",
  // His first shape: the 1 3 5 on the D, G and B strings, out of the E-shape barre.
  initial: { low: 2, bottom: NEAREST, quiz: null },
  phrase: (ctx, sel) => {
    const bars = compassBars(ctx, sel, null);
    const many = ctx.progression.length > 0;
    const at = (chord: DiatonicChord | null, idx: number) => (many ? bars[idx % bars.length] : compassBars(ctx, sel, chord)[0]);
    const q = sel.quiz;
    if (q) {
      // The drill: only the triad, until you answer; then where you tapped,
      // and — if that wasn't it — where it is, reached from the triad.
      const sh = at(ctx.focus, ctx.bar).shapes[0];
      const { root } = onShow(ctx);
      const notes: RiffNote[] = sh
        ? sh.frets.map((f, i) => ({ at: i * 2, len: 2, string: sh.s + i, fret: f, label: LOW[(pitchAt(sh.s + i, f) - root + 12) % 12] }))
        : [];
      let reaches: { from: { string: number; fret: number }; to: { string: number; fret: number } }[] = [];
      if (q.tapped && sh) {
        const spot = reachSpot(sh, root, q.ask);
        const got = (pitchAt(q.tapped.string, q.tapped.fret) - root + 12) % 12;
        notes.push({ at: 6, len: 2, ...q.tapped, label: got === q.ask ? nameOf(ctx, q.ask) : LOW[got] });
        if (got !== q.ask) notes.push({ at: 6, len: 2, string: spot.string, fret: spot.fret, label: nameOf(ctx, q.ask) });
        reaches = [{ from: spot.from, to: spot }];
      }
      return {
        id: `find-${sel.low}-${sel.bottom}-${q.ask}-${q.tapped ? "a" : "q"}`,
        name: "Find it",
        bare: true,
        numbered: false,
        notesFor: () => notes,
        compassFor: () => ({ ghosts: [], reaches }),
      };
    }
    return {
      id: `intervals-${sel.low}-${sel.bottom}`,
      name: "Intervals",
      numbered: true,
      lands: true,
      notesFor: (chord, idx) => at(chord, idx).notes,
      targetAfter: (idx) => (many && bars.length > 1 ? bars[(idx + 1) % bars.length].notes.slice(0, 1) : []),
      compassFor: (idx) => at(ctx.focus, idx),
    };
  },
  tap: (ctx, sel, at) => {
    const q = sel.quiz;
    if (!q) return undefined;
    // Answered: the next tap moves on.
    if (q.tapped) return { ...sel, quiz: { ...q, ask: nextAsk(ctx, q.pool, q.ask), tapped: null } };
    const right = (pitchAt(at.string, at.fret) - onShow(ctx).root + 12) % 12 === q.ask;
    return { ...sel, quiz: { ...q, tapped: at, asked: q.asked + 1, right: q.right + (right ? 1 : 0) } };
  },
  Options: ({ ctx, sel, setSel }) => {
    const { chord, root } = onShow(ctx);
    const f = formulaOf(chord, ctx.scale, "chord");
    const bars = compassBars(ctx, sel, null);
    const placed = bars[ctx.bar % bars.length]?.shapes[0];
    const major: Segment = { pcs: [root, (root + 4) % 12, (root + 7) % 12] };
    const q = sel.quiz;
    const pickShape = (next: ShapeSel) => {
      const s = { ...sel, ...next };
      setSel(s);
      if (!q) ctx.preview(intervals.phrase(ctx, s));
    };
    const start = (pool: Quiz["pool"]) =>
      setSel({ ...sel, quiz: { pool, ask: nextAsk(ctx, pool, null), tapped: null, right: q?.right ?? 0, asked: q?.asked ?? 0 } });
    const got = q?.tapped ? (pitchAt(q.tapped.string, q.tapped.fret) - root + 12) % 12 : null;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Toggle options={MODES} value={q ? "find" : "watch"} onPick={(m) => (m === "find" ? start("chord") : setSel({ ...sel, quiz: null }))} />
          <span aria-hidden className="h-4 w-px bg-neutral-200" />
          <ShapePicker sel={sel} onPick={pickShape} />
        </div>
        {q ? (
          <div className="space-y-1 text-center">
            <p className="text-base text-neutral-700">
              <b className="text-neutral-900">{chord.name}</b> — find the{" "}
              <span className="rounded-md bg-neutral-800 px-1.5 font-bold text-neutral-50">{nameOf(ctx, q.ask)}</span>
            </p>
            <p className="h-5 text-sm">
              {got === null ? (
                <span className="text-neutral-400">Tap it on the neck.</span>
              ) : got === q.ask ? (
                <span className="text-emerald-700">✓ Yes — {reachWords(q.ask)}. Tap anywhere for the next.</span>
              ) : (
                <span className="text-rose-700">
                  That&apos;s the {LOW[got]}. The {nameOf(ctx, q.ask)} is {reachWords(q.ask)}. Tap for the next.
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
              <Toggle options={POOLS} value={q.pool} onPick={start} />
              <span className="tabular-nums">{q.right} / {q.asked}</span>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-neutral-600">
            <b className="text-neutral-900">{chord.name}</b>
            <span className="mx-1.5 text-neutral-300">=</span>
            {f.tones.map((t) => (
              <span key={t.semis} className={`mx-0.5 inline-block min-w-6 rounded-md px-1 tabular-nums ${
                t === f.aim ? "bg-neutral-800 font-bold text-neutral-50" : "bg-neutral-100"}`}>{t.label}</span>
            ))}
            {placed && (
              <span className="ml-2 text-xs text-neutral-400">
                from <span className="text-neutral-700">{STRING_SETS.find((x) => x.low === placed.s)?.label} · {shapeOrder(major, placed)}</span>
              </span>
            )}
          </p>
        )}
      </div>
    );
  },
});

/** The steps, in order: a chord's notes, then its triad shapes, then every interval found from the triad. */
export const STEPS = [chordTones, shapes, intervals];
