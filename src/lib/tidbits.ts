// Theory tidbits + demo "listening" data for when Spotify isn't connected.

export interface Tidbit {
  title: string;
  body: string;
  link?: { label: string; href: string };
}

export const TIDBITS: Tidbit[] = [
  {
    title: "Why your two scales are secretly one",
    body: "A minor pentatonic and C major pentatonic are the same five notes (A C D E G). Every minor pentatonic box you know is also a major pentatonic box for the key 3 frets up. You already know twice as many scales as you think.",
  },
  {
    title: "The pivot-note trick",
    body: "Adjacent pentatonic boxes overlap on every string — the top note of one box is the bottom note of the next. Slide through a pivot note instead of jumping positions and the seam disappears.",
  },
  {
    title: "The blues note is a bend, not a fret",
    body: "Over dominant chords, bend the ♭3 of the minor pentatonic a half-step toward the major 3. Landing between them is the sound of the blues — the fret in between is called the blue note.",
  },
  {
    title: "Beat 2 and 4 are where the feel lives",
    body: "Rock and pop put the snare on 2 and 4. When you tap your foot, try tapping *lighter* on 1 and 3 and heavier on 2 and 4 — your strumming will instantly sit better in the groove.",
  },
  {
    title: "Your strumming arm is a pendulum",
    body: "Down on the beats, up on the &s — always, even when you don't hit the strings. Misses are part of the pattern. This is why 'D DU UDU' works: the arm never changes speed.",
  },
  {
    title: "Chord tones are safe houses",
    body: "Any note of the current chord will sound good held long. Scale notes between them are hallways — keep moving. Start licks by landing a chord tone on beat 1, then wander.",
  },
  {
    title: "The 12-bar blues is three chords and a map",
    body: "I7 for 4 bars, IV7 for 2, back to I7 for 2, then V–IV–I–V one bar each. Learn it once and you can jam with any blues player on the planet.",
  },
  {
    title: "Why the V chord wants to go home",
    body: "The V chord contains the leading tone — one half-step below the key's root. Your ear hears it as unfinished. That pull (V → I) is called a cadence and it's the engine of almost every progression you know.",
  },
  {
    title: "Dynamics beat speed",
    body: "A ghost strum (near-silent, palm relaxed) followed by an accented one sounds more musical than ten fast even strums. Practice loud-soft-soft-loud on one chord before touching a new song.",
  },
  {
    title: "Relative minor: the 3-fret rule",
    body: "Every major key hides a minor key 3 frets down (A minor lives inside C major). Same chords, same notes — the only difference is which one feels like home.",
  },
  {
    title: "The & of 2 is pop's favorite push",
    body: "Tons of strumming patterns accent the & of 2 and skip beat 3 entirely. That anticipation is called a push. Count '1 2& (3) 4' and you'll start hearing it in every song on the radio.",
  },
  {
    title: "Triads hide inside your boxes",
    body: "Inside every pentatonic box are the arpeggios of the key's chords. Find the root, 3rd and 5th of the current chord inside the box you're in — that's chord+lick playing in one sentence.",
  },
  {
    title: "60 BPM is harder than 120",
    body: "Slow tempos expose your inner clock because there's more silence to drift in. If you can stay locked at 60, 120 is trivial. The reverse is not true.",
  },
  {
    title: "CAGED in one line",
    body: "The five pentatonic boxes trace the five open chord shapes (C-A-G-E-D) moved up the neck. Box 1 of A minor pentatonic wraps around the E-shape barre chord at fret 5 — that's why the root is under your index finger.",
  },
];

export function tidbitOfTheDay(offset = 0): Tidbit {
  const day = Math.floor(Date.now() / 86_400_000);
  return TIDBITS[(day + offset) % TIDBITS.length];
}

// ---------- Demo listening data (until Spotify is connected) ----------

export interface DemoTrack {
  song: string;
  artist: string;
  fact: string;
  bpm?: number; // rough, for "check your tap" moments
}

export const DEMO_TRACKS: DemoTrack[] = [
  {
    song: "Breezeblocks",
    artist: "alt-J",
    fact: "alt-J's name is the Mac keystroke for ∆ (delta) — 'change' in math. Their guitarist rarely plays full barre chords, favoring small 3-note shapes. Good news for chord+lick practice.",
    bpm: 150,
  },
  {
    song: "Do I Wanna Know?",
    artist: "Arctic Monkeys",
    fact: "That main riff is straight minor pentatonic (G minor), played slow and behind the beat. It's proof that feel > speed — the whole riff fits in one box you already know.",
    bpm: 85,
  },
  {
    song: "Redbone",
    artist: "Childish Gambino",
    fact: "Recorded a whole step down and slowed — that syrupy feel is tempo, not effects. Great tap-tempo practice: the groove is huge but the BPM is slower than you think.",
    bpm: 80,
  },
  {
    song: "Little Black Submarines",
    artist: "The Black Keys",
    fact: "Dan Auerbach's solo is A minor pentatonic across three connected positions — it's basically the horizontal-movement exam. The acoustic half is Am–G–F–E: the Andalusian descent.",
    bpm: 130,
  },
];

export const ugSearchUrl = (q: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;
export const ytSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " guitar lesson")}`;
