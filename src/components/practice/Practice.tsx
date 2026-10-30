"use client";

import { STEPS } from "./steps";
import { PracticeCtx } from "./types";

interface Props {
  ctx: PracticeCtx;
  step: string;
  setStep: (id: string) => void;
  sels: Record<string, unknown>;
  setSel: (id: string, sel: unknown) => void;
  /** Trade bars: the app plays one, you answer the next. */
  yourTurn: boolean;
  setYourTurn: (on: boolean) => void;
}

/**
 * Playing over the progression where the hand is — the frame on the neck,
 * dragged to move it. Pick a step — chord tones, triads, intervals — and
 * press space.
 */
export default function Practice({ ctx, step, setStep, sels, setSel, yourTurn, setYourTurn }: Props) {
  const current = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const Options = current.Options;
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div role="tablist" className="flex gap-1">
          {STEPS.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === current.id} onClick={() => setStep(s.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                s.id === current.id ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-neutral-500"
          title="The app plays a bar, you answer the next">
          <input type="checkbox" checked={yourTurn} onChange={(e) => setYourTurn(e.target.checked)} className="accent-neutral-800" />
          your turn
        </label>
      </div>

      <Options ctx={ctx} sel={sels[current.id] ?? current.initial} setSel={(s) => setSel(current.id, s)} />

      <p className="text-center text-xs leading-relaxed text-neutral-500">{current.how}</p>
    </section>
  );
}
