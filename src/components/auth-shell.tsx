import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck, FileText, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";

const PUNKTE = [
  { icon: CalendarCheck, text: "Fristen nach LPVG und LPVGWO – automatisch berechnet, mit Erinnerung, was als Nächstes dran ist." },
  { icon: FileText, text: "Wahlausschreiben, Bekanntmachungen, Stimmzettel und Niederschriften – druckfertig." },
  { icon: ShieldCheck, text: "Sensible Daten verschlüsselt, Zugriff nach Rollen, Löschung nach der Wahl." },
];

/** Rahmen für Anmeldung und Zwei-Faktor-Code: Markenfläche links (ab Desktop), Formular rechts. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-yellow p-10 text-brand-ink lg:flex xl:p-14">
        <Brand className="text-lg" />
        <div className="grid max-w-md gap-8">
          <h2 className="font-serif text-4xl leading-tight font-bold tracking-tight xl:text-5xl">Die Wahl der JAV – Schritt für Schritt.</h2>
          <ul className="grid gap-5">
            {PUNKTE.map(({ icon: Icon, text }) => (
              <li key={text} className="grid grid-cols-[auto_1fr] items-start gap-3">
                <span aria-hidden className="flex size-9 items-center justify-center bg-brand-ink text-brand-yellow">
                  <Icon className="size-5" />
                </span>
                <span className="pt-1.5 leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-md text-sm">
          Arbeitshilfe für Wahlvorstände im öffentlichen Dienst Baden-Württemberg. Rechtsgrundlagen: LPVG und LPVGWO in der jeweils
          geltenden Fassung.
        </p>
        {/* Dezentes grafisches Element: große Wortmarke als Wasserzeichen */}
        <span aria-hidden className="pointer-events-none absolute -right-6 -bottom-10 font-black tracking-tighter text-brand-ink/[0.06] select-none" style={{ fontSize: "16rem", lineHeight: 1 }}>
          JAV
        </span>
      </aside>

      <div className="flex flex-col bg-background">
        <header className="bg-brand-yellow lg:hidden">
          <div className="flex h-16 items-center px-4 sm:px-6">
            <Brand />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">{children}</main>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>JAV-Wahl-Tool</span>
          <Link href="/" className="hover:underline">
            Zur Startseite
          </Link>
        </footer>
      </div>
    </div>
  );
}
