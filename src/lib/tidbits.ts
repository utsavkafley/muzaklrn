// Demo "listening" data for when Spotify isn't connected, plus search links.

export interface DemoTrack {
  song: string;
  artist: string;
  bpm?: number; // rough, for "check your tap" moments
}

export const DEMO_TRACKS: DemoTrack[] = [
  { song: "Breezeblocks", artist: "alt-J", bpm: 150 },
  { song: "Do I Wanna Know?", artist: "Arctic Monkeys", bpm: 85 },
  { song: "Redbone", artist: "Childish Gambino", bpm: 80 },
  { song: "Little Black Submarines", artist: "The Black Keys", bpm: 130 },
];

export const ugSearchUrl = (q: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;
export const ytSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " guitar lesson")}`;
