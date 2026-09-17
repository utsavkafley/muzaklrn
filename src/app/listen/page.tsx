"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SpotifyArtist, artistBlurb, artistInfo, beginAuth, disconnect,
  handleCallback, isConnected, recentlyPlayed, spotifyConfigured,
} from "@/lib/spotify";
import { DEMO_TRACKS, ugSearchUrl, ytSearchUrl } from "@/lib/tidbits";
import {setPendingSong} from "@/lib/store";

interface Row {
  song: string;
  artist: string;
  artistId?: string;
  image?: string;
  url?: string;
  fact?: string;
  bpm?: number;
}

export default function ListenPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [demo, setDemo] = useState(false);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setConfigured(spotifyConfigured());
      await handleCallback();
      const conn = isConnected();
      setConnected(conn);
      if (conn) {
        const tracks = await recentlyPlayed();
        if (tracks?.length) {
          setRows(tracks);
          setDemo(false);
          setLoading(false);
          return;
        }
      }
      setRows(DEMO_TRACKS);
      setDemo(true);
      setLoading(false);
    })();
  }, []);

  const loadFact = async (row: Row) => {
    if (row.fact || !row.artistId || facts[row.artistId]) return;
    const a: SpotifyArtist | null = await artistInfo(row.artistId);
    if (a) setFacts((f) => ({ ...f, [row.artistId!]: artistBlurb(a) }));
  };

  const practiceGroove = (row: Row) => {
    setPendingSong({ song: row.song, artist: row.artist, bpm: row.bpm });
    router.push("/groove");
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Listen</h1>
        <p className="text-sm text-neutral-600">
          The stuff you already play on repeat is the best practice material you own.
        </p>
      </header>

      {!connected && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          {configured ? (
            <>
              <p className="text-neutral-800">Connect Spotify to pull your real listening history.</p>
              <button onClick={beginAuth}
                className="mt-3 rounded-full bg-emerald-500 px-5 py-2.5 font-bold text-neutral-950 hover:bg-emerald-400">
                Connect Spotify
              </button>
            </>
          ) : (
            <>
              <p className="font-bold text-emerald-700">Demo mode</p>
              <p className="mt-1 text-neutral-700">
                To go live: create an app at <span className="text-emerald-700">developer.spotify.com/dashboard</span>,
                add <code className="rounded bg-neutral-200 px-1">{typeof window !== "undefined" ? `${window.location.origin}/listen` : "…/listen"}</code> as
                a Redirect URI, then set <code className="rounded bg-neutral-200 px-1">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> in
                Vercel (or <code className="rounded bg-neutral-200 px-1">.env.local</code>). No secret needed — it uses PKCE.
              </p>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500">tuning in…</p>
      ) : (
        <div className="space-y-2">
          {demo && connected && (
            <p className="text-sm text-neutral-500">Spotify returned nothing recent — showing demo picks.</p>
          )}
          {rows.map((row, i) => {
            const fact = row.fact ?? (row.artistId ? facts[row.artistId] : undefined);
            return (
              <details key={i} onToggle={(e) => (e.target as HTMLDetailsElement).open && loadFact(row)}
                className="group rounded-2xl border border-neutral-200 bg-neutral-100/50 open:border-amber-400/40">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-200 text-lg">♪</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-neutral-900">{row.song}</p>
                    <p className="truncate text-sm text-neutral-600">{row.artist}</p>
                  </div>
                  <span className="text-neutral-400 transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  {fact && <p className="text-sm text-neutral-700">{fact}</p>}
                  <div className="flex flex-wrap gap-2 text-sm">
                    <a href={ugSearchUrl(`${row.artist} ${row.song}`)} target="_blank" rel="noreferrer"
                      className="rounded-full bg-amber-400 px-4 py-2 font-bold text-neutral-950 hover:bg-amber-300">
                      Find tabs ↗
                    </a>
                    <a href={ytSearchUrl(`${row.artist} ${row.song}`)} target="_blank" rel="noreferrer"
                      className="rounded-full border border-neutral-300 px-4 py-2 text-neutral-700 hover:border-neutral-500">
                      Lesson on YouTube ↗
                    </a>
                    <button onClick={() => practiceGroove(row)}
                      className="rounded-full border border-neutral-300 px-4 py-2 text-neutral-700 hover:border-neutral-500">
                      Find its tempo →
                    </button>
                    {row.url && (
                      <a href={row.url} target="_blank" rel="noreferrer"
                        className="rounded-full border border-emerald-300 px-4 py-2 text-emerald-700 hover:border-emerald-600">
                        Open in Spotify ↗
                      </a>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {connected && (
        <button onClick={() => { disconnect(); setConnected(false); setRows(DEMO_TRACKS); setDemo(true); }}
          className="text-sm text-neutral-400 underline">
          disconnect Spotify
        </button>
      )}

      <p className="text-xs text-neutral-400">
        Spotify retired its BPM endpoint for new apps, so tempo-matching works the honest way: “Find its tempo” sends the song to the Groove room where you tap it out. That skill is the point anyway.
      </p>
    </div>
  );
}
