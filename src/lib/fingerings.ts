// The common ways to play a chord: the open chord if it has one, the two
// movable barre shapes, and three-string shapes up the neck. Every shape is
// checked note by note against the chord before it is offered.

import { DiatonicChord, Grip } from "./harmony";
import { ChordQuality, NOTES, NoteName, noteIndex, openShape, pitchAt } from "./theory";
import { INVERSION, triadShapes } from "./shapes";

export interface Fingering {
  grip: Grip;
  label: string;
}

/** Offsets from the barre fret, low E to high E; null is a muted string. */
type Template = (number | null)[];
const E_SHAPE: Record<string, Template> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, null, 1, 1, 0, null],
  m7: [0, 2, 0, 0, 0, 0],
  "m7♭5": [0, null, 0, 0, -1, null],
  sus4: [0, 2, 2, 2, 0, 0],
};
const A_SHAPE: Record<string, Template> = {
  maj: [null, 0, 2, 2, 2, 0],
  min: [null, 0, 2, 2, 1, 0],
  "7": [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  "m7♭5": [null, 0, 1, 0, 1, null],
  sus4: [null, 0, 2, 2, 3, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  dim: [null, 0, 1, 2, 1, null],
  aug: [null, 0, 3, 2, 2, 1],
};
/** Our shape names, as the open-chord table names them. */
const OPEN_QUALITY: Record<string, ChordQuality> = {
  maj: "maj", min: "min", "7": "7", maj7: "maj7", m7: "min7", "m7♭5": "m7b5", sus4: "sus4",
};

/**
 * Does this grip play the chord? Only its notes, the root among them, the
 * 3rd (or sus note) too, and the 7th of a seventh chord. The 5th may go.
 */
function plays(grip: Grip, pcs: number[]): boolean {
  const got = grip.flatMap((f, s) => (f < 0 ? [] : [pitchAt(s, f)]));
  if (!got.length || !got.every((p) => pcs.includes(p))) return false;
  const need = pcs.length === 4 ? [pcs[0], pcs[1], pcs[3]] : [pcs[0], pcs[1]];
  return need.every((p) => got.includes(p));
}

function barre(t: Template | undefined, fret: number): Grip | null {
  if (!t) return null;
  const g = t.map((o) => (o === null ? -1 : o + fret));
  return g.some((f) => f < -1) ? null : g;
}

/** Three or four ways to play `c` in the key of `key`, the easiest first. */
export function fingeringsFor(key: NoteName, c: DiatonicChord): Fingering[] {
  const rootPc = (noteIndex(key) + c.semis) % 12;
  const pcs = c.tones.map((t) => (noteIndex(key) + t) % 12);
  const full: Fingering[] = [];

  const quality = OPEN_QUALITY[c.shape];
  const open = quality ? openShape({ root: NOTES[rootPc], quality }) : null;
  if (open && plays(open.frets, pcs)) full.push({ grip: open.frets, label: "open" });

  const barres: Fingering[] = [];
  const eFret = (rootPc - 4 + 12) % 12;
  const aFret = (rootPc - 9 + 12) % 12;
  const e = barre(E_SHAPE[c.shape], eFret);
  const a = barre(A_SHAPE[c.shape], aFret);
  if (e && plays(e, pcs)) barres.push({ grip: e, label: eFret === 0 ? "open E shape" : `E-shape barre · fret ${eFret}` });
  if (a && plays(a, pcs)) barres.push({ grip: a, label: aFret === 0 ? "open A shape" : `A-shape barre · fret ${aFret}` });
  barres.sort((x, y) => Math.max(...x.grip) - Math.max(...y.grip));
  for (const b of barres) {
    if (!full.some((f) => f.grip.join() === b.grip.join())) full.push(b);
  }

  // Three strings: the triad's inversions on the top strings, or for a
  // seventh its shell — root, 3rd and 7th — which is all it needs.
  const shell = pcs.length === 4;
  const three: Fingering[] = [];
  const target = shell ? [pcs[0], pcs[1], pcs[3]] : pcs.slice(0, 3);
  for (const low of [3, 2]) {
    for (const sh of triadShapes(target, low)) {
      const grip = Array.from({ length: 6 }, (_, s) => (s >= low && s < low + 3 ? sh.frets[s - low] : -1));
      const fret = Math.min(...sh.frets);
      three.push({
        grip,
        label: shell ? `3 strings · shell (root, 3rd, 7th) · fret ${fret}` : `3 strings · ${INVERSION[sh.inversion]} · fret ${fret}`,
      });
    }
  }
  three.sort((x, y) => Math.min(...x.grip.filter((f) => f >= 0)) - Math.min(...y.grip.filter((f) => f >= 0)));

  // Up to three full shapes, then three-string ones to make four — always at
  // least one of those, the minimal way in.
  const out = full.slice(0, 3);
  for (const t of three) {
    if (out.length >= 4) break;
    if (!out.some((f) => f.grip.join() === t.grip.join())) out.push(t);
  }
  return out;
}
