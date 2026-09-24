"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginAuth, disconnect,
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
  bpm?: number;
}

export default function ListenPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
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
          setLoading(false);
          return;
        }
      }
      setRows(DEMO_TRACKS);
      setLoading(false);
    })();
  }, []);

  const practiceGroove = (row: Row) => {
    setPendingSong({ song: row.song, artist: row.artist, bpm: row.bpm });
    router.push("/groove");
  };

  return (
    <div className="space-y-5">
      <h1 className="font-[family-name:var(--font-caveat)] text-4xl text-amber-700">Listen</h1>

      {!connected && configured && (
        <button onClick={beginAuth} aria-label="connect"
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-lg font-bold text-neutral-950 hover:bg-emerald-400">
          ♫
        </button>
      )}

      {loading ? (
        <p aria-label="loading" className="animate-pulse text-2xl text-neutral-400">♪</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            return (
              <details key={i}
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
                  <div className="flex flex-wrap gap-2 text-sm">
                    <a href={ugSearchUrl(`${row.artist} ${row.song}`)} target="_blank" rel="noreferrer"
                      className="rounded-full bg-amber-400 px-4 py-2 font-bold text-neutral-950 hover:bg-amber-300">
                      ♪↗
                    </a>
                    <a href={ytSearchUrl(`${row.artist} ${row.song}`)} target="_blank" rel="noreferrer"
                      className="rounded-full border border-neutral-300 px-4 py-2 text-neutral-700 hover:border-neutral-500">
                      ▶↗
                    </a>
                    <button onClick={() => practiceGroove(row)}
                      className="rounded-full border border-neutral-300 px-4 py-2 text-neutral-700 hover:border-neutral-500">
                      ◎→
                    </button>
                    {row.url && (
                      <a href={row.url} target="_blank" rel="noreferrer"
                        className="rounded-full border border-emerald-300 px-4 py-2 text-emerald-700 hover:border-emerald-600">
                        ♫↗
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
        <button onClick={() => { disconnect(); setConnected(false); setRows(DEMO_TRACKS); }}
          className="text-sm text-neutral-400 underline">
          ✕
        </button>
      )}

    </div>
  );
}
