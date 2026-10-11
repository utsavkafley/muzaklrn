# muzaklrn

Guitar practice: a key, its modes, the chords they build, and how each one feels.

## The page

One page, built around a key:

- **Note** — type a root (`bb`, `F#`); it lights up across the neck.
- **Modes and intervals** — pick a mode or toggle intervals; each mode shows the mood of its seven chords under its name.
- **Chords** — the seven chords the scale builds, coloured by mood: **home** (at rest), **away** (left home), **tension** (pulls back). Hover one for a full shape and a three-string grip.
- **Progression** — tap chords into bars, add bars as you need them, load a mode's vamp, and play it over a counted-in metronome. The neck keeps the key and marks the playing chord's notes as diamonds.
- **Study** — one panel, a tab per module, all playing on the same neck with the same controls (**hear** once, **echo** to trade bars, **loop** and push the tempo, **follow chords** to move with the progression):
  - **Riffs** — one-bar figures low on the neck, simplest first.
  - **Licks** — one- and two-bar lead phrases that land on the root; the landing note is ringed.
  - **Arpeggios** — any chord of the key, one note at a time, all in the key's home position; following a progression, every chord is found in that same box.
  - **Triads** — a chord's three shapes (root position, 1st and 2nd inversion) climbing one string set.
  - **Circle of fifths** — your key's chords lit on the circle in their moods, home ringed, with what it means for the key and mode; tap any key to go there.

  Techniques play on the neck itself: a ripple where a note is picked, an arc for a hammer-on or pull-off, the dot travelling for a slide, the string bowing for a bend. New modules plug in by writing one component (`src/components/study/`) and listing it in `StudyPanel`.

Every colour means the same thing everywhere: a note of the home chord is home, a note a half step from the tonic is tension, the rest is away. A chord with two home notes is home; one with a tension note is tension.

## Run it

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Push to GitHub, import in Vercel — zero config. Everything is client-side (Web Audio); no server, no database.
