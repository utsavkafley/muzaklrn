// Music theory core: notes, pentatonic boxes, chords.

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = (typeof NOTES)[number];

export const PRETTY: Record<string, string> = {
  "C#": "C♯/D♭", "D#": "D♯/E♭", "F#": "F♯/G♭", "G#": "G♯/A♭", "A#": "A♯/B♭",
};
export const prettyNote = (n: NoteName) => PRETTY[n] ?? n;

// Standard tuning, string 6 (low E) → string 1 (high E), as semitones from C.
// E=4, A=9, D=2, G=7, B=11, E=4
export const TUNING = [4, 9, 2, 7, 11, 4]; // index 0 = string 6 (low E)

export type ScaleKind = "minorPent" | "majorPent";
export const SCALE_INTERVALS: Record<ScaleKind, number[]> = {
  minorPent: [0, 3, 5, 7, 10], // 1 b3 4 5 b7
  majorPent: [0, 2, 4, 7, 9], // 1 2 3 5 6
};
export const SCALE_DEGREES: Record<ScaleKind, string[]> = {
  minorPent: ["1", "♭3", "4", "5", "♭7"],
  majorPent: ["1", "2", "3", "5", "6"],
};
export const SCALE_LABEL: Record<ScaleKind, string> = {
  minorPent: "minor pentatonic",
  majorPent: "major pentatonic",
};

/**
 * CAGED shape name for each pentatonic position, 1..5.
 *
 * Position 1 is the shape anchored at the root on the low E string; positions
 * then ascend the neck in CAGED order, which read from E is E → D → C → A → G.
 * Minor pentatonic positions are named for the minor chord shapes they contain.
 *
 * Refs: rynaylorguitar.com/lessons/guitar-minor-pentatonic-scale (minor:
 * Em/Dm/Cm/Am/Gm) and guitarhabits.com/the-5-major-pentatonic-scale-shapes-positions
 * (major: E/D/C/A/G). Both anchor position 1 at the root on the 6th string.
 */
export const POSITION_SHAPE: Record<ScaleKind, string[]> = {
  minorPent: ["Em shape", "Dm shape", "Cm shape", "Am shape", "Gm shape"],
  majorPent: ["E shape", "D shape", "C shape", "A shape", "G shape"],
};

/** "Position 2 · Dm shape" */
export const positionLabel = (kind: ScaleKind, box: number) =>
  `Position ${box} \u00b7 ${POSITION_SHAPE[kind][(box - 1) % 5]}`;

export const noteIndex = (n: NoteName) => NOTES.indexOf(n);
export const noteAt = (i: number): NoteName => NOTES[((i % 12) + 12) % 12];

/** Pitch class at a given string (0 = low E) and fret. */
export const pitchAt = (stringIdx: number, fret: number) => (TUNING[stringIdx] + fret) % 12;

/** MIDI-ish absolute pitch for audio (low E = E2 = 40). */
export const midiAt = (stringIdx: number, fret: number) => {
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
  return OPEN_MIDI[stringIdx] + fret;
};

export interface FretNote {
  string: number; // 0 = low E .. 5 = high E
  fret: number;
  pc: number; // pitch class
  degree: string; // scale degree label
  isRoot: boolean;
}

/**
 * Every fret carrying one of `intervals` (semitones from the root), labelled
 * with the matching entry of `degrees`. Works for any scale size — the
 * pentatonics below and the seven-note modes in `modes.ts` share it.
 */
export function fretNotesFor(
  root: NoteName,
  intervals: number[],
  degrees: string[],
  maxFret = 22,
): FretNote[] {
  const rootPc = noteIndex(root);
  const out: FretNote[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const pc = pitchAt(s, f);
      const iv = (pc - rootPc + 12) % 12;
      const di = intervals.indexOf(iv);
      if (di >= 0) out.push({ string: s, fret: f, pc, degree: degrees[di], isRoot: di === 0 });
    }
  }
  return out;
}

/** All notes of a pentatonic scale on the fretboard within [0, maxFret]. */
export function scaleNotes(root: NoteName, kind: ScaleKind, maxFret = 22): FretNote[] {
  return fretNotesFor(root, SCALE_INTERVALS[kind], SCALE_DEGREES[kind], maxFret);
}

export interface BoxNote extends FretNote {
  box: number; // 1..5
}

export interface KeyboardScaleNote {
  midi: number;
  degree: string;
  isRoot: boolean;
}

