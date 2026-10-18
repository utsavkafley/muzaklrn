// Where the key sits on the neck, and triads as three-string shapes up it.

import { pitchAt } from "./theory";

/**
 * Where the key lives on the neck: the fret of its root on the low E string,
 * kept off the nut so there is room below it.
 */
export function homeFret(keyPc: number): number {
  const f = (keyPc - 4 + 12) % 12;
  return f < 2 ? f + 12 : f;
}

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
