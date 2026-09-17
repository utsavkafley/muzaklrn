"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { isGrooveRunning, stopGroove, subscribeGroove } from "@/lib/transport";

const TABS = [
  { href: "/", label: "Today", icon: "☀" },
  { href: "/groove", label: "Groove", icon: "◉" },
  { href: "/connect", label: "Connect", icon: "⌁" },
  { href: "/practice", label: "Practice", icon: "♩" },
  { href: "/modes", label: "Modes", icon: "◐" },
];

export default function Nav() {
  const path = usePathname();
  const running = useSyncExternalStore(subscribeGroove, isGrooveRunning, () => false);

  /**
   * Space stops the groove from anywhere — it carries on across rooms now, so
   * it needs a kill switch that isn't tied to the page that started it.
   *
   * Only while it is actually running: idle, the key is left alone, so a
   * focused button still activates on Space the way a button should.
   */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Match key as well as code: code is the physical key, which is not the
      // spacebar on every layout.
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!isGrooveRunning()) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      // Never steal the spacebar from somewhere text is being typed.
      if (el?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      stopGroove();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-neutral-50/90 backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="mx-auto flex max-w-4xl items-center md:gap-2 md:px-4">
        <Link href="/" className="hidden py-3 pr-4 font-[family-name:var(--font-caveat)] text-2xl text-amber-700 md:block">
          muzaklrn
        </Link>
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] md:flex-none md:flex-row md:gap-1.5 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
                active ? "text-amber-700 md:bg-amber-400/15" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              <span className="text-lg leading-none md:text-base">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
        {/* Only here while the clock is running, so you can always see that it
            is — and stop it — from whichever room you wandered into. */}
        {running && (
          <button
            onClick={stopGroove}
            aria-label="stop"
            className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-neutral-800 md:ml-auto"
          >
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span aria-hidden className="text-base leading-none">■</span>
          </button>
        )}
      </div>
    </nav>
  );
}
