"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TIDBITS, DEMO_TRACKS, ugSearchUrl, ytSearchUrl } from "@/lib/tidbits";
import { practicedToday, streak, Room } from "@/lib/store";
import { isConnected, recentlyPlayed, SpotifyTrack } from "@/lib/spotify";

interface LearnCard {
  song: string;
  artist: string;
  fact?: string;
}

/** The session, in order. Rhythm first, then the seams, then apply it. */
const SESSION: { room: Room; href: string; title: string; blurb: string; mins: string }[] = [
  { room: "groove", href: "/groove", title: "Groove", blurb: "Tap trainer at 70 BPM. Foot on the beats, count out loud — build the inner clock before anything else.", mins: "2 min" },
  { room: "connect", href: "/connect", title: "Connect", blurb: "Boxes 1↔2 in A minor pentatonic. Cross the seam five times, both directions, through the pivot note.", mins: "5 min" },
  { room: "practice", href: "/practice", title: "Practice", blurb: "Loop I–V–vi–IV and land a chord tone on every change. Switch boxes each round.", mins: "10 min" },
];

export default function TodayPage() {
  const [done, setDone] = useState<Room[]>([]);
  const [skipped, setSkipped] = useState<Room[]>([]);
  const [days, setDays] = useState(0);
  const [greeting, setGreeting] = useState("");
  const [tidbitIdx, setTidbitIdx] = useState<number | null>(null);
  const [learn, setLearn] = useState<LearnCard | null>(null);

  useEffect(() => {
    setDone(practicedToday());
    setDays(streak());
    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Up late" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening");

    const day = Math.floor(Date.now() / 86_400_000);
    setTidbitIdx(day % TIDBITS.length);

    (async () => {
      if (isConnected()) {
        const tracks: SpotifyTrack[] | null = await recentlyPlayed();
        if (tracks?.length) {
          const t = tracks[day % tracks.length];
          setLearn({ song: t.song, artist: t.artist });
          return;
        }
      }
      const d = DEMO_TRACKS[day % DEMO_TRACKS.length];
      setLearn({ song: d.song, artist: d.artist, fact: d.fact });
    })();
  }, []);

  const tidbit = tidbitIdx !== null ? TIDBITS[tidbitIdx] : null;
  const stepIdx = SESSION.findIndex((s) => !done.includes(s.room) && !skipped.includes(s.room));
  const step = stepIdx === -1 ? null : SESSION[stepIdx];
  const doneCount = SESSION.filter((s) => done.includes(s.room)).length;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-caveat)] text-5xl text-amber-400">muzaklrn</h1>
          <p className="mt-1 text-neutral-400">
            {greeting && `${greeting}. `}Guitar over doomscroll — you&apos;re already here.
          </p>
        </div>
        {days > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums text-neutral-50">{days}🔥</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">day streak</div>
          </div>
        )}
      </header>

      {/* the session — one thing at a time */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Today&apos;s session</h2>
          <div className="flex items-center gap-1.5">
            {SESSION.map((s, i) => (
              <span
                key={s.room}
                aria-hidden
                className={`h-1.5 rounded-full transition-all ${
                  done.includes(s.room)
                    ? "w-6 bg-amber-400"
                    : i === stepIdx
                      ? "w-6 bg-amber-400/40"
                      : "w-1.5 bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>

        {step ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Step {stepIdx + 1} of {SESSION.length} · {step.mins}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-neutral-50">{step.title}</h3>
            <p className="mt-2 max-w-prose text-neutral-300">{step.blurb}</p>
            <div className="mt-5 flex items-center gap-4">
              <Link
                href={step.href}
                className="rounded-full bg-amber-400 px-6 py-2.5 font-bold text-neutral-950 hover:bg-amber-300"
              >
                Start {step.title} →
              </Link>
              <button
                onClick={() => setSkipped((s) => [...s, step.room])}
                className="text-sm text-neutral-500 hover:text-neutral-300"
              >
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
                ? "Rhythm, seams, and application — all three. Go play something for the fun of it."
                : "You skipped the rest. Pick a room, or put the session back."}
            </p>
            <div className="mt-5 flex items-center gap-4">
              <Link
                href="/listen"
                className="rounded-full border border-neutral-600 px-6 py-2.5 text-neutral-200 hover:border-neutral-400"
              >
                Play for fun →
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

      {/* quiet extras — reference, not the work */}
      <div className="space-y-4 border-t border-neutral-900 pt-6">
        {learn && (
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">From your rotation</p>
            <h3 className="mt-1.5 text-neutral-100">
              <span className="font-bold">{learn.song}</span>
              <span className="text-neutral-500"> — {learn.artist}</span>
            </h3>
            {learn.fact && <p className="mt-1 max-w-prose text-sm text-neutral-400">{learn.fact}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <a href={ytSearchUrl(`${learn.artist} ${learn.song}`)} target="_blank" rel="noreferrer" className="text-amber-400/80 hover:text-amber-400">
                lesson ↗
              </a>
              <a href={ugSearchUrl(`${learn.artist} ${learn.song}`)} target="_blank" rel="noreferrer" className="text-amber-400/80 hover:text-amber-400">
                tab ↗
              </a>
              <Link href="/listen" className="text-neutral-500 hover:text-neutral-300">rotation →</Link>
              <Link href="/piano" className="text-neutral-500 hover:text-neutral-300">piano reference →</Link>
            </div>
          </section>
        )}

        {tidbit && (
          <section>
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Theory tidbit</p>
              <button
                onClick={() => setTidbitIdx((i) => ((i ?? 0) + 1) % TIDBITS.length)}
                className="text-xs text-neutral-600 hover:text-amber-400"
              >
                another →
              </button>
            </div>
            <h3 className="mt-1.5 font-bold text-neutral-100">{tidbit.title}</h3>
            <p className="mt-1 max-w-prose text-sm text-neutral-400">{tidbit.body}</p>
          </section>
        )}
      </div>
    </div>
  );
}
