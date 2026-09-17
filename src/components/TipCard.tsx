"use client";

import { useMemo, useState } from "react";
import { Tip, TipContext, TipRoom, tipsFor } from "@/lib/tips";

interface Props {
  room: TipRoom;
  ctx: TipContext;
  /** Optional heading override. */
  label?: string;
}

/**
 * One contextual tip at a time, with a way to cycle.
 *
 * The index is derived from the key and scale rather than randomised, so the
 * same view always shows the same tip (no hydration mismatch, and nothing
 * shuffles under you mid-session) while changing key surfaces something new.
 */
export default function TipCard({ room, ctx, label = "Tip" }: Props) {
  const tips = useMemo(() => tipsFor(room, ctx), [room, ctx]);
  const [nudge, setNudge] = useState(0);

  if (!tips.length) return null;
  const tip: Tip = tips[nudge % tips.length];

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700/90">{label}</p>
        {tips.length > 1 && (
          <button
            onClick={() => setNudge((n) => n + 1)}
            className="text-xs text-neutral-500 hover:text-amber-700"
          >
            another →
          </button>
        )}
      </div>
      <h3 className="mt-1.5 font-bold text-neutral-950">{tip.title}</h3>
      <p className="mt-1 max-w-prose text-sm text-neutral-700">{tip.body}</p>
    </section>
  );
}
