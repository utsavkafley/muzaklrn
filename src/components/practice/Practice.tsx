"use client";

import { STEPS } from "./steps";
import { PracticeCtx } from "./types";

interface Props {
  ctx: PracticeCtx;
  /** Move the hand position by `by` frets. */
  onMove: (by: number) => void;
  canMove: { down: boolean; up: boolean };
  step: string;
  setStep: (id: string) => void;
  sels: Record<string, unknown>;
  setSel: (id: string, sel: unknown) => void;
  /** Trade bars: the app plays one, you answer the next. */
  yourTurn: boolean;
  setYourTurn: (on: boolean) => void;
  /** Running: offer the tempo step. */
  canClimb: boolean;
  onClimb: () => void;
}

/**
 * Playing over the progression, one hand position at a time. Pick where on
 * the neck to play, then a step of the ladder — chord tones, shapes,
 * phrases — and press space.
 */
export default function Practice({
  ctx, onMove, canMove, step, setStep, sels, setSel, yourTurn, setYourTurn, canClimb, onClimb,
}: Props) {
  const current = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const Options = current.Options;
  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Where the hand is. Moving it a couple of frets at a time walks the
            neck box by box — the same chords, found again higher up. */}
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <button onClick={() => onMove(-2)} disabled={!canMove.down} aria-label="move position down the neck"
            className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100 disabled:opacity-30">‹</button>
          <span className="tabular-nums">
            Position <b className="text-neutral-900">frets {ctx.lo}–{ctx.lo + 4}</b>
          </span>
          <button onClick={() => onMove(2)} disabled={!canMove.up} aria-label="move position up the neck"
            className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100 disabled:opacity-30">›</button>
        </div>

        <div role="tablist" className="flex gap-1">
          {STEPS.map((s, i) => (
            <button key={s.id} role="tab" aria-selected={s.id === current.id} onClick={() => setStep(s.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                s.id === current.id ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
              }`}>
              <span className="mr-1 text-xs opacity-60">{i + 1}</span>{s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input type="checkbox" checked={yourTurn} onChange={(e) => setYourTurn(e.target.checked)} className="accent-neutral-800" />
            your turn
          </label>
          {canClimb && (
            <button onClick={onClimb}
              className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 hover:border-neutral-500">
              ✓ clean · +5 bpm
            </button>
          )}
        </div>
      </div>

      <Options ctx={ctx} sel={sels[current.id] ?? current.initial} setSel={(s) => setSel(current.id, s)} />
      <p className="text-center text-xs leading-relaxed text-neutral-500">
        {current.how} <span className="text-neutral-400">Space plays and pauses; “your turn” leaves every other bar to you.</span>
      </p>
    </section>
  );
}
