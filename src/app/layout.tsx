import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Schriften werden beim Build heruntergeladen und von der eigenen Domain ausgeliefert (CSP: font-src 'self').
const sans = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-source-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], variable: "--font-source-serif", display: "swap", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: { default: "JAV-Wahl-Tool", template: "%s · JAV-Wahl-Tool" },
  description: "Plantool für den Wahlvorstand der JAV-Wahl",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fffc00",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
