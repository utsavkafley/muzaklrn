# muzaklrn

Guitar practice for the seams between what you already know. A better way to spend phone time than reddit.

## The rooms

| Room | What it trains |
| --- | --- |
| **Today** | Daily menu, streak, theory tidbit, "want to learn this?" card from your listening |
| **Connect** | Horizontal movement — the five pentatonic boxes and the pivot notes that join them. Tap notes to hear them; "hear the crossing" plays a run across a seam |
| **Groove** | Inner clock: metronome with subdivisions and count display, tap-timing trainer (scores you in ms, tells you if you rush or drag), strumming patterns with accents/dynamics |
| **Practice** | Chord+lick: progression backing (bass + strums + click), chord diagrams, and a fretboard that highlights the current chord's safe landing notes inside any pentatonic box |
| **Listen** | Spotify recently-played → Ultimate Guitar tab links, YouTube lessons, artist tidbits, and a tap-tempo handoff to Groove |

## Run it

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Push to GitHub, import in Vercel — zero config. Everything is client-side (Web Audio + localStorage); no server, no database.

## Spotify (optional — demo mode works without it)

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URIs: `http://127.0.0.1:3000/listen` (dev) and `https://<your-app>.vercel.app/listen` (prod)
3. Set `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` in `.env.local` and in Vercel project env vars

Uses Authorization Code + PKCE — no client secret, safe to run fully in the browser. Scopes: `user-read-recently-played`, `user-top-read`.

> Note: Spotify retired the audio-features (BPM) endpoint for new apps in Nov 2024, so tempo-matching is done by ear via the tap-tempo button — which is deliberate rhythm practice anyway.
