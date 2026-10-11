// Phrases generated from a chord rather than written by hand: arpeggios in
// the key's own position on the neck, and triads as three-string shapes
// climbing it. Both come out as riff notes, so they play, animate and follow
// a progression exactly as riffs and licks do.

import { midiAt, pitchAt } from "./theory";
import { RiffNote } from "./riffs";

/**
 * Where the key lives on the neck: the fret of its root on the low E string,
 * kept off the nut so there is room below it.
 */
export function homeFret(keyPc: number): number {
  const f = (keyPc - 4 + 12) % 12;
  return f < 2 ? f + 12 : f;
}

export type ArpPattern = "up-back" | "two-octaves";
export const ARP_PATTERNS: { pattern: ArpPattern; label: string }[] = [
  { pattern: "up-back", label: "up and back" },
  { pattern: "two-octaves", label: "two octaves" },
];

/**
 * An arpeggio of the chord with pitch classes `pcs` (root first), played in
 * one five-fret window near `anchor`: every chord tone in the window, low to
 * high from the lowest root. "Up and back" climbs five notes and returns in a
 * bar; "two octaves" climbs as high as the window goes and comes back down
 * to the root over two bars.
 */
export function arpeggio(pcs: number[], anchor: number, pattern: ArpPattern, maxFret = 15): RiffNote[] {
  const root = pcs[0];
  // The window nearest the anchor that has the chord's root on a bass string.
  const starts = [0, -1, 1, -2, 2, -3, 3, -4, 4].map((d) => anchor - 1 + d).filter((w) => w >= 0 && w + 4 <= maxFret);
  const lo = starts.find((w) => [0, 1, 2].some((s) => frets(w).some((f) => pitchAt(s, f) === root))) ?? starts[0];

  const seen = new Set<number>();
  const notes: { string: number; fret: number; midi: number }[] = [];
  for (let s = 0; s < 6; s++) {
    for (const f of frets(lo)) {
      const midi = midiAt(s, f);
      if (!pcs.includes(pitchAt(s, f)) || seen.has(midi)) continue;
      seen.add(midi);
      notes.push({ string: s, fret: f, midi });
    }
  }
  notes.sort((a, b) => a.midi - b.midi);
  const from = notes.findIndex((x) => midiPc(x.midi) === root);
  const up = notes.slice(Math.max(from, 0));

  let path: typeof up;
  if (pattern === "up-back") {
    const top = up.slice(0, 5);
    path = [...top, ...top.slice(1, -1).reverse()].slice(0, 8);
  } else {
    const top = up.slice(0, 9);
    path = [...top, ...top.slice(0, -1).reverse()];
  }
  return path.map((x, i) => ({
    at: i, string: x.string, fret: x.fret,
    // The last note rings out to the end of its bar.
    len: i === path.length - 1 ? Math.max(1, 8 * Math.ceil((i + 1) / 8) - i) : 1,
  }));
}

const frets = (lo: number) => [lo, lo + 1, lo + 2, lo + 3, lo + 4];
const midiPc = (m: number) => m % 12;

/** The four string sets a three-note shape can sit on, top to bottom. */
export const STRING_SETS: { low: number; label: string }[] = [
  { low: 3, label: "G B e" },
  { low: 2, label: "D G B" },
  { low: 1, label: "A D G" },
  { low: 0, label: "E A D" },
];

/** Root position, first and second inversion, by which chord tone is lowest. */
export const INVERSION = ["root position", "1st inversion", "2nd inversion"];

export interface TriadShape {
  frets: number[];
  /** 0 root in the bass, 1 the third, 2 the fifth. */
  inversion: number;
}

/**
 * Every shape of a triad (`pcs` root, third, fifth) on three neighbouring
 * strings from `low`, one of each chord tone, the hand spanning at most
 * three frets — up the neck from the nut. Each inversion recurs every
 * octave; this keeps the first run of shapes that fits on the neck.
 */
export function triadShapes(pcs: number[], low: number, maxFret = 15): TriadShape[] {
  const found: TriadShape[] = [];
  for (let a = 0; a <= maxFret; a++) for (let b = 0; b <= maxFret; b++) for (let c = 0; c <= maxFret; c++) {
    const fr = [a, b, c];
    const got = fr.map((f, i) => pitchAt(low + i, f));
    if (new Set(got).size !== 3 || !got.every((p) => pcs.includes(p))) continue;
    if (Math.max(...fr) - Math.min(...fr) > 3) continue;
    found.push({ frets: fr, inversion: pcs.indexOf(got[0]) });
  }
  // Up the neck, and no two shapes on the same frets.
  found.sort((x, y) => Math.min(...x.frets) - Math.min(...y.frets) || x.frets[0] - y.frets[0]);
  const out: TriadShape[] = [];
  for (const sh of found) {
    const last = out[out.length - 1];
    if (last && Math.min(...sh.frets) <= Math.min(...last.frets)) continue;
    out.push(sh);
  }
  return out;
}

/**
 * The triad's shapes up the neck as a phrase: each struck together, one a
 * half note, as many bars as the shapes fill (up to two).
 */
export function triadPhrase(shapes: TriadShape[], low: number): RiffNote[] {
  return shapes.slice(0, 8).flatMap((sh, i) =>
    sh.frets.map((f, k) => ({ at: i * 2, len: 2, string: low + k, fret: f })));
}
