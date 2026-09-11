// localStorage-backed practice log + tiny helpers. All client-side.

const KEY = "muzaklrn.practice"; // { "2026-07-17": ["groove","connect"] }

export type Room = "connect" | "groove" | "practice" | "listen" | "piano";

const todayKey = () => new Date().toISOString().slice(0, 10);

function read(): Record<string, Room[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function logPractice(room: Room) {
  const log = read();
  const t = todayKey();
  const rooms = new Set(log[t] ?? []);
  rooms.add(room);
  log[t] = [...rooms];
  localStorage.setItem(KEY, JSON.stringify(log));
}

export function practicedToday(): Room[] {
  return read()[todayKey()] ?? [];
}

export function streak(): number {
  const log = read();
  let n = 0;
  const d = new Date();
  // today counts if practiced; otherwise streak starts from yesterday
  if (!log[d.toISOString().slice(0, 10)]?.length) d.setDate(d.getDate() - 1);
  while (log[d.toISOString().slice(0, 10)]?.length) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Cross-room handoff: "practice tap tempo with this song"
const SONG_KEY = "muzaklrn.pendingSong";
export function setPendingSong(s: { song: string; artist: string; bpm?: number }) {
  localStorage.setItem(SONG_KEY, JSON.stringify(s));
}
export function takePendingSong(): { song: string; artist: string; bpm?: number } | null {
  const raw = localStorage.getItem(SONG_KEY);
  if (!raw) return null;
  localStorage.removeItem(SONG_KEY);
  try { return JSON.parse(raw); } catch { return null; }
}