/** Scale notes across a MIDI range, for the piano keyboard. */
export function scaleAcrossRange(root: NoteName, kind: ScaleKind, loMidi: number, hiMidi: number): KeyboardScaleNote[] {
  const rootPc = noteIndex(root);
  const intervals = SCALE_INTERVALS[kind];
  const degrees = SCALE_DEGREES[kind];
  const out: KeyboardScaleNote[] = [];
  for (let m = loMidi; m <= hiMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    const iv = (pc - rootPc + 12) % 12;
    const di = intervals.indexOf(iv);
    if (di >= 0) out.push({ midi: m, degree: degrees[di], isRoot: di === 0 });
  }
  return out;
}

/**
 * Compute the five pentatonic boxes, tiled up the neck.
 * Box 1 is anchored at the root fret on the low E string; each box uses two
 * consecutive scale tones per string, and box k+1 starts where box k ends —
 * which is exactly why adjacent boxes share a note on every string.
 */
export function pentatonicBoxes(root: NoteName, kind: ScaleKind, maxFret = 22): BoxNote[] {
  const rootPc = noteIndex(root);
  // Root fret on low E. For E itself this is 0 — the open position, which is
  // exactly how E major/minor pentatonic is actually played, so box 1 stays there.
  const anchor = (rootPc - TUNING[0] + 12) % 12;
  const all = scaleNotes(root, kind, maxFret + 5);

  // Per string: sorted fret list of scale tones.
  const perString: number[][] = Array.from({ length: 6 }, (_, s) =>
    all.filter((n) => n.string === s).map((n) => n.fret).sort((a, b) => a - b)
  );

  const out: BoxNote[] = [];
  const seen = new Set<string>();
  for (let s = 0; s < 6; s++) {
    const frets = perString[s];
    // First note of box 1 on this string: smallest scale fret >= anchor - 1.
    const i0 = frets.findIndex((f) => f >= anchor - 1);
    if (i0 < 0) continue;
    // Keep tiling past box 5 — the shapes repeat an octave up, and a 22-fret
    // neck holds roughly two full cycles. Box numbers cycle 1..5 with them.
    for (let k = 0; i0 + k < frets.length; k++) {
      const box = (k % 5) + 1;
      const a = frets[i0 + k];
      const b = frets[i0 + k + 1];
      for (const f of [a, b]) {
        if (f === undefined || f > maxFret) continue;
        const key = `${s}:${f}:${box}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const src = all.find((n) => n.string === s && n.fret === f)!;
        out.push({ ...src, box });
      }
    }
    // Also walk backwards from box 1 so low frets below the anchor are covered
    // (e.g. A minor pentatonic has scale tones at frets 0-3).
    for (let k = 1; i0 - k >= 0; k++) {
      const box = ((5 - (k % 5)) % 5) + 1;
      const a = frets[i0 - k];
      const b = frets[i0 - k + 1];
      for (const f of [a, b]) {
        if (f === undefined || f > maxFret) continue;
        const key = `${s}:${f}:${box}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const src = all.find((n) => n.string === s && n.fret === f)!;
        out.push({ ...src, box });
      }
    }
  }
  return out;
}

/** Notes shared between box k and box k+1 (the pivots for horizontal movement). */
export function pivotNotes(boxes: BoxNote[], k: number): BoxNote[] {
  const a = boxes.filter((n) => n.box === k);
  const b = boxes.filter((n) => n.box === k + 1);
  return a.filter((n) => b.some((m) => m.string === n.string && m.fret === n.fret));
}

// ---------- Chords ----------

export type ChordQuality = "maj" | "min" | "7" | "maj7" | "min7" | "m7b5" | "sus4" | "add9";

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  maj: "", min: "m", "7": "7", maj7: "maj7", min7: "m7", m7b5: "m7♭5", sus4: "sus4", add9: "add9",
};

export const CHORD_TONES: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 2],
};

export interface Chord {
  root: NoteName;
  quality: ChordQuality;
}
export const chordName = (c: Chord) => c.root + QUALITY_LABEL[c.quality];
export const chordTonePcs = (c: Chord) =>
  CHORD_TONES[c.quality].map((iv) => (noteIndex(c.root) + iv) % 12);

/**
 * Chord shapes for diagrams: frets per string (low E → high E), -1 = mute.
 * `base` = fret of index 1 in the diagram (1 for open chords).
 * Movable E/A barre shapes are used as fallback for roots without an open shape.
 */
export interface ChordShape {
  frets: number[];
  base: number;
  label?: string;
}

