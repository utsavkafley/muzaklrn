"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  OutputDevice, canPickOutput, currentOutput, listOutputs, setOutput, unlockOutputNames,
} from "@/lib/audio";

const noSubscribe = () => () => {};

/**
 * Where the app's sound comes out — an amp's USB audio, say, while the rest
 * of the computer stays on its speakers. Chrome and Edge only; anywhere else
 * the sound follows the system output, and this says so.
 */
export default function OutputPicker() {
  const supported = useSyncExternalStore(noSubscribe, canPickOutput, () => false);
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [current, setCurrent] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    const load = () => listOutputs().then((d) => { if (live) setDevices(d); });
    listOutputs().then((d) => {
      if (!live) return;
      setDevices(d);
      setCurrent(currentOutput());
    });
    // Plugging the amp in or out updates the list.
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => {
      live = false;
      navigator.mediaDevices.removeEventListener("devicechange", load);
    };
  }, [supported]);

  if (!supported) {
    return (
      <p className="text-center text-xs text-neutral-400">
        Sound plays through your computer&apos;s output. In Chrome or Edge you can choose a device here — an amp over USB, say.
      </p>
    );
  }

  // Until the page has had microphone access, Chrome hides device ids as
  // well as names: such entries can't be chosen, so they aren't offered.
  const usable = devices.filter((d) => d.id);
  const hidden = usable.length === 0 && devices.length > 0;
  // A remembered device that is unplugged now: show the default instead.
  const value = usable.some((d) => d.id === current) ? current : "";

  const choose = async (id: string) => {
    setCurrent(id);
    setNote(null);
    try {
      await setOutput(id);
    } catch {
      setNote("Couldn't switch to that output — is it still connected?");
    }
  };

  const showNames = async () => {
    try {
      await unlockOutputNames();
      setDevices(await listOutputs());
      setNote(null);
    } catch {
      setNote("Microphone access was declined, so device names stay hidden. Nothing is ever recorded.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5 text-sm text-neutral-600">
      <label className="flex flex-wrap items-center justify-center gap-2">
        <SpeakerIcon />
        <span>Sound plays through</span>
        <select value={value} onChange={(e) => choose(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-neutral-800">
          <option value="">System default</option>
          {usable.map((d, i) => (
            <option key={d.id} value={d.id}>{d.label || `Output ${i + 1}`}</option>
          ))}
        </select>
        {hidden && (
          <button onClick={showNames} className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800">
            find devices
          </button>
        )}
      </label>
      {hidden && !note && (
        <p className="max-w-md text-center text-xs text-neutral-400">
          Chrome only lists devices like an amp after the page has been allowed the microphone. It&apos;s asked once
          and let go at once — nothing is recorded.
        </p>
      )}
      {note && <p className="text-center text-xs text-amber-700">{note}</p>}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}
