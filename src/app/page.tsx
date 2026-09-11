"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TIDBITS, ugSearchUrl, ytSearchUrl } from "@/lib/tidbits";
import {
  DrillId, bestRecent, didDrillToday, streak, stage as readStage, tempoFor,
} from "@/lib/store";
import { Song, songOfTheDay, stageInfo } from "@/lib/songs";

interface Step {
  drill: DrillId;
  href: string;
  title: string;
  mins: string;
  blurb: (bpm: number) => string;
}

/** The session, in order. Rhythm first, then the seams, then apply it. */
const SESSION: Step[] = [
  {
    drill: "clock", href: "/groove?tab=tap", title: "Clock", mins: "2 min",
    blurb: (bpm) =>
      `Tap trainer at ${bpm} BPM. Foot on 2 and 4, count out loud. Stop the metronome to log the run — under 25 ms average clears the gate.`,
  },
  {
    drill: "seam", href: "/connect", title: "The Seam", mins: "5 min",
    blurb: (bpm) =>
      `Five scored crossings at ${bpm} BPM. The route shows for one bar, then hides — you play it from memory.`,
  },
  {
    drill: "changes", href: "/practice", title: "Changes", mins: "10 min",
    blurb: (bpm) =>
      `Loop the progression at ${bpm} BPM and land a chord tone on every change. Two times round minimum, or it doesn't count.`,
  },
];

export default function TodayPage() {
  const [done, setDone] = useState<DrillId[]>([]);
  const [skipped, setSkipped] = useState<DrillId[]>([]);
  const [days, setDays] = useState(0);
  const [greeting, setGreeting] = useState("");
  const [tempos, setTempos] = useState<Record<string, number>>({});
  const [stage, setStage] = useState(1);
  const [gateBest, setGateBest] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [tidbitIdx, setTidbitIdx] = useState<number | null>(null);

  useEffect(() => {
    setDone(SESSION.map((s) => s.drill).filter(didDrillToday));
    setDays(streak());
    const st = readStage();
    setStage(st);
    setTempos(Object.fromEntries(SESSION.map((s) => [s.drill, tempoFor(s.drill)])));

    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Up late" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening");

    const day = Math.floor(Date.now() / 86_400_000);
    setTidbitIdx(day % TIDBITS.length);
    setSong(songOfTheDay(st, day));

    const best = bestRecent(st === 2 ? "seam" : "clock", 7);
    setGateBest(best ? (best.unit === "ms" ? `${best.value} ms` : `${best.value}%`) : null);
  }, []);

  const tidbit = tidbitIdx !== null ? TIDBITS[tidbitIdx] : null;
  const stepIdx = SESSION.findIndex((s) => !done.includes(s.drill) && !skipped.includes(s.drill));
  const step = stepIdx === -1 ? null : SESSION[stepIdx];
  const doneCount = SESSION.filter((s) => done.includes(s.drill)).length;
  const info = stageInfo(stage);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-caveat)] text-5xl text-amber-400">muzaklrn</h1>
          <p className="mt-1 text-neutral-400">
            {greeting && `${greeting}. `}Guitar over doomscroll — you&apos;re already here.
          </p>
        </div>
        {days > 0 && (
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold tabular-nums text-neutral-50">{days}🔥</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">day streak</div>
          </div>
        )}
      </header>

      {/* where you are in the curriculum */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-bold text-neutral-50">
            Stage {info.n} · {info.name}
          </p>
          <p className="text-xs uppercase tracking-widest text-neutral-500">{info.weeks}</p>
        </div>
        <p className="mt-1 text-sm text-neutral-400">{info.focus}</p>
        <p className="mt-2 text-sm text-neutral-300">
          <span className="text-amber-300">Gate:</span> {info.gate}
          {gateBest && <span className="text-neutral-500"> · best this week: {gateBest}</span>}
        </p>
      </section>

      {/* the session — one thing at a time */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Today&apos;s session</h2>
          <div className="flex items-center gap-1.5">
            {SESSION.map((s, i) => (
              <span key={s.drill} aria-hidden
                className={`h-1.5 rounded-full transition-all ${
                  done.includes(s.drill) ? "w-6 bg-amber-400"
                    : i === stepIdx ? "w-6 bg-amber-400/40"
                    : "w-1.5 bg-neutral-700"
                }`} />
            ))}
          </div>
        </div>

        {step ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Step {stepIdx + 1} of {SESSION.length} · {step.mins}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-neutral-50">{step.title}</h3>
            <p className="mt-2 max-w-prose text-neutral-300">
              {step.blurb(tempos[step.drill] ?? 70)}
            </p>
            <div className="mt-5 flex items-center gap-4">
              <Link href={step.href}
                className="rounded-full bg-amber-400 px-6 py-2.5 font-bold text-neutral-950 hover:bg-amber-300">
                Start {step.title} →
              </Link>
              <button onClick={() => setSkipped((s) => [...s, step.drill])}
                className="text-sm text-neutral-500 hover:text-neutral-300">
                skip
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-6">
            <h3 className="text-2xl font-bold text-neutral-50">
              {doneCount === SESSION.length ? "Session done." : "Nothing left queued."}
            </h3>
            <p className="mt-2 text-neutral-300">
              {doneCount === SESSION.length
                ? "Rhythm, seams, and application — all three logged. Now the part that isn't scored."
                : "You skipped the rest. Pick a room, or put the session back."}
            </p>
            <div className="mt-5 flex items-center gap-4">
              <Link href="/listen"
                className="rounded-full border border-neutral-600 px-6 py-2.5 text-neutral-200 hover:border-neutral-400">
                Free play →
              </Link>
              {skipped.length > 0 && (
                <button onClick={() => setSkipped([])} className="text-sm text-neutral-500 hover:text-neutral-300">
                  un-skip
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* today's repertoire */}
      {song && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
            Today&apos;s repertoire · 5 min
          </p>
          <h3 className="mt-1.5 text-xl font-bold text-neutral-50">
            {song.title} <span className="font-normal text-neutral-500">— {song.artist}</span>
          </h3>
          <p className="mt-1 text-sm text-amber-300">
            {song.excerpt} · {song.key} {song.kind === "minorPent" ? "minor" : "major"} pentatonic · {song.bpm} BPM
          </p>
          <p className="mt-2 max-w-prose text-sm text-neutral-400">{song.why}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <a href={ytSearchUrl(`${song.artist} ${song.title} lesson`)} target="_blank" rel="noreferrer"
              className="text-amber-400/80 hover:text-amber-400">lesson ↗</a>
            <a href={ugSearchUrl(`${song.artist} ${song.title}`)} target="_blank" rel="noreferrer"
              className="text-amber-400/80 hover:text-amber-400">tab ↗</a>
            <Link href={`/connect?key=${encodeURIComponent(song.key)}&scale=${song.kind === "minorPent" ? "minor" : "major"}`}
              className="text-neutral-500 hover:text-neutral-300">the neck in {song.key} →</Link>
          </div>
        </section>
      )}

      {tidbit && (
        <section className="border-t border-neutral-900 pt-6">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Theory tidbit</p>
            <button onClick={() => setTidbitIdx((i) => ((i ?? 0) + 1) % TIDBITS.length)}
              className="text-xs text-neutral-600 hover:text-amber-400">
              another →
            </button>
          </div>
          <h3 className="mt-1.5 font-bold text-neutral-100">{tidbit.title}</h3>
          <p className="mt-1 max-w-prose text-sm text-neutral-400">{tidbit.body}</p>
        </section>
      )}
    </div>
  );
}
