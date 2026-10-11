// The contract every study module plugs into. A module is a tab: a panel of
// its own controls, and optionally a phrase — notes on the neck that the
// shared player sounds, animates, trades bars with and moves with the chords.
// Add a module by writing one of these and listing it in StudyPanel.

import { ChordKind, ChordRef, DiatonicChord } from "@/lib/harmony";
import { Mode } from "@/lib/modes";
import { RiffNote } from "@/lib/riffs";
import { NoteName } from "@/lib/theory";

/** Something to play on the neck: riff, lick, arpeggio, triad run. */
export interface Phrase {
  id: string;
  name: string;
  /** Ends on a landing note the neck should mark. */
  lands?: boolean;
  /**
   * The notes, placed on the neck, over `chord` — the chord of the bar when
   * following a progression, or null for the phrase as chosen.
   */
  notesFor: (chord: DiatonicChord | null) => RiffNote[];
}

/** Everything a module may read about the page, and the few things it may do. */
export interface StudyCtx {
  note: NoteName;
  name: string;
  keyPc: number;
  /** The seven notes, semitones above the root. */
  scale: number[];
  shown: number[];
  mode: Mode | null;
  /** The chord kind the chord row offers: triads, sevenths, sus. */
  kind: ChordKind;
  chordOf: (ref: ChordRef) => DiatonicChord;
  /** The seven chords of the current kind; null where the kind doesn't fit. */
  chords: (DiatonicChord | null)[];
  /** The chord last tapped or playing. */
  focus: DiatonicChord | null;
  /** Play a phrase once, now, without the metronome. */
  preview: (p: Phrase | null) => void;
  /** Change key, as if typed. */
  setKey: (text: string) => void;
  /** Change mode, by its intervals. */
  setShown: (intervals: number[]) => void;
}

export interface PanelProps<S> {
  ctx: StudyCtx;
  sel: S;
  setSel: (s: S) => void;
}

export interface StudyModule<S> {
  id: string;
  label: string;
  initial: S;
  Panel: (p: PanelProps<S>) => React.ReactNode;
  /** What this selection plays on the neck, if anything. */
  phrase?: (ctx: StudyCtx, sel: S) => Phrase | null;
}

/** Erase a module's selection type so modules of every kind share one list. */
export const defineModule = <S,>(m: StudyModule<S>) => m as unknown as StudyModule<unknown>;
