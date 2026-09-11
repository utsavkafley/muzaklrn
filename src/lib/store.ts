// Practice record. localStorage-backed, client-side only.
//
// The rule this file exists to enforce: **a drill is logged when it is
// completed, with a number attached.** Opening a page records nothing. A
// streak you can farm by tapping tabs trains tab-tapping, so there is
// deliberately no way to log anything without a measured result.

export type Room = "connect" | "groove" | "practice" | "listen" | "piano";

/** The measurable drills. Anything not in here cannot be logged. */
export type DrillId = "clock" | "seam" | "changes";

export const DRILL_ROOM: Record<DrillId, Room> = {
  clock: "groove",
  seam: "connect",
  changes: "practice",
};

export const DRILL_LABEL: Record<DrillId, string> = {
  clock: "Clock",
  seam: "The Seam",
  changes: "Changes",
};

/** Starting tempo for each drill, before the ladder moves it. */
export const DRILL_BASE_BPM: Record<DrillId, number> = {
  clock: 70,
  seam: 70,
  changes: 80,
};

export interface DrillResult {
  drill: DrillId;
  /** The measurement. Meaning depends on `unit`. */
  value: number;
  unit: "ms" | "pct";
  /** BPM the drill was performed at. */
  tempo: number;
  /** Did it clear the threshold for that tempo? Drives the ladder. */
  passed: boolean;
  at: number;
}

interface Progress {
  v: 1;
  stage: number;
  /** Current rung of the tempo ladder, per drill. */
  tempos: Partial<Record<DrillId, number>>;
  /** Consecutive passes (+n) or misses (-n), per drill. */
  run: Partial<Record<DrillId, number>>;
  /** "YYYY-MM-DD" -> results that day. */
  log: Record<string, DrillResult[]>;
}

const KEY = "muzaklrn.progress.v1";
const MIN_BPM = 40;
const MAX_BPM = 200;
const STEP_BPM = 4;

const empty = (): Progress => ({ v: 1, stage: 1, tempos: {}, run: {}, log: {} });

const dayKey = (d = new Date()) => {
  // Local date, not ISO/UTC — practising at 11pm should not count as tomorrow.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function read(): Progress {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Progress;
    if (p?.v !== 1) return empty();
    return { ...empty(), ...p, log: p.log ?? {}, tempos: p.tempos ?? {}, run: p.run ?? {} };
  } catch {
    return empty();
  }
}

/** Subscribers for useSyncExternalStore, so components derive rather than copy. */
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function write(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode, quota — practising still works, it just isn't recorded */
  }
  listeners.forEach((fn) => fn());
}

/**
 * Record a completed drill and move its tempo ladder.
 *
 * The student never chooses the tempo: two passes in a row moves it up a rung,
 * two misses moves it down. That keeps the decision out of the session, where
 * it would cost willpower that should go into playing.
 */
export function logDrill(r: Omit<DrillResult, "at">): { tempoChanged: number } {
  const p = read();
  const today = dayKey();
  const result: DrillResult = { ...r, at: Date.now() };
  p.log[today] = [...(p.log[today] ?? []), result];

  const prev = p.run[r.drill] ?? 0;
  const run = r.passed ? Math.max(0, prev) + 1 : Math.min(0, prev) - 1;
  p.run[r.drill] = run;

  const current = p.tempos[r.drill] ?? DRILL_BASE_BPM[r.drill];
  let next = current;
  if (run >= 2) { next = Math.min(MAX_BPM, current + STEP_BPM); p.run[r.drill] = 0; }
  else if (run <= -2) { next = Math.max(MIN_BPM, current - STEP_BPM); p.run[r.drill] = 0; }
  p.tempos[r.drill] = next;

  write(p);
  return { tempoChanged: next - current };
}

/** Tempo this drill should run at right now. */
export function tempoFor(drill: DrillId): number {
  return read().tempos[drill] ?? DRILL_BASE_BPM[drill];
}

export function resultsToday(): DrillResult[] {
  return read().log[dayKey()] ?? [];
}

/** Did this drill get completed today — not merely visited. */
export function didDrillToday(drill: DrillId): boolean {
  return resultsToday().some((r) => r.drill === drill);
}

export function drillsCompletedToday(): DrillId[] {
  return [...new Set(resultsToday().map((r) => r.drill))];
}

/** Consecutive days with at least one completed drill. */
export function streak(): number {
  const p = read();
  const has = (d: Date) => (p.log[dayKey(d)]?.length ?? 0) > 0;
  const d = new Date();
  // Today only breaks the streak once it's over; until then count from yesterday.
  if (!has(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Best (lowest for ms, highest for pct) result for a drill in the last `days`. */
export function bestRecent(drill: DrillId, days = 7): DrillResult | null {
  const p = read();
  const out: DrillResult[] = [];
  const d = new Date();
  for (let i = 0; i < days; i++) {
    out.push(...(p.log[dayKey(d)] ?? []).filter((r) => r.drill === drill));
    d.setDate(d.getDate() - 1);
  }
  if (!out.length) return null;
  return out.reduce((best, r) =>
    r.unit === "ms" ? (r.value < best.value ? r : best) : (r.value > best.value ? r : best),
  );
}

/** Per-drill tempo history, oldest first — for a progress graph. */
export function tempoHistory(drill: DrillId, days = 30): { day: string; tempo: number }[] {
  const p = read();
  const out: { day: string; tempo: number }[] = [];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const k = dayKey(d);
    const rs = (p.log[k] ?? []).filter((r) => r.drill === drill);
    if (rs.length) out.push({ day: k, tempo: Math.max(...rs.map((r) => r.tempo)) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function stage(): number {
  return read().stage;
}

export function setStage(n: number) {
  const p = read();
  p.stage = Math.max(1, Math.min(4, n));
  write(p);
}

/** Wipe everything. Used by the reset control. */
export function resetProgress() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

// Cross-room handoff: "practice tap tempo with this song"
const SONG_KEY = "muzaklrn.pendingSong";
export function setPendingSong(s: { song: string; artist: string; bpm?: number }) {
  try { localStorage.setItem(SONG_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function takePendingSong(): { song: string; artist: string; bpm?: number } | null {
  try {
    const raw = localStorage.getItem(SONG_KEY);
    if (!raw) return null;
    localStorage.removeItem(SONG_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
