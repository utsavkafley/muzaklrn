"use client";

import { arpeggioModule } from "./ArpeggioModule";
import { circleModule } from "./CircleModule";
import { licksModule, riffsModule } from "./PhraseListModule";
import { triadModule } from "./TriadModule";
import { Phrase, StudyCtx, StudyModule } from "./types";

/** Every study module, in tab order. Adding one is adding it here. */
export const MODULES: StudyModule<unknown>[] = [riffsModule, licksModule, arpeggioModule, triadModule, circleModule];

/** How a phrase is being learned: hear it once, trade bars with it, or loop it. */
export type Pass = "hear" | "echo" | "loop";
const PASSES: { pass: Pass; label: string }[] = [
  { pass: "hear", label: "hear" },
  { pass: "echo", label: "echo" },
  { pass: "loop", label: "loop" },
];

interface Props {
  ctx: StudyCtx;
  tab: string;
  setTab: (id: string) => void;
  sels: Record<string, unknown>;
  setSel: (id: string, sel: unknown) => void;
  /** The phrase the open module has chosen, if any. */
  phrase: Phrase | null;
  pass: Pass;
  setPass: (p: Pass) => void;
  follow: boolean;
  setFollow: (f: boolean) => void;
  /** Loop is running: offer the tempo step. */
  canClimb: boolean;
  onClimb: () => void;
}

/**
 * One place for everything you can study over the key: a tab per module, the
 * module's own controls, and — whenever it has put a phrase on the neck — the
 * same player controls for all of them.
 */
export default function StudyPanel({
  ctx, tab, setTab, sels, setSel, phrase, pass, setPass, follow, setFollow, canClimb, onClimb,
}: Props) {
  const mod = MODULES.find((m) => m.id === tab) ?? MODULES[0];
  const Panel = mod.Panel;
  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white/60 p-3 sm:p-4">
      <div role="tablist" className="flex flex-wrap justify-center gap-x-1 gap-y-1 border-b border-neutral-200 pb-2">
        {MODULES.map((m) => (
          <button key={m.id} role="tab" aria-selected={m.id === mod.id} onClick={() => setTab(m.id)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              m.id === mod.id ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      <Panel ctx={ctx} sel={sels[mod.id] ?? mod.initial} setSel={(s) => setSel(mod.id, s)} />

      {phrase && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex gap-1">
            {PASSES.map((x) => (
              <button key={x.pass} onClick={() => setPass(x.pass)} aria-pressed={pass === x.pass}
                className={`rounded-full px-3 py-1 transition-colors ${
                  pass === x.pass ? "bg-neutral-800 text-neutral-50" : "text-neutral-500 hover:text-neutral-800"
                }`}>
                {x.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-neutral-600">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-neutral-800" />
            follow chords
          </label>
          {canClimb && (
            <button onClick={onClimb}
              className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 hover:border-neutral-500">
              ✓ clean · +5 bpm
            </button>
          )}
        </div>
      )}
    </section>
  );
}
