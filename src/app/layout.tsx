import type { Metadata, Viewport } from "next";
import { Quicksand, Caveat } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${quicksand.variable} ${caveat.variable}`}>
      <body className="bg-neutral-50 font-[family-name:var(--font-quicksand)] text-neutral-900 antialiased">
        <Nav />
        <main className="mx-auto max-w-4xl px-4 pt-6 pb-24 md:pt-20 md:pb-10">{children}</main>
      </body>
    </html>
  );
}
