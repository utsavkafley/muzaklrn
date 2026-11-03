import { CompassBar, LOW, compassLines, formulaOf, reachSpot, reachWords } from "@/lib/compass";
import { DiatonicChord } from "@/lib/harmony";
import { ANY_STRINGS, Feel, Lead, NEAREST, Placed, Segment, placeShapes, shapeLines, shapeOrder, toneLines } from "@/lib/lines";
import { RiffNote } from "@/lib/riffs";
import { STRING_SETS } from "@/lib/shapes";
import { midiAt, pitchAt } from "@/lib/theory";
import { pluck } from "@/lib/audio";
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
    targetAfter: (idx) => {
      if (!many || lines.length < 2) return [];
      // A note pushed across the barline is where the next chord comes in; else the next bar's first notes.
      const pushed = lines[idx % lines.length].filter((x) => x.at + x.len > 8);
      if (pushed.length) return pushed;
      const next = lines[(idx + 1) % lines.length];
      const first = Math.min(...next.map((x) => x.at));
      return next.filter((x) => x.at === first);
    },
  };
}

/** Rhythms to start from: each a bar of eighths, and what it teaches. */
const FEELS: { feel: Feel; name: string; tip: string }[] = [
  { feel: "x-x-x-x-", name: "♩ quarters", tip: "One per beat: steady, so the changes do the talking." },
  { feel: "xxxxxxxx", name: "♫ eighths", tip: "Two per beat: a running line that never stops for breath." },
  { feel: "x--x....", name: "Charleston", tip: "Beat 1 and the and of 2, then space — the oldest comping rhythm in jazz." },
  { feel: ".x.x.x.x", name: "offbeats", tip: "Only the ands: the line floats over the beat instead of marching on it." },
  { feel: "xxx-....", name: "breathe", tip: "Say something, then leave room. A phrase needs a breath to be a phrase — try it with “your turn”." },
  { feel: "x--x--x-", name: "3·3·2", tip: "Groups of three eighths against four beats: the tresillo, under half of pop and Latin music." },
  { feel: "....x-xx", name: "pickup", tip: "Wait two beats, then run at the next chord. A line that starts late sounds like it means it." },
];

const LEADS: { value: Lead; label: string; tip: string }[] = [
  { value: "none", label: "—", tip: "" },
  { value: "approach", label: "approach", tip: "The last eighth before each change is a half step from where the next chord starts: tension, then it lands." },
  { value: "push", label: "push", tip: "The next chord's note comes an eighth early and rings over the barline: the line leans into the change." },
];

const COUNT = ["1", "&", "2", "&", "3", "&", "4", "&"];
/** A tap on a cell turns a note into a held note, a held note into a rest, a rest into a note. */
const CYCLE: Record<string, string> = { x: "-", "-": ".", ".": "x" };

/** A rhythm nobody asked for: a beat at a time, something on 1 or just before it, two notes at least. */
function surprise(): Feel {
  const beats = ["x-", "xx", ".x", "..", "x.", "x-", ".x"];
  for (;;) {
    const f = "x" + (Math.random() < 0.5 ? "-" : beats[Math.floor(Math.random() * beats.length)][1])
      + Array.from({ length: 3 }, () => beats[Math.floor(Math.random() * beats.length)]).join("");
    if ((f.match(/x/g) ?? []).length >= 2) return f;
  }
}

