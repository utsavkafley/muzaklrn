"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ugSearchUrl, ytSearchUrl } from "@/lib/tidbits";
import {
  DrillId, didDrillToday, stage as readStage, streak, tempoFor,
} from "@/lib/store";
import { SCALE_LABEL } from "@/lib/theory";
import { Song, songOfTheDay } from "@/lib/songs";

interface Step {
  drill: DrillId;
  href: string;
  /** The icon of the room this step lives in — the same glyph the nav uses. */
  icon: string;
}

/** The session, in order. Rhythm first, then the seams, then apply it. */
const SESSION: Step[] = [
  { drill: "clock", href: "/groove?tab=tap", icon: "◉" },
  { drill: "seam", href: "/connect", icon: "⌁" },
  { drill: "changes", href: "/practice", icon: "♩" },
];

export default function TodayPage() {
  const [done, setDone] = useState<DrillId[]>([]);
  const [colourDone, setColourDone] = useState(false);
  const [skipped, setSkipped] = useState<DrillId[]>([]);
  const [days, setDays] = useState(0);
  const [tempos, setTempos] = useState<Record<string, number>>({});
  const [song, setSong] = useState<Song | null>(null);

  useEffect(() => {
    setDone(SESSION.map((s) => s.drill).filter(didDrillToday));
    setColourDone(didDrillToday("colour"));
    setDays(streak());
    setTempos(Object.fromEntries(SESSION.map((s) => [s.drill, tempoFor(s.drill)])));
    const day = Math.floor(Date.now() / 86_400_000);
    setSong(songOfTheDay(readStage(), day));
  }, []);

  const stepIdx = SESSION.findIndex((s) => !done.includes(s.drill) && !skipped.includes(s.drill));
  const step = stepIdx === -1 ? null : SESSION[stepIdx];
  const doneCount = SESSION.filter((s) => done.includes(s.drill)).length;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-[family-name:var(--font-caveat)] text-5xl text-amber-700">muzaklrn</h1>
        {days > 0 && (
          <div className="shrink-0 text-3xl font-bold tabular-nums text-neutral-900">
            {days}<span aria-hidden>🔥</span>
          </div>
        )}
      </header>

      <section>
        <div className="mb-3 flex items-center justify-end gap-1.5">
          {SESSION.map((s, i) => (
            <span key={s.drill} aria-hidden
              className={`h-1.5 rounded-full transition-all ${
                done.includes(s.drill) ? "w-6 bg-amber-400"
                  : i === stepIdx ? "w-6 bg-amber-400/40"
                  : "w-1.5 bg-neutral-300"
              }`} />
          ))}
        </div>

        {step ? (
          <div className="flex items-center gap-5 rounded-2xl border border-neutral-200 bg-neutral-100/50 p-6">
            <span aria-hidden className="text-5xl leading-none text-amber-700">{step.icon}</span>
            <div className="tabular-nums">
              <span className="text-4xl font-bold text-neutral-900">{tempos[step.drill] ?? 70}</span>
              <span className="ml-1.5 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => setSkipped((s) => [...s, step.drill])}
                aria-label="skip"
                className="h-11 w-11 rounded-full border border-neutral-300 text-neutral-500">✕</button>
              <Link href={step.href} aria-label="start"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-xl text-neutral-950 hover:bg-amber-300">
                ▶
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
            <div className="flex items-center gap-4">
              <span aria-hidden className="text-4xl leading-none text-emerald-700">
                {doneCount === SESSION.length ? "✓" : "—"}
              </span>
              <div className="ml-auto flex items-center gap-3">
                {skipped.length > 0 && (
                  <button onClick={() => setSkipped([])} aria-label="un-skip"
                    className="h-11 w-11 rounded-full border border-neutral-300 text-neutral-500">↺</button>
                )}
                <Link href="/listen" aria-label="free play"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-400 text-xl text-neutral-700 hover:border-neutral-600">
                  ♫
                </Link>
              </div>
            </div>

            {/* The encore sits outside the three dots on purpose: it is ears,
                not fingers, and the session still counts on a day you skip it. */}
            {doneCount === SESSION.length && (
              <Link href="/modes"
                className="mt-5 flex items-center gap-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 hover:border-neutral-400">
                <span aria-hidden className="text-4xl leading-none text-amber-700">◐</span>
                <div className="tabular-nums">
                  <span className="text-3xl font-bold text-neutral-900">{tempoFor("colour")}</span>
                  <span className="ml-1.5 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
                </div>
                <span aria-hidden className="ml-auto text-xl text-emerald-700">
                  {colourDone ? "✓" : "▶"}
                </span>
              </Link>
            )}
          </div>
        )}
      </section>

      {song && (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-5">
          <h2 className="text-xl font-bold text-neutral-900">
            {song.title} <span className="font-normal text-neutral-500">— {song.artist}</span>
          </h2>
          <p className="mt-1 text-sm tabular-nums text-amber-700">
            {song.key} {SCALE_LABEL[song.kind]} · {song.bpm}
            <span className="ml-1 text-xs uppercase tracking-widest text-neutral-500">bpm</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-lg">
            <a href={ytSearchUrl(`${song.artist} ${song.title}`)} target="_blank" rel="noreferrer"
              aria-label="video" className="text-amber-700/80 hover:text-amber-700">▶↗</a>
            <a href={ugSearchUrl(`${song.artist} ${song.title}`)} target="_blank" rel="noreferrer"
              aria-label="tab" className="text-amber-700/80 hover:text-amber-700">♪↗</a>
            <Link aria-label="fretboard"
              href={`/connect?key=${encodeURIComponent(song.key)}&scale=${song.kind === "minorPent" ? "minor" : "major"}`}
              className="ml-auto text-neutral-500 hover:text-neutral-800">⌁→</Link>
          </div>
        </section>
      )}
    </div>
  );
}
