// Strumming patterns on an 8th-note grid. Each slot: D(own), U(p), or rest.

export interface StrumSlot {
  stroke: "D" | "U" | null;
  accent?: boolean;
}

export interface StrumPattern {
  id: string;
  level: 1 | 2 | 3;
  slots: StrumSlot[]; // length 8 = one bar of 8ths
}

const s = (stroke: "D" | "U" | null, accent = false): StrumSlot => ({ stroke, accent });

export const STRUM_PATTERNS: StrumPattern[] = [
  {
    id: "quarters",
    level: 1,
    slots: [s("D", true), s(null), s("D"), s(null), s("D"), s(null), s("D"), s(null)],
  },
  {
    id: "d-du",
    level: 1,
    slots: [s("D", true), s(null), s("D"), s(null), s("D"), s("U"), s("D"), s("U")],
  },
  {
    id: "old-faithful",
    level: 2,
    slots: [s("D", true), s(null), s("D"), s("U"), s(null), s("U"), s("D"), s("U")],
  },
  {
    id: "pushed",
    level: 3,
    slots: [s("D", true), s(null), s(null), s("U"), s(null), s("U"), s("D"), s("U")],
  },
  {
    id: "reggae",
    level: 3,
    slots: [s(null), s("U"), s(null), s("U"), s(null), s("U"), s(null), s("U")],
  },
  {
    id: "sixteenth-feel",
    level: 2,
    slots: [s("D", true), s("U"), s("D"), s("U"), s("D", true), s("U"), s("D"), s("U")],
  },
];

/** The pattern drawn as strokes — its own label, no name needed. */
export const patternGlyphs = (p: StrumPattern) =>
  p.slots.map((s) => (s.stroke === "D" ? "↓" : s.stroke === "U" ? "↑" : "·"));

export const COUNT_LABELS: Record<number, string[]> = {
  1: ["1", "2", "3", "4"],
  2: ["1", "&", "2", "&", "3", "&", "4", "&"],
  3: ["1", "trip", "let", "2", "trip", "let", "3", "trip", "let", "4", "trip", "let"],
  4: ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"],
};
