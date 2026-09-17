// The repertoire. What "what can I play?" gets answered with.
//
// Each entry is a specific excerpt at a specific tempo, not a whole song —
// four to eight bars played right beats three minutes played approximately.
// Tempos are the target for the stage, not the record tempo.

import { NoteName, ScaleKind } from "./theory";

export type Skill = "timing" | "horizontal" | "phrasing" | "chords" | "repertoire";

export const SKILL_LABEL: Record<Skill, string> = {
  timing: "Timing & feel",
  horizontal: "Horizontal movement",
  phrasing: "Phrasing",
  chords: "Chords & licks",
  repertoire: "Repertoire",
};

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
  /** The specific bars to work — never "the whole song". */
  excerpt: string;
  /** Why this one, in a sentence. */
  why: string;
}

export const SONGS: Song[] = [
  // ---- Stage 1: the clock ----
  {
    id: "do-i-wanna-know",
    title: "Do I Wanna Know?", artist: "Arctic Monkeys",
    key: "G", kind: "minorPent", bpm: 85, stage: 1, skill: "timing",
    excerpt: "Main riff, first 4 bars",
    why: "Every note sits in one box you already own, so the entire exercise is behind-the-beat placement. Proof that feel beats speed.",
  },
  {
    id: "blues-in-a",
    title: "12-bar blues in A", artist: "Traditional",
    key: "A", kind: "minorPent", bpm: 80, stage: 1, skill: "timing",
    excerpt: "A5→A6 boogie comp, three choruses",
    why: "The shuffle comp is the foundation of everything later. Held for three choruses without drifting, it stops being strummed mush and becomes a groove.",
  },
  {
    id: "andalusian-oldfaithful",
    title: "Am–G–F–E", artist: "Andalusian cadence",
    key: "A", kind: "minorPent", bpm: 100, stage: 1, skill: "timing",
    excerpt: "Two unbroken minutes, D–DU–UDU",
    why: "Click muted every other bar. If you're still on the 1 when it comes back, your time is internal rather than borrowed.",
  },
  {
    id: "seven-nation",
    title: "Seven Nation Army", artist: "The White Stripes",
    key: "E", kind: "minorPent", bpm: 124, stage: 1, skill: "timing",
    excerpt: "Main riff",
    why: "Single-string, no chords, impossible to hide behind. Pure note placement.",
  },
  {
    id: "come-as-you-are",
    title: "Come As You Are", artist: "Nirvana",
    key: "E", kind: "minorPent", bpm: 120, stage: 1, skill: "timing",
    excerpt: "Intro riff, 8 bars",
    why: "Two strings, one position, relentless eighth notes. The metronome exam disguised as a song.",
  },

  // ---- Stage 2: horizontal ----
  {
    id: "little-black-submarines",
    title: "Little Black Submarines", artist: "The Black Keys",
    key: "A", kind: "minorPent", bpm: 96, stage: 2, skill: "horizontal",
    excerpt: "Solo, full",
    why: "A minor pentatonic across three connected positions — the horizontal-movement exam. If you can play this, the seam work has landed.",
  },
  {
    id: "sunshine-of-your-love",
    title: "Sunshine of Your Love", artist: "Cream",
    key: "D", kind: "minorPent", bpm: 116, stage: 2, skill: "horizontal",
    excerpt: "Solo, full",
    why: "Climbs the neck in D minor pentatonic. Short, famous, and it cannot be played from one box.",
  },
  {
    id: "stairway",
    title: "Stairway to Heaven", artist: "Led Zeppelin",
    key: "A", kind: "minorPent", bpm: 88, stage: 2, skill: "horizontal",
    excerpt: "Solo, first 8 bars only",
    why: "The canonical A-minor horizontal study. Not the whole thing — the first eight bars, properly.",
  },
  {
    id: "comfortably-numb",
    title: "Comfortably Numb", artist: "Pink Floyd",
    key: "B", kind: "minorPent", bpm: 63, stage: 2, skill: "phrasing",
    excerpt: "Solo 1, opening phrase",
    why: "The vibrato exam. One bend, held, shaken. If it doesn't sound like Gilmour you aren't finished.",
  },
  {
    id: "since-ive-been-loving",
    title: "Since I've Been Loving You", artist: "Led Zeppelin",
    key: "C", kind: "minorPent", bpm: 50, stage: 2, skill: "phrasing",
    excerpt: "First solo phrase",
    why: "Slow enough that every bend is exposed. Nowhere to hide a flat one.",
  },
  {
    id: "hey-joe",
    title: "Hey Joe", artist: "Jimi Hendrix",
    key: "E", kind: "minorPent", bpm: 82, stage: 2, skill: "horizontal",
    excerpt: "Solo, first 8 bars",
    why: "Moves through positions casually, the way you want it to feel rather than the way it looks on a diagram.",
  },

  // ---- Stage 3: chords and licks are the same thing ----
  {
    id: "little-wing",
    title: "Little Wing", artist: "Jimi Hendrix",
    key: "E", kind: "minorPent", bpm: 68, stage: 3, skill: "chords",
    excerpt: "Intro and first verse",
    why: "The definitive chord+lick piece — every held chord grows a melody out of it. This one song is the whole stage.",
  },
  {
    id: "sultans",
    title: "Sultans of Swing", artist: "Dire Straits",
    key: "D", kind: "minorPent", bpm: 148, stage: 3, skill: "chords",
    excerpt: "Verse comp + intro fills",
    why: "Chord-fragment based and rhythmically merciless. Teaches comping and filling as one motion.",
  },
  {
    id: "black-magic-woman",
    title: "Black Magic Woman", artist: "Santana",
    key: "D", kind: "minorPent", bpm: 116, stage: 3, skill: "phrasing",
    excerpt: "Dm Dorian vamp, first solo chorus",
    why: "Melody over two chords, forever. The vamp is already in the app's progression bank.",
  },
  {
    id: "thrill-is-gone",
    title: "The Thrill Is Gone", artist: "B.B. King",
    key: "B", kind: "minorPent", bpm: 96, stage: 3, skill: "phrasing",
    excerpt: "First solo chorus",
    why: "The economy-of-notes exam. Three notes with perfect vibrato beat thirty without.",
  },
  {
    id: "wish-you-were-here",
    title: "Wish You Were Here", artist: "Pink Floyd",
    key: "G", kind: "majorPent", bpm: 60, stage: 3, skill: "chords",
    excerpt: "Intro, full",
    why: "Chord shapes with melody threaded through them — the same idea as Little Wing at half the difficulty.",
  },
  {
    id: "under-the-bridge",
    title: "Under the Bridge", artist: "Red Hot Chili Peppers",
    key: "D", kind: "majorPent", bpm: 84, stage: 3, skill: "chords",
    excerpt: "Intro, 8 bars",
    why: "Triads on the top strings moving through changes. Exactly the CAGED-triad skill, in a song you already know.",
  },
  {
    id: "lenny",
    title: "Lenny", artist: "Stevie Ray Vaughan",
    key: "E", kind: "majorPent", bpm: 66, stage: 3, skill: "chords",
    excerpt: "Opening 8 bars",
    why: "Major pentatonic over held chords, played gently. Teaches that the switch to major pentatonic is a sound, not a rule.",
  },

  // ---- Stage 4: the set ----
  {
    id: "ill-play-the-blues",
    title: "I'll Play the Blues for You", artist: "Albert King",
    key: "C", kind: "minorPent", bpm: 70, stage: 4, skill: "repertoire",
    excerpt: "Full arrangement",
    why: "Slow blues, end to end, from memory. Dynamics are the whole performance.",
  },
  {
    id: "aint-no-sunshine",
    title: "Ain't No Sunshine", artist: "Bill Withers",
    key: "A", kind: "minorPent", bpm: 78, stage: 4, skill: "repertoire",
    excerpt: "Full, guitar and keys",
    why: "The piano track's goal song too — two hands, both instruments, same key. Where the tracks meet.",
  },
  {
    id: "let-it-be",
    title: "Let It Be", artist: "The Beatles",
    key: "C", kind: "majorPent", bpm: 72, stage: 4, skill: "repertoire",
    excerpt: "Full, guitar and keys",
    why: "The other keys goal. I–V–vi–IV with both hands while the Beat Buddy runs.",
  },
  {
    id: "roadhouse",
    title: "Pride and Joy", artist: "Stevie Ray Vaughan",
    key: "E", kind: "minorPent", bpm: 128, stage: 4, skill: "repertoire",
    excerpt: "Shuffle comp + one solo chorus",
    why: "Comping and soloing in the same breath at speed. The Stage 1 shuffle, grown up.",
  },
  {
    id: "looper-jam",
    title: "Em–D looper jam", artist: "Yours",
    key: "E", kind: "minorPent", bpm: 92, stage: 4, skill: "repertoire",
    excerpt: "Four-bar loop, three-minute solo",
    why: "Intro, build, solo, ending. Not noodling — a shape you'd play in front of people.",
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

// ---------- stages ----------

export interface Stage {
  n: 1 | 2 | 3 | 4;
  name: string;
  weeks: string;
  focus: string;
  /** The measurable condition for moving on. */
  gate: string;
}

export const STAGES: Stage[] = [
  { n: 1, name: "The Clock", weeks: "Weeks 1–6", focus: "Timing, feel, and two adjacent positions.",
    gate: "Average timing miss under 25 ms at 80 BPM." },
  { n: 2, name: "Horizontal", weeks: "Weeks 7–16", focus: "All five positions linked, including 5↔1 across the octave.",
    gate: "Land the called target 8 times out of 10." },
  { n: 3, name: "Chords and Licks", weeks: "Weeks 17–30", focus: "Triads through the changes, modal colour, looper craft.",
    gate: "A four-bar loop with no audible seam." },
  { n: 4, name: "The Set", weeks: "Weeks 31–52", focus: "Repertoire from memory, dynamics, playing with the drummer.",
    gate: "Six to eight songs end to end." },
];

export const stageInfo = (n: number): Stage => STAGES[Math.max(0, Math.min(3, n - 1))];
