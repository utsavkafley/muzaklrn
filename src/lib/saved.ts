// Progressions saved in this browser, to come back to. Each keeps everything
// needed to pick up where you left off: key, mode, bars and tempo.

import { Bar } from "./progressions";

export interface SavedProgression {
  id: string;
  /** e.g. "A Aeolian · i – ♭VI – ♭III – ♭VII" */
  name: string;
  key: string;
  shown: number[];
  bars: Bar[];
  bpm: number;
}

const KEY = "muzaklrn.progressions";
const LIMIT = 24;
const EMPTY: SavedProgression[] = [];

let cache: SavedProgression[] | null = null;
const listeners = new Set<() => void>();

function read(): SavedProgression[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as SavedProgression[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: SavedProgression[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or full: keep it for this visit at least */
  }
  listeners.forEach((fn) => fn());
}

export const subscribeSaved = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
/** Stable between changes, for useSyncExternalStore. */
export const savedSnapshot = () => read();
export const savedServerSnapshot = () => EMPTY;

/** Save, newest first; saving the same name again replaces it. */
export function saveProgression(p: Omit<SavedProgression, "id">) {
  const rest = read().filter((x) => x.name !== p.name);
  write([{ ...p, id: `${Date.now()}` }, ...rest].slice(0, LIMIT));
}

export function deleteProgression(id: string) {
  write(read().filter((x) => x.id !== id));
}
