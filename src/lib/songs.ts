// The repertoire. What "what can I play?" gets answered with.
//
// Each entry is a specific excerpt at a specific tempo, not a whole song —
// four to eight bars played right beats three minutes played approximately.
// Tempos are the target for the stage, not the record tempo.

import { NoteName, ScaleKind } from "./theory";

export type Skill = "timing" | "horizontal" | "phrasing" | "chords" | "repertoire";

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: NoteName;
  kind: ScaleKind;
  /** Target tempo for the excerpt, BPM. */
  bpm: number;
  stage: 1 | 2 | 3 | 4;
  skill: Skill;
}

export const SONGS: Song[] = [
  // ---- Stage 1: the clock ----
  {
    id: "do-i-wanna-know",
    title: "Do I Wanna Know?", artist: "Arctic Monkeys",
    key: "G", kind: "minorPent", bpm: 85, stage: 1, skill: "timing",
  },
  {
    id: "blues-in-a",
    title: "12-bar blues in A", artist: "Traditional",
    key: "A", kind: "minorPent", bpm: 80, stage: 1, skill: "timing",
  },
  {
    id: "andalusian-oldfaithful",
    title: "Am–G–F–E", artist: "Andalusian cadence",
    key: "A", kind: "minorPent", bpm: 100, stage: 1, skill: "timing",
  },
  {
    id: "seven-nation",
    title: "Seven Nation Army", artist: "The White Stripes",
    key: "E", kind: "minorPent", bpm: 124, stage: 1, skill: "timing",
  },
  {
    id: "come-as-you-are",
    title: "Come As You Are", artist: "Nirvana",
    key: "E", kind: "minorPent", bpm: 120, stage: 1, skill: "timing",
  },

  // ---- Stage 2: horizontal ----
  {
    id: "little-black-submarines",
    title: "Little Black Submarines", artist: "The Black Keys",
    key: "A", kind: "minorPent", bpm: 96, stage: 2, skill: "horizontal",
  },
  {
    id: "sunshine-of-your-love",
    title: "Sunshine of Your Love", artist: "Cream",
    key: "D", kind: "minorPent", bpm: 116, stage: 2, skill: "horizontal",
  },
  {
    id: "stairway",
    title: "Stairway to Heaven", artist: "Led Zeppelin",
    key: "A", kind: "minorPent", bpm: 88, stage: 2, skill: "horizontal",
  },
  {
    id: "comfortably-numb",
    title: "Comfortably Numb", artist: "Pink Floyd",
    key: "B", kind: "minorPent", bpm: 63, stage: 2, skill: "phrasing",
  },
  {
    id: "since-ive-been-loving",
    title: "Since I've Been Loving You", artist: "Led Zeppelin",
    key: "C", kind: "minorPent", bpm: 50, stage: 2, skill: "phrasing",
  },
  {
    id: "hey-joe",
    title: "Hey Joe", artist: "Jimi Hendrix",
    key: "E", kind: "minorPent", bpm: 82, stage: 2, skill: "horizontal",
  },

  // ---- Stage 3: chords and licks are the same thing ----
  {
    id: "little-wing",
    title: "Little Wing", artist: "Jimi Hendrix",
    key: "E", kind: "minorPent", bpm: 68, stage: 3, skill: "chords",
  },
  {
    id: "sultans",
    title: "Sultans of Swing", artist: "Dire Straits",
    key: "D", kind: "minorPent", bpm: 148, stage: 3, skill: "chords",
  },
  {
    id: "black-magic-woman",
    title: "Black Magic Woman", artist: "Santana",
    key: "D", kind: "minorPent", bpm: 116, stage: 3, skill: "phrasing",
  },
  {
    id: "thrill-is-gone",
    title: "The Thrill Is Gone", artist: "B.B. King",
    key: "B", kind: "minorPent", bpm: 96, stage: 3, skill: "phrasing",
  },
  {
    id: "wish-you-were-here",
    title: "Wish You Were Here", artist: "Pink Floyd",
    key: "G", kind: "majorPent", bpm: 60, stage: 3, skill: "chords",
  },
  {
    id: "under-the-bridge",
    title: "Under the Bridge", artist: "Red Hot Chili Peppers",
    key: "D", kind: "majorPent", bpm: 84, stage: 3, skill: "chords",
  },
  {
    id: "lenny",
    title: "Lenny", artist: "Stevie Ray Vaughan",
    key: "E", kind: "majorPent", bpm: 66, stage: 3, skill: "chords",
  },

  // ---- Stage 4: the set ----
  {
    id: "ill-play-the-blues",
    title: "I'll Play the Blues for You", artist: "Albert King",
    key: "C", kind: "minorPent", bpm: 70, stage: 4, skill: "repertoire",
  },
  {
    id: "aint-no-sunshine",
    title: "Ain't No Sunshine", artist: "Bill Withers",
    key: "A", kind: "minorPent", bpm: 78, stage: 4, skill: "repertoire",
  },
  {
    id: "let-it-be",
    title: "Let It Be", artist: "The Beatles",
    key: "C", kind: "majorPent", bpm: 72, stage: 4, skill: "repertoire",
  },
  {
    id: "roadhouse",
    title: "Pride and Joy", artist: "Stevie Ray Vaughan",
    key: "E", kind: "minorPent", bpm: 128, stage: 4, skill: "repertoire",
  },
  {
    id: "looper-jam",
    title: "Em–D looper jam", artist: "Yours",
    key: "E", kind: "minorPent", bpm: 92, stage: 4, skill: "repertoire",
  },
];

export const songsForStage = (stage: number) => SONGS.filter((s) => s.stage === stage);

/**
 * Today's repertoire pick. Rotates by day so it changes without being random —
 * the same day always gives the same song, on any device, with no stored state.
 */
export function songOfTheDay(stage: number, dayIndex: number): Song | null {
  const pool = songsForStage(stage);
  return pool.length ? pool[dayIndex % pool.length] : null;
}

