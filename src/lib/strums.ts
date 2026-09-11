// Strumming patterns on an 8th-note grid. Each slot: D(own), U(p), or rest.

export interface StrumSlot {
  stroke: "D" | "U" | null;
  accent?: boolean;
}

export interface StrumPattern {
  id: string;
  name: string;
  hint: string;
  level: 1 | 2 | 3;
  slots: StrumSlot[]; // length 8 = one bar of 8ths
}

const s = (stroke: "D" | "U" | null, accent = false): StrumSlot => ({ stroke, accent });

export const STRUM_PATTERNS: StrumPattern[] = [
  {
    id: "quarters",
    name: "Four on the floor",
    hint: "All downstrums, accent the 1. Boring on purpose — this is your foot-tap calibration.",
    level: 1,
    slots: [s("D", true), s(null), s("D"), s(null), s("D"), s(null), s("D"), s(null)],
  },
  {
    id: "d-du",
    name: "D – D – DU – DU",
    hint: "Keep the arm swinging on every 8th; the U just catches the strings on the way back up.",
    level: 1,
    slots: [s("D", true), s(null), s("D"), s(null), s("D"), s("U"), s("D"), s("U")],
  },
  {
    id: "old-faithful",
    name: "Old Faithful: D – DU – UDU",
    hint: "The most-used strum in pop. The missing hit on beat 3 is the whole trick — your arm still moves down, it just misses.",
    level: 2,
    slots: [s("D", true), s(null), s("D"), s("U"), s(null), s("U"), s("D"), s("U")],
  },
  {
    id: "pushed",
    name: "Pushed: D – – U – UDU",
    hint: "Nothing lands on beat 3 or its &... the push lives on the & of 2. Count out loud: 1 (2) & (3) & 4 &.",
    level: 3,
    slots: [s("D", true), s(null), s(null), s("U"), s(null), s("U"), s("D"), s("U")],
  },
  {
    id: "reggae",
    name: "Offbeat skank",
    hint: "Only the &s. Mute with your palm on the beats. If you can hold this for 2 minutes your inner clock is real.",
    level: 3,
    slots: [s(null), s("U"), s(null), s("U"), s(null), s("U"), s(null), s("U")],
  },
  {
    id: "sixteenth-feel",
    name: "Dynamics drill: ghost the 2 and 4",
    hint: "All 8ths, but only 1 and 3 ring out — play 2 and 4 as near-silent ghost strums. Dynamics are volume control, not speed.",
    level: 2,
    slots: [s("D", true), s("U"), s("D"), s("U"), s("D", true), s("U"), s("D"), s("U")],
  },
];

export const COUNT_LABELS: Record<number, string[]> = {
  1: ["1", "2", "3", "4"],
  2: ["1", "&", "2", "&", "3", "&", "4", "&"],
  3: ["1", "trip", "let", "2", "trip", "let", "3", "trip", "let", "4", "trip", "let"],
  4: ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"],
};
