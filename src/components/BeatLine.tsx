"use client";

import { useEffect, useState } from "react";
import { audioCtx } from "@/lib/audio";

/** One bar on the clock: when it starts, how long an eighth is, whose turn. */
export interface BarClock {
  start: number;
  secPerEighth: number;
  countIn: boolean;
  /** Echo's answering bar: the app is silent and you play. */
  yours: boolean;
  /** Which bar of a multi-bar phrase this is. */
  part: number;
}

interface Props {
  clock: React.RefObject<BarClock[]>;
  live: boolean;
  /** 4 for beats alone, 8 when a phrase wants its eighth notes seen. */
  steps: 4 | 8;
  /** Eighth notes where a phrase note starts, for each bar of the phrase. */
  hits: number[][];
}

/**
 * Where in the bar we are, under the note. With a riff chosen it counts
 * eighths, and the eighths where the riff plays are marked, so its rhythm
 * reads before a note sounds. Grey through the count-in; dark on your turn.
 */
export default function BeatLine({ clock, live, steps, hits }: Props) {
  const [pos, setPos] = useState<{ step: number; countIn: boolean; yours: boolean; part: number } | null>(null);

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      const now = audioCtx().currentTime;
      const bar = [...clock.current].reverse().find((b) => b.start <= now);
      if (bar) {
        const eighth = Math.floor((now - bar.start) / bar.secPerEighth);
        const step = steps === 8 ? eighth : Math.floor(eighth / 2);
        setPos(step < steps ? { step, countIn: bar.countIn, yours: bar.yours, part: bar.part } : null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, clock, steps]);

  const now = live ? pos : null;
  // The bar of the phrase in play, or its first bar while still.
  const barHits = hits[now && !now.countIn ? now.part % Math.max(hits.length, 1) : 0] ?? [];
  if (!live && !hits.length) return <div aria-hidden className="col-start-2 mt-4 h-2.5" />;
  return (
    <div aria-hidden className="relative col-start-2 mt-4 flex h-2.5 items-center justify-center gap-1.5">
      {Array.from({ length: steps }, (_, i) => {
        const hit = steps === 8 && barHits.includes(i);
        const current = now?.step === i;
        return (
          <span key={i}
            className={`rounded-full transition-colors duration-75 ${
              steps === 8 && !hit ? "h-1.5 w-1.5" : "h-2.5 w-2.5"
            } ${
              current ? (now!.countIn ? "bg-neutral-500" : now!.yours ? "bg-neutral-900" : "bg-amber-500")
                : hit ? "bg-neutral-400" : "bg-neutral-200"
            }`} />
        );
      })}
      {now?.yours ? (
        <span className="absolute top-full mt-1 text-xs font-bold text-neutral-900">your turn</span>
      ) : hits.length > 1 && (
        <span className="absolute top-full mt-1 text-xs text-neutral-400">
          bar {(now && !now.countIn ? now.part % hits.length : 0) + 1} of {hits.length}
        </span>
      )}
    </div>
  );
}
