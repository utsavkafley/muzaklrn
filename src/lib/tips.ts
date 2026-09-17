// Practice tips that know what you're actually working on.
//
// Every tip is generated from the current key/scale (and chord, where there is
// one), so it names real notes instead of giving generic advice. A tip you can
// act on without translating it is worth ten that you can't.

import {
  Chord, NoteName, ScaleKind, SCALE_DEGREES, SCALE_INTERVALS, POSITION_SHAPE,
  chordName, chordTonePcs, noteAt, noteIndex,
} from "./theory";
import {
  Mode, brighterThan, darkerThan, degreeNote, modeSpelling, oneNoteApart,
  parentLabel, relativeMajor,
} from "./modes";

export interface Tip {
  title: string;
  body: string;
}

export type TipRoom = "connect" | "practice" | "groove" | "piano" | "modes";

export interface TipContext {
  root: NoteName;
  kind: ScaleKind;
  chord?: Chord;
  position?: number;
  /** Set in the Modes room; `kind` is then the mode's parent pentatonic. */
  mode?: Mode;
}

/** Note names of the scale, in degree order. */
function scaleTones(root: NoteName, kind: ScaleKind): { name: NoteName; degree: string }[] {
  const rootPc = noteIndex(root);
  return SCALE_INTERVALS[kind].map((iv, i) => ({
    name: noteAt(rootPc + iv),
    degree: SCALE_DEGREES[kind][i],
  }));
}

/** The note at a given scale degree label, if the scale has it. */
function toneAt(root: NoteName, kind: ScaleKind, degree: string): NoteName | null {
  return scaleTones(root, kind).find((t) => t.degree === degree)?.name ?? null;
}

function connectTips(ctx: TipContext): Tip[] {
  const { root, kind, position = 1 } = ctx;
  const tones = scaleTones(root, kind);
  const list = tones.map((t) => t.name).join(" ");
  const shape = POSITION_SHAPE[kind][(position - 1) % 5];
  const nextShape = POSITION_SHAPE[kind][position % 5];
  const out: Tip[] = [
    {
      title: "The five notes, everywhere",
      body: `${root} ${kind === "minorPent" ? "minor" : "major"} pentatonic is only ${list}. Every position on the neck is those same five notes in a different order — you are not learning new notes, only new fingerings.`,
    },
    {
      title: `Why it's called the ${shape}`,
      body: `Position ${position} wraps around ${shape.replace(" shape", "")}. Find that chord shape inside the dots and the position stops being an abstract box — it becomes a chord you already know with the extra scale notes filled in.`,
    },
    {
      title: "Cross on two strings, not six",
      body: `Most players slide position ${position} into position ${position + 1} (${nextShape}) on the G and B strings, because that's where the shared notes fall under your first and third fingers. Pick one string and own the crossing there before trying the rest.`,
    },
    {
      title: "Slide, don't jump",
      body: "Shift on a note you're already holding, not in the silence between notes. The slide is audible and musical; a silent hand-jump is what makes position changes sound like position changes.",
    },
  ];
  const flat3 = toneAt(root, kind, "♭3");
  if (flat3) {
    out.push({
      title: "The bend note",
      body: `${flat3} is the ♭3 of ${root} minor. Bend it up a half step toward ${noteAt(noteIndex(flat3) + 1)} and you get the blues sound — that microtonal space between minor and major is most of what people mean by "feel".`,
    });
  }
  const six = toneAt(root, kind, "6");
  if (six) {
    out.push({
      title: "The sweet note",
      body: `The 6th (${six}) is what makes major pentatonic sound country or Grateful Dead rather than generic. Land on it instead of the root and the same lick changes character.`,
    });
  }
  return out;
}

function practiceTips(ctx: TipContext): Tip[] {
  const { root, kind, chord } = ctx;
  const out: Tip[] = [
    {
      title: "Target notes beat changes",
      body: "You don't need faster licks. Land any chord tone exactly when the chord changes and a plain three-note phrase sounds deliberate. Miss the landing and a fast run still sounds lost.",
    },
    {
      title: "Play less than you can",
      body: "Leave a full beat of silence after each phrase. Space is what separates a lick from noodling, and it gives you time to hear the next chord before you commit to it.",
    },
  ];
  if (chord) {
    const pcs = chordTonePcs(chord);
    const names = pcs.map((pc) => noteAt(pc));
    const scale = scaleTones(root, kind);
    const inScale = scale.filter((t) => pcs.includes(noteIndex(t.name)));
    const outside = scale.filter((t) => !pcs.includes(noteIndex(t.name)));
    out.unshift({
      title: `Over ${chordName(chord)}: land on ${names.slice(0, 3).join(", ")}`,
      body:
        inScale.length > 0
          ? `Those are the chord tones. Inside your scale that's ${inScale.map((t) => `${t.name} (${t.degree})`).join(" and ")} — safe landings. ${
              outside.length
                ? `${outside.map((t) => t.name).join(", ")} still sound good, but passing through them beats stopping on them.`
                : ""
            }`
          : `${chordName(chord)} sits outside your pentatonic — treat its chord tones as colour and resolve back into the scale.`,
    });
  }
  const fifth = toneAt(root, kind, "5");
  if (fifth) {
    out.push({
      title: "When lost, the 5th",
      body: `${fifth} is the 5th of ${root} and it works over almost everything in this key. If a change catches you out, land there and you'll never sound wrong while you find your feet.`,
    });
  }
  return out;
}

