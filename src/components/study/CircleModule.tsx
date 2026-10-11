import { DiatonicChord, MOOD_FILL } from "@/lib/harmony";
import { MODES } from "@/lib/modes";
import { StudyCtx, defineModule } from "./types";

/** Clockwise from the top: each step a fifth up, one more sharp (or one fewer flat). */
const MAJOR = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
const MINOR = ["Am", "Em", "Bm", "F♯m", "C♯m", "G♯m", "E♭m", "B♭m", "Fm", "Cm", "Gm", "Dm"];
/** As the note box takes them. */
const MAJOR_IN = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const MINOR_IN = ["A", "E", "B", "F#", "C#", "G#", "Eb", "Bb", "F", "C", "G", "D"];
const SIG = ["no ♯ or ♭", "1♯", "2♯", "3♯", "4♯", "5♯", "6♯", "5♭", "4♭", "3♭", "2♭", "1♭"];

/** Slot of a major key on the circle, from its pitch class. */
const slotOf = (pc: number) => (pc * 7) % 12;

const IONIAN = MODES.find((m) => m.id === "ionian")!;
const AEOLIAN = MODES.find((m) => m.id === "aeolian")!;

/**
 * Where each of the key's chords sits: a major chord on the outer ring at
 * its root, a minor or diminished one on the inner ring where that root is
 * the relative minor.
 */
function placeChord(c: DiatonicChord, keyPc: number): { slot: number; inner: boolean } | null {
  const root = (keyPc + c.semis) % 12;
  if (c.shape === "maj") return { slot: slotOf(root), inner: false };
  if (c.shape === "min" || c.shape === "dim") return { slot: slotOf((root + 3) % 12), inner: true };
  return null;
}

function Circle({ ctx }: { ctx: StudyCtx }) {
  const S = 340, C = S / 2;
  const R_OUT = 150, R_MID = 112, R_IN = 74;
  const angle = (slot: number) => ((slot * 30 - 90) * Math.PI) / 180;
  const pt = (slot: number, r: number) => ({ x: C + r * Math.cos(angle(slot)), y: C + r * Math.sin(angle(slot)) });

  const triads = ctx.scale.map((_, degree) => ctx.chordOf({ degree, kind: "triad" }));
  const placed = new Map<string, DiatonicChord>();
  for (const c of triads) {
    const p = placeChord(c, ctx.keyPc);
    if (p) placed.set(`${p.inner ? "i" : "o"}${p.slot}`, c);
  }
  const relDown = ctx.mode?.relativeMajorDown ?? 0;
  const parent = slotOf((ctx.keyPc - relDown + 12) % 12);

  const wedge = (slot: number, r0: number, r1: number) => {
    const a0 = angle(slot - 0.5), a1 = angle(slot + 0.5);
    const p = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
    return `M${p(r0, a0)}A${r0} ${r0} 0 0 1 ${p(r0, a1)}L${p(r1, a1)}A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`;
  };

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-sm" role="img" aria-label="circle of fifths">
      {/* The key's neighbourhood: its own slot and one either side, both rings. */}
      {[-1, 0, 1].map((d) => (
        <path key={d} d={wedge((parent + d + 12) % 12, R_IN - 26, R_OUT + 20)} fill="#f5f5f4" />
      ))}
      <circle cx={C} cy={C} r={R_MID} fill="none" stroke="#e7e5e4" />
      {MAJOR.map((label, slot) => {
        const ring = [{ inner: false, r: R_OUT - 18, label, input: MAJOR_IN[slot] }, { inner: true, r: R_IN + 4, label: MINOR[slot], input: MINOR_IN[slot] }];
        return ring.map(({ inner, r, label: l, input }) => {
          const c = placed.get(`${inner ? "i" : "o"}${slot}`);
          const p = pt(slot, r);
          const isHome = c?.degree === 0;
          const shown = c && c.shape === "dim" ? l.replace("m", "°") : l;
          return (
            <g key={`${inner}${slot}`} className="cursor-pointer"
              onClick={() => {
                ctx.setKey(input);
                ctx.setShown((inner ? AEOLIAN : IONIAN).intervals.slice(1));
              }}>
              <circle cx={p.x} cy={p.y} r={inner ? 19 : 23}
                fill={c ? MOOD_FILL[c.mood] : "transparent"}
                stroke={isHome ? "#18181b" : "transparent"} strokeWidth={3} />
              <text x={p.x} y={p.y + (c ? 0 : 4)} textAnchor="middle" fontSize={inner ? 12.5 : 15} fontWeight={c ? 700 : 500}
                fill={c ? "#0a0a0a" : "#a8a29e"}>{shown}</text>
              {c && (
                <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={9} fill="#292524">{c.numeral}</text>
              )}
            </g>
          );
        });
      })}
      {SIG.map((sig, slot) => {
        const p = pt(slot, R_OUT + 8);
        return <text key={slot} x={p.x} y={p.y + 3} textAnchor="middle" fontSize={9} fill="#a8a29e">{sig === "no ♯ or ♭" ? "" : sig}</text>;
      })}
      <text x={C} y={C - 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#18181b">{ctx.name}</text>
      <text x={C} y={C + 12} textAnchor="middle" fontSize={10} fill="#78716c">{ctx.mode?.name ?? ""}</text>
    </svg>
  );
}

/**
 * The circle of fifths, explained from where you are: your key's chords lit
 * on it in their moods, home ringed, the neighbourhood they share shaded,
 * and a tap on any key to go there.
 */
export const circleModule = defineModule<null>({
  id: "circle",
  label: "Circle of fifths",
  initial: null,
  Panel: ({ ctx }) => {
    const relDown = ctx.mode?.relativeMajorDown ?? 0;
    const parentPc = (ctx.keyPc - relDown + 12) % 12;
    const parentSlot = slotOf(parentPc);
    const parentName = MAJOR[parentSlot];
    const isMajor = ctx.mode?.id === "ionian";
    return (
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_1fr]">
        <Circle ctx={ctx} />
        <ul className="space-y-3 text-sm leading-relaxed text-neutral-700">
          <li>
            <b className="text-neutral-900">Clockwise is a fifth up.</b> Each step adds one sharp to the key
            (or drops a flat); counter-clockwise is a fourth up, adding a flat.
          </li>
          <li>
            <b className="text-neutral-900">Neighbours share six of their seven notes.</b> That makes one step
            round the circle the smoothest key change there is.
          </li>
          <li>
            <b className="text-neutral-900">Your key&apos;s chords sit together.</b> In the shaded wedge: three
            major chords side by side on the outside — {`I, IV and V of ${parentName} major — their relative minors beneath them, and the diminished chord one step on.`} Colours are the chords&apos; moods; home is ringed.
          </li>
          {ctx.mode && !isMajor && (
            <li>
              <b className="text-neutral-900">{ctx.name} {ctx.mode.name} uses {parentName} major&apos;s notes</b>
              {" "}({SIG[parentSlot]}), with {ctx.name} as home instead of {parentName}. Same neighbourhood on the
              circle, different chord ringed — that is all a mode is.
            </li>
          )}
          <li className="text-neutral-500">Tap any key to go there: outside for major, inside for minor.</li>
        </ul>
      </div>
    );
  },
});
