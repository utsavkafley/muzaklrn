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

const MENU: { room: Room; href: string; title: string; blurb: string; icon: string }[] = [
  { room: "groove", href: "/groove", title: "Groove", blurb: "2 min of tap trainer at 70 BPM — build the inner clock first.", icon: "◉" },
  { room: "connect", href: "/connect", title: "Connect", blurb: "Boxes 1↔2 in A minor pent. Cross the seam five times, both directions.", icon: "⌁" },
  { room: "practice", href: "/practice", title: "Practice", blurb: "Loop I–V–vi–IV and land a chord tone on every change.", icon: "♩" },
  { room: "piano", href: "/piano", title: "Piano", blurb: "Set a key on the FP30, glance over, keep coloring your loop.", icon: "⌨" },
  { room: "listen", href: "/listen", title: "Listen", blurb: "Pick one song you've been looping and grab its tab.", icon: "∿" },
];

export default function TodayPage() {
  const [done, setDone] = useState<Room[]>([]);
  const [days, setDays] = useState(0);
  const [tidbitIdx, setTidbitIdx] = useState<number | null>(null);
  const [learn, setLearn] = useState<LearnCard | null>(null);

  useEffect(() => {
    setDone(practicedToday());
    setDays(streak());
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
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-caveat)] text-5xl text-amber-400">muzaklrn</h1>
          <p className="mt-1 text-neutral-400">{greeting}. Guitar over doomscroll — you&apos;re already here.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-neutral-50">{days}🔥</div>
          <div className="text-xs uppercase tracking-widest text-neutral-500">day streak</div>
        </div>
      </header>

      {/* daily menu */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-neutral-500">Today&apos;s menu</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MENU.map((item) => {
            const isDone = done.includes(item.room);
            return (
              <Link key={item.room} href={item.href}
                className={`rounded-2xl border p-4 transition-colors ${isDone ? "border-emerald-800/60 bg-emerald-950/20" : "border-neutral-800 bg-neutral-900/50 hover:border-amber-400/50"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl text-amber-400">{item.icon}</span>
                  <span className="font-bold text-neutral-100">{item.title}</span>
                  {isDone && <span className="ml-auto text-sm text-emerald-400">✓ visited</span>}
                </div>
                <p className="mt-1.5 text-sm text-neutral-400">{item.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* learn this */}
      {learn && (
        <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">You&apos;ve been listening…</p>
          <h3 className="mt-1 text-lg font-bold text-neutral-50">
            Want to learn “{learn.song}”? <span className="font-normal text-neutral-400">— {learn.artist}</span>
          </h3>
          {learn.fact && <p className="mt-1.5 text-sm text-neutral-300">{learn.fact}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a href={ytSearchUrl(`${learn.artist} ${learn.song}`)} target="_blank" rel="noreferrer"
              className="rounded-full bg-amber-400 px-4 py-2 font-bold text-neutral-950 hover:bg-amber-300">
              Watch a lesson ↗
            </a>
            <a href={ugSearchUrl(`${learn.artist} ${learn.song}`)} target="_blank" rel="noreferrer"
              className="rounded-full border border-neutral-600 px-4 py-2 text-neutral-200 hover:border-neutral-400">
              Get the tab ↗
            </a>
            <Link href="/listen" className="rounded-full border border-neutral-700 px-4 py-2 text-neutral-400">
              more from your rotation →
            </Link>
          </div>
        </section>
      )}

      {/* tidbit */}
      {tidbit && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Theory tidbit</p>
            <button
              onClick={() => setTidbitIdx((i) => ((i ?? 0) + 1) % TIDBITS.length)}
              className="text-xs text-neutral-500 hover:text-amber-400">
              another →
            </button>
          </div>
          <h3 className="mt-1 font-bold text-neutral-100">{tidbit.title}</h3>
          <p className="mt-1 text-sm text-neutral-300">{tidbit.body}</p>
        </section>
      )}

      <p className="text-center text-xs text-neutral-700">
        vertical slice v0.1 — built for the seams between what you know
      </p>
    </div>
  );
}
