// Spotify via Authorization Code + PKCE — pure client-side, no secret.
// Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID (Vercel env var / .env.local) and add
// `${origin}/listen` as a Redirect URI in the Spotify developer dashboard.
// Without it, the Listen room runs in demo mode.

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const SCOPES = "user-read-recently-played user-top-read";
const TOKEN_KEY = "muzaklrn.spotify.token";
const VERIFIER_KEY = "muzaklrn.spotify.verifier";

export const spotifyConfigured = () => CLIENT_ID.length > 0;

const redirectUri = () => `${window.location.origin}/listen`;

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

function saveToken(t: { access_token: string; refresh_token?: string; expires_in: number }) {
  const stored: StoredToken = {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
}

function loadToken(): StoredToken | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
  } catch {
    return null;
  }
}

export const isConnected = () => loadToken() !== null;

export function disconnect() {
  localStorage.removeItem(TOKEN_KEY);
}

async function sha256base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginAuth() {
  const verifier = [...crypto.getRandomValues(new Uint8Array(48))]
    .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62])
    .join("");
  localStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await sha256base64url(verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/** Call on /listen mount; exchanges ?code= if present. Returns true if newly connected. */
export async function handleCallback(): Promise<boolean> {
  const code = new URLSearchParams(window.location.search).get("code");
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!code || !verifier) return false;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  window.history.replaceState({}, "", "/listen");
  localStorage.removeItem(VERIFIER_KEY);
  if (!res.ok) return false;
  saveToken(await res.json());
  return true;
}

async function accessToken(): Promise<string | null> {
  const t = loadToken();
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) { disconnect(); return null; }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
    }),
  });
  if (!res.ok) { disconnect(); return null; }
  const json = await res.json();
  saveToken({ ...json, refresh_token: json.refresh_token ?? t.refresh_token });
  return json.access_token as string;
}

async function api<T>(path: string): Promise<T | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export interface SpotifyTrack {
  id: string;
  song: string;
  artist: string;
  artistId: string;
  album: string;
  image?: string;
  url: string;
  playedAt?: string;
}

export interface SpotifyArtist {
  name: string;
  genres: string[];
  followers: number;
  popularity: number;
  image?: string;
  url: string;
}

interface RecentlyPlayedResponse {
  items: {
    played_at: string;
    track: {
      id: string; name: string; external_urls: { spotify: string };
      album: { name: string; images: { url: string }[] };
      artists: { id: string; name: string }[];
    };
  }[];
}

export async function recentlyPlayed(): Promise<SpotifyTrack[] | null> {
  const data = await api<RecentlyPlayedResponse>("/me/player/recently-played?limit=50");
  if (!data) return null;
  const seen = new Set<string>();
  const out: SpotifyTrack[] = [];
  for (const item of data.items) {
    const t = item.track;
    if (!t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      song: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      artistId: t.artists[0]?.id ?? "",
      album: t.album.name,
      image: t.album.images.at(-1)?.url,
      url: t.external_urls.spotify,
      playedAt: item.played_at,
    });
  }
  return out.slice(0, 20);
}

interface ArtistResponse {
  name: string; genres: string[]; popularity: number;
  followers: { total: number };
  images: { url: string }[];
  external_urls: { spotify: string };
}

export async function artistInfo(id: string): Promise<SpotifyArtist | null> {
  if (!id) return null;
  const a = await api<ArtistResponse>(`/artists/${id}`);
  if (!a) return null;
  return {
    name: a.name,
    genres: a.genres,
    followers: a.followers.total,
    popularity: a.popularity,
    image: a.images.at(-1)?.url,
    url: a.external_urls.spotify,
  };
}

export function artistBlurb(a: SpotifyArtist): string {
  const genres = a.genres.slice(0, 3).join(", ");
  const fans = a.followers >= 1_000_000
    ? `${(a.followers / 1_000_000).toFixed(1)}M`
    : `${Math.round(a.followers / 1000)}k`;
  const pop = a.popularity >= 75 ? "certified huge" : a.popularity >= 50 ? "solidly beloved" : "a deep cut — good taste";
  return `${a.name}${genres ? ` — filed under ${genres}` : ""}. ${fans} followers, ${pop}.`;
}
