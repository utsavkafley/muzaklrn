import type { Metadata, Viewport } from "next";
import { Quicksand, Caveat } from "next/font/google";
import "../globals.css";

const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "muzaklrn",
  description: "Guitar practice: connect your boxes, fix your groove, learn what you listen to.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
};

/** v2's own root layout: a fresh slate, no v1 nav or page chrome. */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${quicksand.variable} ${caveat.variable}`}>
      <body className="bg-neutral-50 font-[family-name:var(--font-quicksand)] text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