const OPEN_SHAPES: Record<string, ChordShape> = {
  "C maj": { frets: [-1, 3, 2, 0, 1, 0], base: 1 },
  "A maj": { frets: [-1, 0, 2, 2, 2, 0], base: 1 },
  "G maj": { frets: [3, 2, 0, 0, 0, 3], base: 1 },
  "E maj": { frets: [0, 2, 2, 1, 0, 0], base: 1 },
  "D maj": { frets: [-1, -1, 0, 2, 3, 2], base: 1 },
  "A min": { frets: [-1, 0, 2, 2, 1, 0], base: 1 },
  "E min": { frets: [0, 2, 2, 0, 0, 0], base: 1 },
  "D min": { frets: [-1, -1, 0, 2, 3, 1], base: 1 },
  "A 7": { frets: [-1, 0, 2, 0, 2, 0], base: 1 },
  "B 7": { frets: [-1, 2, 1, 2, 0, 2], base: 1 },
  "D 7": { frets: [-1, -1, 0, 2, 1, 2], base: 1 },
  "E 7": { frets: [0, 2, 0, 1, 0, 0], base: 1 },
  "G 7": { frets: [3, 2, 0, 0, 0, 1], base: 1 },
  "C 7": { frets: [-1, 3, 2, 3, 1, 0], base: 1 },
  "C maj7": { frets: [-1, 3, 2, 0, 0, 0], base: 1 },
  "A maj7": { frets: [-1, 0, 2, 1, 2, 0], base: 1 },
  "D maj7": { frets: [-1, -1, 0, 2, 2, 2], base: 1 },
  "G maj7": { frets: [3, 2, 0, 0, 0, 2], base: 1 },
  "F maj7": { frets: [-1, -1, 3, 2, 1, 0], base: 1, label: "Fmaj7 (easy)" },
  "A min7": { frets: [-1, 0, 2, 0, 1, 0], base: 1 },
  "E min7": { frets: [0, 2, 0, 0, 0, 0], base: 1 },
  "D min7": { frets: [-1, -1, 0, 2, 1, 1], base: 1 },
  "D sus4": { frets: [-1, -1, 0, 2, 3, 3], base: 1 },
  "A sus4": { frets: [-1, 0, 2, 2, 3, 0], base: 1 },
  "C add9": { frets: [-1, 3, 2, 0, 3, 0], base: 1 },
  "G add9": { frets: [3, 0, 0, 2, 0, 3], base: 1 },
};

/** E-shape (root on string 6) and A-shape (root on string 5) barre templates, offsets from barre fret. */
const BARRE_E: Record<ChordQuality, number[]> = {
  maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, -100], min7: [0, 2, 0, 0, 0, 0], m7b5: [0, -100, 0, 0, -1, -100],
  sus4: [0, 2, 2, 2, 0, 0], add9: [0, 2, 2, 1, 0, 2],
};
const BARRE_A: Record<ChordQuality, number[]> = {
  maj: [-100, 0, 2, 2, 2, 0], min: [-100, 0, 2, 2, 1, 0], "7": [-100, 0, 2, 0, 2, 0],
  maj7: [-100, 0, 2, 1, 2, 0], min7: [-100, 0, 2, 0, 1, 0], m7b5: [-100, 0, 1, 0, 1, -100],
  sus4: [-100, 0, 2, 2, 3, 0], add9: [-100, 0, 2, 4, 2, 0],
};

export function chordShape(c: Chord): ChordShape {
  const key = `${c.root} ${c.quality}`;
  if (OPEN_SHAPES[key]) return OPEN_SHAPES[key];
  // Prefer whichever barre root fret is lower on the neck.
  const eFret = (noteIndex(c.root) - 4 + 12) % 12 || 12;
  const aFret = (noteIndex(c.root) - 9 + 12) % 12 || 12;
  const useA = aFret <= eFret;
  const tmpl = useA ? BARRE_A[c.quality] : BARRE_E[c.quality];
  const barre = useA ? aFret : eFret;
  const frets = tmpl.map((o) => (o < -10 ? -1 : o + barre));
  return { frets, base: barre, label: `${chordName(c)} (barre ${barre})` };
}

/** For a chord in a key: which pentatonic scale/degree tips to show. */
export function lickTip(c: Chord, scaleRoot: NoteName, kind: ScaleKind): string {
  const tones = chordTonePcs(c);
  const rootPc = noteIndex(scaleRoot);
  const inScale = SCALE_INTERVALS[kind]
    .map((iv, i) => ({ pc: (rootPc + iv) % 12, deg: SCALE_DEGREES[kind][i] }))
    .filter((n) => tones.includes(n.pc));
  if (inScale.length === 0) return `Land on ${c.root} — it sits outside the pentatonic, treat it as color.`;
  const names = inScale.map((n) => `${noteAt(n.pc)} (${n.deg})`).join(", ");
  return `Target: ${names}`;
}
