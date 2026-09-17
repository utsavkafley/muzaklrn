// The groove clock, hoisted out of the Groove room.
//
// It used to be a Metronome owned by the page, stopped on unmount — so walking
// from Groove to Connect killed the click mid-bar. It lives here instead, as
// one clock for the whole app: start it in Groove, practise anywhere, and stop
// it from anywhere. Nothing else in the app shares it; the drills in Connect,
// Practice and Modes each keep their own clock, because those are scored runs
// with their own tempo ladders.

import { Metronome, Tick, Voice, audioCtx, click, strumNoise } from "./audio";
import { StrumSlot } from "./strums";

export interface GrooveState {
  running: boolean;
  bpm: number;
  /** Subdivisions per beat. A strum pattern overrides this to 8ths. */
  subsPerBeat: number;
  /** Silence everything that isn't a beat. */
  muteOffbeats: boolean;
  /** The strum pattern driving it, or null for a plain click. */
  slots: StrumSlot[] | null;
}

const IDLE: GrooveState = {
  running: false, bpm: 90, subsPerBeat: 1, muteOffbeats: false, slots: null,
};

let state: GrooveState = IDLE;
let met: Metronome | null = null;
let uiTick: ((sub: number) => void) | null = null;

/**
 * Handles for clicks already committed to the audio graph. The scheduler works
 * up to 1.5s ahead in a hidden tab, so stopping has to cancel the future as
 * well as the present or the groove ticks on after you kill it.
 */
let scheduled: Voice[] = [];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeGroove(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Stable identity between changes, so useSyncExternalStore behaves. */
export const grooveState = (): GrooveState => state;
export const grooveServerState = (): GrooveState => IDLE;
export const isGrooveRunning = () => state.running;

/** Strum patterns always run on an 8th-note grid. */
const effectiveSubs = () => (state.slots ? 2 : state.subsPerBeat);

function handleTick(t: Tick) {
  const { slots, muteOffbeats } = state;
  const isBeat = t.sub % t.subsPerBeat === 0;
  const beat = Math.floor(t.sub / t.subsPerBeat);

  if (slots) {
    const slot = slots[t.sub % 8];
    if (slot?.stroke) scheduled.push(strumNoise(t.when, slot.stroke === "U", slot.accent));
    if (isBeat && !muteOffbeats) scheduled.push(click(t.when, beat === 0, 0.5));
  } else if (!muteOffbeats || isBeat) {
    scheduled.push(click(t.when, t.sub === 0, isBeat ? 1 : 0.45));
  }
  if (scheduled.length > 96) scheduled = scheduled.slice(-96);

  const delay = Math.max(0, (t.when - audioCtx().currentTime) * 1000);
  setTimeout(() => uiTick?.(t.sub), delay);
}

function getMet() {
  if (!met) {
    met = new Metronome();
    met.onTick = handleTick;
    met.beatsPerBar = 4;
  }
  return met;
}

export function startGroove() {
  audioCtx();
  const m = getMet();
  m.bpm = state.bpm;
  m.subsPerBeat = effectiveSubs();
  scheduled = [];
  m.start();
  state = { ...state, running: true };
  emit();
}

export function stopGroove() {
  if (!state.running) return;
  met?.stop();
  scheduled.forEach((v) => v.stop());
  scheduled = [];
  uiTick?.(-1);
  state = { ...state, running: false };
  emit();
}

export function setGrooveBpm(bpm: number) {
  const next = Math.max(30, Math.min(240, Math.round(bpm)));
  if (next === state.bpm) return;
  state = { ...state, bpm: next };
  if (met) met.bpm = next;
  emit();
}

export function setGrooveSubs(subsPerBeat: number) {
  if (subsPerBeat === state.subsPerBeat) return;
  state = { ...state, subsPerBeat };
  if (met) met.subsPerBeat = effectiveSubs();
  emit();
}

export function setGrooveMute(muteOffbeats: boolean) {
  if (muteOffbeats === state.muteOffbeats) return;
  state = { ...state, muteOffbeats };
  emit();
}

export function setGrooveSlots(slots: StrumSlot[] | null) {
  if (slots === state.slots) return;
  state = { ...state, slots };
  if (met) met.subsPerBeat = effectiveSubs();
  emit();
}

/** The Groove room attaches its beat display; everyone else leaves it null. */
export function setGrooveUi(fn: ((sub: number) => void) | null) {
  uiTick = fn;
}

/** Signed ms offset of a tap from the nearest beat, or null if not running. */
export const grooveTapOffset = (at: number) => met?.tapOffset(at) ?? null;
