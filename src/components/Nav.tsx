"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "☀" },
  { href: "/groove", label: "Groove", icon: "◉" },
  { href: "/connect", label: "Connect", icon: "⌁" },
  { href: "/practice", label: "Practice", icon: "♩" },
  { href: "/modes", label: "Modes", icon: "◐" },
];

export default function Nav() {
  const path = usePathname();
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
                active ? "text-amber-700 md:bg-amber-400/10" : "text-neutral-600 hover:text-neutral-800"
              }`}
            >
              <span className="text-lg leading-none md:text-base">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