/** The bar of eighths, tappable: a dot for a note, a bar for a held one, nothing for a rest. */
function FeelGrid({ feel, onFeel }: { feel: Feel; onFeel: (f: Feel) => void }) {
  return (
    <div className="flex items-end justify-center gap-0.5" role="group" aria-label="rhythm">
      {COUNT.map((c, i) => {
        const v = feel[i] ?? ".";
        return (
          <button key={i} onClick={() => onFeel(feel.slice(0, i) + CYCLE[v] + feel.slice(i + 1))}
            aria-label={`${c} ${v === "x" ? "note" : v === "-" ? "held" : "rest"}`}
            className={`flex w-8 flex-col items-center gap-1 rounded-lg py-1 hover:bg-neutral-100 ${i % 2 ? "" : "ml-1"}`}>
            <span className="flex h-3 w-full items-center justify-center">
              {v === "x" && <span className="h-3 w-3 rounded-full bg-neutral-800" />}
              {v === "-" && <span className="-ml-4 h-1.5 w-8 rounded-full bg-neutral-800" />}
              {v === "." && <span className="h-1.5 w-1.5 rounded-full bg-neutral-200" />}
            </span>
            <span className={`text-[11px] tabular-nums ${i % 2 ? "text-neutral-400" : "font-bold text-neutral-600"}`}>{c}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Chord tones ----------

interface ToneSel { feel: Feel; lead: Lead }

export const chordTones = defineStep<ToneSel>({
  id: "tones",
  label: "Chord tones",
  how: "Each chord's notes inside the frame, in your rhythm, starting where the last chord left off. Tap the beats to make your own; the same rhythm every bar turns it into a motif.",
  initial: { feel: "x-x-x-x-", lead: "none" },
  phrase: (ctx, sel) => overBars(ctx, `tones-${sel.feel}-${sel.lead}-${ctx.span}`, "Chord tones",
    (bars) => toneLines(bars, ctx.lo, sel.feel, sel.lead, ctx.span)),
  Options: ({ ctx, sel, setSel }) => {
    const pick = (next: ToneSel) => {
      setSel(next);
      ctx.preview(chordTones.phrase(ctx, next));
    };
    const preset = FEELS.find((f) => f.feel === sel.feel);
    const lead = LEADS.find((l) => l.value === sel.lead);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap justify-center gap-1 text-sm">
          {FEELS.map((f) => (
            <button key={f.feel} onClick={() => pick({ ...sel, feel: f.feel })} aria-pressed={sel.feel === f.feel}
              className={`rounded-full px-3 py-1 transition-colors ${
                sel.feel === f.feel ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"}`}>
              {f.name}
            </button>
          ))}
          <button onClick={() => pick({ ...sel, feel: surprise() })} title="a rhythm you haven't tried"
            className="rounded-full px-3 py-1 text-neutral-500 hover:text-neutral-800">🎲</button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <FeelGrid feel={sel.feel} onFeel={(feel) => pick({ ...sel, feel })} />
          <span aria-hidden className="h-6 w-px bg-neutral-200" />
          <div className="flex items-center gap-1 text-sm text-neutral-500">
            into the change
            <Toggle options={LEADS} value={sel.lead} onPick={(l) => pick({ ...sel, lead: l })} />
          </div>
        </div>
        <p className="text-center text-xs text-neutral-600">
          {preset ? preset.tip : "Your own rhythm. Keep it for a few rounds: one rhythm over changing chords is a motif."}
          {lead?.tip && <span className="text-neutral-500"> {lead.tip}</span>}
        </p>
      </div>
    );
  },
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

/** The shape on show, named: its strings, and its notes low to high — each one found on the neck on hover. */
function ShapeName({ seg, placed, ctx }: { seg: Segment | undefined; placed: Placed | null | undefined; ctx: PracticeCtx }) {
  if (!seg || !placed) return null;
  const strings = STRING_SETS.find((x) => x.low === placed.s)?.label;
  const names = shapeOrder(seg, placed).split(" ");
  return (
    <p className="text-center text-xs text-neutral-500">
      shape <b className="text-neutral-800">{strings}</b>
      <span className="mx-1.5 text-neutral-300">·</span>
      {placed.frets.map((f, i) => {
        const at = { string: placed.s + i, fret: f };
        const lit = ctx.hovered?.string === at.string && ctx.hovered.fret === at.fret;
        return (
          <span key={i} onMouseEnter={() => ctx.spot({ at: [at] })} onMouseLeave={() => ctx.spot(null)}
            className={`mx-px inline-block min-w-5 cursor-default rounded-md px-1 tabular-nums ${
              lit ? "bg-amber-300 text-neutral-950" : "text-neutral-800 hover:bg-amber-200"}`}>{names[i]}</span>
        );
      })}
      <span className="ml-1.5 text-neutral-400">low to high</span>
    </p>
  );
}

export const shapes = defineStep<ShapeSel>({
  id: "shapes",
  label: "Triads",
  how: "Each chord as a three-string triad inside the frame. Nearest barely moves the hand; a lowest note fixes one shape to learn.",
  initial: { low: ANY_STRINGS, bottom: NEAREST },
  phrase: (ctx, sel) => overBars(ctx, `shapes-${sel.low}-${sel.bottom}-${ctx.span}`, "Shapes",
    (bars) => shapeLines(bars, sel.low, ctx.lo, sel.bottom, ctx.span)),
  Options: ({ ctx, sel, setSel }) => {
    const bars = barsOf_(ctx, null);
    const idx = ctx.bar % bars.length;
    const placed = placeShapes(bars, sel.low, ctx.lo, sel.bottom, ctx.span)[idx]?.[0];
    return (
      <div className="space-y-2">
        <ShapePicker sel={sel} onPick={(next) => {
          setSel(next);
          ctx.preview(shapes.phrase(ctx, next));
        }} />
        <ShapeName seg={bars[idx]?.[0]} placed={placed} ctx={ctx} />
      </div>
    );
  },
});

// ---------- Intervals ----------

/** Every bar's compass, or — with no progression — the chord in focus (else I) alone. */
const compassBars = (ctx: PracticeCtx, sel: ShapeSel, alone: DiatonicChord | null) =>
  compassLines(
    ctx.progression.length ? ctx.progression : [[alone ?? ctx.focus ?? ctx.chordOf({ degree: 0, kind: ctx.kind })]],
    ctx.keyPc, ctx.scale, ctx.lo, "chord", sel.low, sel.bottom, ctx.span,
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
  how: "Every chord is the major triad on its root, edited. A triad note the chord moved off is left dashed; each arrow on the neck is one move in the list above. Hover either to find the other.",
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
        id: `find-${sel.low}-${sel.bottom}-${ctx.span}-${q.ask}-${q.tapped ? "a" : "q"}`,
        name: "Find it",
        bare: true,
        numbered: false,
        notesFor: () => notes,
        compassFor: () => ({ ghosts: [], reaches }),
      };
    }
    return {
      id: `intervals-${sel.low}-${sel.bottom}-${ctx.span}`,
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
          <Recipe ctx={ctx} bar={bars[ctx.bar % bars.length]} placed={placed} major={major} />
        )}
      </div>
    );
  },
});

/**
 * The chord as a recipe, each note a row: what it is, and where it sits
 * from the dashed triad — the same words as the arrows on the neck. Hover a
 * row to light that note (and the triad note it's reached from); hover a
 * note on the neck to light its row. Click to hear it.
 */
function Recipe({ ctx, bar, placed, major }: {
  ctx: PracticeCtx; bar: CompassBar | undefined; placed: Placed | null | undefined; major: Segment;
}) {
  const { chord } = onShow(ctx);
  const f = formulaOf(chord, ctx.scale, "chord");
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm text-neutral-600">
        <b className="text-neutral-900">{chord.name}</b> starts from the major triad on its root
        {placed && (
          <span> — on <span className="text-neutral-800">
            {STRING_SETS.find((x) => x.low === placed.s)?.label} · {shapeOrder(major, placed)}</span></span>
        )}
        . Each of its notes, from there:
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {f.tones.map((t) => {
          const at = (bar?.notes ?? []).filter((x) => x.label === t.label).map((x) => ({ string: x.string, fret: x.fret }));
          const from = bar?.reaches.find((r) => at.some((x) => x.string === r.to.string && x.fret === r.to.fret))?.from;
          const lit = !!ctx.hovered && at.some((x) => x.string === ctx.hovered!.string && x.fret === ctx.hovered!.fret);
          return (
            <button key={t.semis}
              onMouseEnter={() => ctx.spot({ at, from })} onMouseLeave={() => ctx.spot(null)}
              onFocus={() => ctx.spot({ at, from })} onBlur={() => ctx.spot(null)}
              onClick={() => at.forEach((x) => pluck(midiAt(x.string, x.fret)))}
              className={`flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs transition-colors ${
                lit ? "border-amber-400 bg-amber-100" : "border-neutral-200 hover:border-amber-400 hover:bg-amber-50"}`}>
              <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-sm font-bold tabular-nums ${
                t === f.aim ? "bg-neutral-800 text-neutral-50" : "bg-neutral-100 text-neutral-900"}`}>{t.label}</span>
              <span className="text-neutral-600">{reachWords(t.semis)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The steps, in order: a chord's notes, then its triad shapes, then every interval found from the triad. */
export const STEPS = [chordTones, shapes, intervals];