function grooveTips(): Tip[] {
  return [
    {
      title: "Keep strumming through the change",
      body: "Your strumming hand should never stop, even while the fretting hand is moving. Let a chord change land mid-strum and buzz slightly — the groove surviving matters more than the chord being clean.",
    },
    {
      title: "The & is where the feel lives",
      body: 'Count "1 & 2 & 3 & 4 &" out loud. Downstrums on the numbers, upstrums on the &s. Most beginner strumming sounds stiff because the upstrums are missing, not because the downstrums are wrong.',
    },
    {
      title: "Slower than you want",
      body: "If you can't play it perfectly three times in a row, it's too fast. Drop 10 BPM. Speed is a by-product of accuracy and arrives on its own; practising mistakes just makes them permanent.",
    },
    {
      title: "Foot, then hands",
      body: "Tap your foot on the beat before you play a note. If the foot stops when the hands get busy, the timing is coming from your hands — and hands drift. The foot is the clock.",
    },
    {
      title: "Loop one bar, not the song",
      body: "Take the one bar that trips you, loop it for two minutes, then put it back in context. Practising the whole progression to fix one change wastes most of the session on the parts you already have.",
    },
  ];
}

function pianoTips(ctx: TipContext): Tip[] {
  const { root, kind } = ctx;
  const tones = scaleTones(root, kind);
  const list = tones.map((t) => t.name).join(" ");
  const third = toneAt(root, kind, "3") ?? toneAt(root, kind, "♭3");
  const fifth = toneAt(root, kind, "5");
  return [
    {
      title: "Same five notes, both hands",
      body: `${root} ${kind === "minorPent" ? "minor" : "major"} pentatonic is ${list} here too. You already know these on the guitar — the piano just lays them out in a straight line so you can see the intervals instead of feeling for them.`,
    },
    {
      title: "Left hand holds, right hand plays",
      body: `Hold the root (${root}) and the 5th (${fifth ?? "5th"}) in your left hand and improvise with your right using only those five notes. Two fingers down is a complete accompaniment — you do not need full chords to sound finished.`,
    },
    {
      title: "The third tells the story",
      body: `${third ?? "The third"} is what makes this ${kind === "minorPent" ? "minor" : "major"}. Play the root and 5th alone and it's ambiguous; add the third and the mood is decided. It's the single most important note in any chord.`,
    },
    {
      title: "Pentatonic can't go wrong",
      body: "There are no half steps in a pentatonic scale, so no two notes clash. Put any of these five over the chord and it works — which makes this the safest possible place to start improvising on an unfamiliar instrument.",
    },
    {
      title: "Colour the loop",
      body: "Record a loop on the guitar, then find these same notes on the keys over the top. Hearing one idea on two instruments teaches the theory faster than drilling either one alone.",
    },
  ];
}

function modeTips(ctx: TipContext): Tip[] {
  const { root, mode, position = 1 } = ctx;
  if (!mode) return [];
  const parent = parentLabel(mode);
  const added = mode.added.map((d) => degreeNote(root, mode, d));
  const character = degreeNote(root, mode, mode.character);
  const shape = POSITION_SHAPE[mode.parent][(position - 1) % 5];
  const out: Tip[] = [
    {
      title: "Two notes, not seven",
      body: `${root} ${mode.name} is the ${root} ${parent} you already own plus ${added.join(" and ")}. Play position ${position} (${shape}) exactly as you always do and add those two wherever they fall under your fingers. Nothing else changes.`,
    },
    {
      title: `${character} is the whole mode`,
      body: `The ${mode.character} is what makes this ${mode.name} rather than anything else. Land on it, hold it, bend into it — if a listener can't hear ${character}, they can't hear the mode, no matter how correct the other six notes were.`,
    },
    {
      title: "Modes are harmony, not scales",
      body: `These are the notes of ${relativeMajor(root, mode)} major. Played over the wrong chords that's exactly what they'll sound like. The mode only exists while the bass insists on ${root} — which is why you practise this over the vamp and never on its own.`,
    },
    {
      title: "Resolve somewhere new",
      body: `Your ear will pull every phrase home to ${root}. Try ending on ${character} instead and holding it through the chord change. Refusing to resolve is most of what makes modal playing sound modal.`,
    },
  ];

  const neighbour = darkerThan(mode) ?? brighterThan(mode);
  const diff = neighbour ? oneNoteApart(mode, neighbour) : null;
  if (neighbour && diff) {
    out.push({
      title: `One note from ${neighbour.name}`,
      body: `${mode.name} and ${neighbour.name} share six of seven notes — ${diff.brighter} against ${diff.darker} is the entire difference. Drill the pair as a single decision rather than two scales and you learn both in the time one would take.`,
    });
  }

  if (mode.dropped) {
    out.push({
      title: "The one that breaks the rule",
      body: `Every other mode adds two notes to a pentatonic. Locrian also removes one: the 5 flattens, and the root loses the interval that made it feel like a root. Play it once to hear what a missing perfect fifth costs you, then go back to something with a floor.`,
    });
  } else {
    out.push({
      title: "Say it out loud",
      body: `${modeSpelling(root, mode).join(" ")}. Seven names you can say faster than you can play them. Naming notes while you play is slow at first and then it isn't, and afterwards you stop needing the fretboard diagram at all.`,
    });
  }

  return out;
}

/** Tips relevant to a room, specialised to the current key, scale and chord. */
export function tipsFor(room: TipRoom, ctx: TipContext): Tip[] {
  switch (room) {
    case "connect": return connectTips(ctx);
    case "practice": return practiceTips(ctx);
    case "groove": return grooveTips();
    case "piano": return pianoTips(ctx);
    case "modes": return modeTips(ctx);
  }
}
