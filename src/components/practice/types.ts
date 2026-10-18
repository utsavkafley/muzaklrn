// The contract the practice steps plug into. A step is a way of playing over
// the progression — chord tones, shapes, phrases — with its own few options,
// and the phrase it puts on the neck. The shared player sounds and animates
// it, bar by bar, and trades bars with you on "your turn".

import { ChordKind, ChordRef, DiatonicChord } from "@/lib/harmony";
import { Mode } from "@/lib/modes";
import { RiffNote } from "@/lib/riffs";
import { NoteName } from "@/lib/theory";

/** Something to play on the neck. */
export interface Phrase {
  id: string;
  name: string;
  /** Ends on a landing note the neck should mark. */
  lands?: boolean;
  /** Dots are labelled by their job in the chord (R 3 5 7), not their scale degree. */
  roles?: boolean;
  /** Number the notes in playing order (a written phrase), or not (a line through chords). */
  numbered?: boolean;
  /**
   * The notes for progression bar `idx`, whose chord is `chord`; with no
   * progression, idx is 0 and chord the one in focus (or null).
   */
  notesFor: (chord: DiatonicChord | null, idx: number) => RiffNote[];
  /** Where the bar after `idx` begins: the landing to aim for. */
  targetAfter?: (idx: number) => RiffNote[];
}

export interface PracticeCtx {
  note: NoteName;
  name: string;
  keyPc: number;
  scale: number[];
  shown: number[];
  mode: Mode | null;
  kind: ChordKind;
  chordOf: (ref: ChordRef) => DiatonicChord;
  /** The chord in focus: playing, or last tapped. */
  focus: DiatonicChord | null;
  /** The progression's bars that hold chords, each as its one or two chords. */
  progression: DiatonicChord[][];
  /** The hand position: frets lo to lo + 4. */
  lo: number;
  fillFor: (string: number, fret: number) => string;
  preview: (p: Phrase | null) => void;
}

export interface OptionsProps<S> {
  ctx: PracticeCtx;
  sel: S;
  setSel: (s: S) => void;
}

export interface Step<S> {
  id: string;
  label: string;
  /** One line on what to do, shown under the options. */
  how: string;
  initial: S;
  Options: (p: OptionsProps<S>) => React.ReactNode;
  phrase: (ctx: PracticeCtx, sel: S) => Phrase | null;
}

/** Erase a step's option type so steps of every kind share one list. */
export const defineStep = <S,>(s: Step<S>) => s as unknown as Step<unknown>;
