import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand" });

export const metadata: Metadata = {
  title: "muzaklrn",
  description: "Guitar practice: a key, its modes, the chords they build, and how each one feels.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body className="bg-neutral-50 font-[family-name:var(--font-quicksand)] text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
