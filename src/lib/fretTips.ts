// A few lines of theory about any note on the neck: what it is in the key,
// how it feels and where it wants to go, what it's doing in the chord, and
// where else the same note lives — the last one is how the neck gets learned.

import { DiatonicChord, Mood, noteMood, spelled } from "./harmony";
import { pitchAt, spellInterval } from "./theory";

const STRING = ["low E", "A", "D", "G", "B", "high E"];

export interface FretTip {
  title: string;
  mood: Mood | "outside";
  lines: string[];
}

interface Ctx {
  keyPc: number;
  keyName: string;
  /** Intervals switched on, semitones above the tonic. */
  shown: number[];
  homeTones: number[];
  chord: DiatonicChord | null;
  maxFret: number;
}

/** A pitch's name in this key, spelled the way the key spells it. */
function nameOf(iv: number, c: Ctx): string {
  if (iv === 0) return c.keyName;
  const x = spelled(iv, c.shown);
  return spellInterval(c.keyName, x.semis, x.steps);
}

/** The same pitch an octave away: two strings over, two frets along (three across the B string). */
function octave(s: number, f: number, maxFret: number): { s: number; f: number; up: boolean } | null {
  if (s <= 3) {
    const nf = f + (s >= 2 ? 3 : 2);
    if (nf <= maxFret) return { s: s + 2, f: nf, up: true };
  }
  if (s >= 2) {
    const nf = f - (s >= 4 ? 3 : 2);
    if (nf >= 0) return { s: s - 2, f: nf, up: false };
  }
  return null;
}

/** The same pitch on the next string up: five frets back (four across G to B). */
function unison(s: number, f: number): { s: number; f: number } | null {
  if (s >= 5) return null;
  const nf = f - (s === 3 ? 4 : 5);
  return nf >= 0 ? { s: s + 1, f: nf } : null;
}

const ROLE: Record<string, string[]> = {
  triad: ["root", "3rd", "5th"],
  seventh: ["root", "3rd", "5th", "7th"],
  sus2: ["root", "2nd", "5th"],
  sus4: ["root", "4th", "5th"],
};

export function fretTip(string: number, fret: number, c: Ctx): FretTip {
  const pc = pitchAt(string, fret);
  const iv = (pc - c.keyPc + 12) % 12;
  const inKey = iv === 0 || c.shown.includes(iv);
  const name = nameOf(iv, c);
  const label = spelled(iv, c.shown).label;
  const mood = noteMood(iv, c.homeTones);
  const lines: string[] = [];

  // What it does in the key.
  if (iv === 0) {
    lines.push("Home itself. Every phrase that ends here sounds finished.");
  } else if (!inKey) {
    lines.push(`Outside the key — a chromatic note. Use it in passing, or bend into it, then step to a key note.`);
  } else if (mood === "home") {
    lines.push("Home: one of the home chord's notes. Land on it and the music rests.");
  } else if (mood === "tension") {
    lines.push(`Tension: a half step from ${c.keyName}, and it leans hard toward it. Resolve it there.`);
  } else {
    // The nearest home note, to step to.
    const near = c.homeTones
      .map((h) => ({ h, d: Math.min((h - iv + 12) % 12, (iv - h + 12) % 12) }))
      .sort((a, b) => a.d - b.d)[0];
    lines.push(`Away: a passing colour. It sounds best stepping to a home note — ${nameOf(near.h, c)} is ${near.d === 1 ? "a half step" : near.d === 2 ? "a whole step" : `${near.d} frets`} away.`);
  }

  // Its job in the chord in focus.
  if (c.chord) {
    const k = c.chord.tones.indexOf(iv);
    lines.push(k >= 0
      ? `In ${c.chord.name} it is the ${(ROLE[c.chord.kind] ?? ROLE.triad)[k] ?? "chord tone"}.`
      : `Not in ${c.chord.name}: over that chord it's a passing note.`);
  }

  // Where else it lives.
  const where: string[] = [];
  const u = unison(string, fret);
  if (u) where.push(`${STRING[u.s]} string fret ${u.f} (same pitch)`);
  const o = octave(string, fret, c.maxFret);
  if (o) where.push(`${STRING[o.s]} string fret ${o.f} (octave ${o.up ? "up" : "down"})`);
  if (where.length) lines.push(`Also at: ${where.join(" · ")}. Every ${name} is ringed.`);

  // A landmark, to hang the rest on.
  if (fret === 0) lines.push(`The open ${STRING[string]} string.`);
  else if (fret === 12) lines.push(`Fret 12 is the open string an octave up: ${STRING[string]} again.`);
  else if (fret === 5 && string < 5) lines.push(`Fret 5 sounds the next string open${string === 3 ? " — except on G, where it's fret 4" : ""}.`);
  else if (fret === 4 && string === 3) lines.push("Fret 4 on G is open B: the one string pair tuned a third apart.");
  else if (fret === 7) lines.push("Fret 7 is the open string's 5th — the power-chord partner.");

  return {
    title: iv === 0 ? `${name} — the tonic` : `${name} — the ${label} of ${c.keyName}`,
    mood: inKey ? (iv === 0 ? "home" : mood) : "outside",
    lines,
  };
}
