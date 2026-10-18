# muzaklrn

Guitar practice: a key, its modes, the chords they build, and how each one feels.

## The page

One page, built around a key:

- **Note** — type a root (`bb`, `F#`); it lights up across the neck.
- **Modes and intervals** — pick a mode or toggle intervals; each mode shows the mood of its seven chords under its name.
- **Chords** — the seven chords the scale builds, coloured by mood: **home** (at rest), **away** (left home), **tension** (pulls back). Hover one for a full shape and a three-string grip.
- **Progression** — tap chords into bars, add bars as you need them, load a mode's vamp, and play it over a counted-in metronome. The neck keeps the key and marks the playing chord's notes as diamonds.
- **Fingerings** — hover any chord for its common shapes, one at a time (‹ › or the arrow keys): open, both barres, three-string grips.
- **Changing chords** — hold a bar to turn its chord into any shape on the same root, in the key or out of it (ii → II7 leans into V).
- **Saved progressions** — kept in this browser with their key, mode and tempo.
- **Practice** — one hand position (five frets, moved with ‹ ›) and a ladder of three steps over the progression, played with space:
  1. **Chord tones** — each chord's notes inside the position, each bar starting on the note nearest where the last ended; the ringed "next" note is where the next chord begins.
  2. **Shapes** — each chord as the nearest three-string triad shape.
  3. **Phrases** — riffs and licks for the mode, easiest first, with techniques animated on the neck.

  "Your turn" trades bars with the app. The circle of fifths opens beside the mode picker as reference.
- **The neck** — hover or tap any note for what it is in the key, how it feels, its job in the chord, and where else it lives (every copy is ringed).

Every colour means the same thing everywhere: a note of the home chord is home, a note a half step from the tonic is tension, the rest is away. A chord with two home notes is home; one with a tension note is tension.

## Run it

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Push to GitHub, import in Vercel — zero config. Everything is client-side (Web Audio); no server, no database.
