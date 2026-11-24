import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, CalendarClock, ClipboardCheck, FileText, Lock, ScrollText, Server, Tablet, Trash2, UserCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { RECHTSSTAND } from "@/lib/fristen";
import { getSession } from "@/lib/session";

export const metadata = { title: "Willkommen" };

const PHASEN = [
  { titel: "Vorbereiten", text: "Wahlvorstand bekanntmachen, Wählerverzeichnis aufstellen, Größe der JAV feststellen." },
  { titel: "Einleiten", text: "Wahlausschreiben erlassen, Wählerverzeichnis auslegen, Einsprüche entscheiden." },
  { titel: "Wahlvorschläge", text: "Vorschläge annehmen, prüfen, Mängel mitteilen, zulassen und bekanntmachen." },
  { titel: "Wählen", text: "Stimmzettel drucken, Briefwahl abwickeln, am Wahltag die Stimmabgabe vermerken." },
  { titel: "Abschließen", text: "Auszählen, Ergebnis feststellen und bekanntmachen, Daten fristgerecht löschen." },
];

const FUNKTIONEN: { icon: LucideIcon; titel: string; text: string }[] = [
  { icon: CalendarClock, titel: "Fristen automatisch", text: "Arbeitstage nach § 55 LPVGWO mit Feiertagen in Baden-Württemberg, Uhrzeit des Fristendes, Erinnerung an den nächsten Schritt." },
  { icon: FileText, titel: "Dokumente druckfertig", text: "Wahlausschreiben, Vordruck für Wahlvorschläge, Bekanntmachungen, Schreiben, Niederschriften – mit allen Pflichtangaben." },
  { icon: ClipboardCheck, titel: "Prüfung der Wahlvorschläge", text: "Prüfprotokoll zu Frist, Wählbarkeit, Zustimmungen, Stützunterschriften und Geschlechteranteilen." },
  { icon: BarChart3, titel: "Auszählung nach BW-Recht", text: "Verhältniswahl mit Panaschieren und Kumulieren, d'Hondt, Mehrheitswahl und Losentscheid." },
  { icon: Tablet, titel: "Wahltag am Tablet", text: "Person suchen, Stimmabgabe bestätigen – doppelte Vermerke sind ausgeschlossen." },
  { icon: ScrollText, titel: "Nachvollziehbar", text: "Jede Änderung wird protokolliert – ohne Inhalte, damit das Protokoll keine Kopie der Daten wird." },
];

const SICHERHEIT: { icon: LucideIcon; text: string }[] = [
  { icon: Lock, text: "Geburtsdaten und Einsprüche verschlüsselt gespeichert" },
  { icon: UserCheck, text: "Zugriff nur nach Rolle: Vorsitz, Mitglied, Wahlhelfer, Administration" },
  { icon: Trash2, text: "Löschung nach der Wahl gemäß § 32 LPVGWO" },
  { icon: Server, text: "Betrieb durch die eigene IT – keine externen Dienste" },
];

export default async function StartPage() {
  const session = await getSession();
  if (session && !session.user.banned) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-brand-yellow">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />
          <Button asChild size="sm">
            <Link href="/login">Anmelden</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Einstieg */}
        <section className="bg-brand-yellow text-brand-ink">
          <div className="mx-auto grid max-w-screen-2xl gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div className="grid max-w-2xl gap-6">
              <p className="text-sm font-bold tracking-[0.14em] uppercase">Für Wahlvorstände im öffentlichen Dienst Baden-Württemberg</p>
              <h1 className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">Die JAV-Wahl strukturiert planen und durchführen.</h1>
              <p className="max-w-xl text-lg leading-relaxed">
                Fristen, Wählerverzeichnis, Wahlvorschläge, Wahltag und Ergebnis an einem Ort – mit allen Dokumenten zum Aushang und
                einem klaren nächsten Schritt.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-6 text-base">
                  <Link href="/login">
                    Anmelden <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-brand-ink bg-transparent px-6 text-base hover:bg-brand-ink hover:text-brand-yellow">
                  <a href="#ablauf">So läuft die Wahl</a>
                </Button>
              </div>
            </div>
            <div aria-hidden className="hidden lg:block">
              {/* Vorschau der Übersicht – flach, mit versetzter Fläche statt Schatten */}
              <div className="relative ml-auto w-full max-w-lg">
                <div className="absolute inset-0 translate-x-3 translate-y-3 bg-brand-ink" />
                <div className="relative grid border-2 border-brand-ink bg-card text-foreground">
                  <div className="flex items-center justify-between border-b px-5 py-2.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Übersicht</span>
                    <span>Wahltag Mi., 20.01.2027</span>
                  </div>
                  <div className="grid gap-3 border-l-[6px] border-l-brand-yellow px-5 py-5">
                    <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Jetzt zu tun · Phase Einleiten</p>
                    <p className="font-serif text-2xl leading-tight font-bold">Wahlausschreiben erlassen und aushängen</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="bg-brand-yellow px-2 py-0.5 font-bold text-brand-ink">in 4 Arbeitstagen</span>
                      <span className="text-muted-foreground">spätestens Fr., 20.11.2026 · § 9 LPVGWO</span>
                    </p>
                    <span className="mt-1 inline-flex w-fit items-center gap-1.5 bg-brand-yellow px-3 py-1.5 text-sm font-semibold text-brand-ink">
                      Jetzt erledigen <ArrowRight className="size-4" />
                    </span>
                  </div>
                  <div className="grid gap-2 border-t bg-secondary/50 px-5 py-4 text-sm">
                    <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Danach</p>
                    {[
                      ["08.12.", "Wahlvorschläge annehmen – Einreichungsfrist endet"],
                      ["30.12.", "Wählerverzeichnis zur Einsicht auslegen"],
                      ["13.01.", "Zugelassene Wahlvorschläge bekanntmachen"],
                    ].map(([d, t]) => (
                      <p key={d} className="grid grid-cols-[3.5rem_1fr] items-baseline gap-2">
                        <span className="text-center text-xs font-bold tabular-nums ring-1 ring-border">{d}</span>
                        <span>{t}</span>
                      </p>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 border-t px-5 py-3">
                    {PHASEN.map((p, i) => (
                      <span key={p.titel} className="grid gap-1">
                        <span className={`h-1.5 ${i < 1 ? "bg-foreground" : i === 1 ? "bg-brand-yellow ring-1 ring-brand-ink" : "bg-muted"}`} />
                        <span className={`text-[10px] leading-tight ${i === 1 ? "font-bold" : "text-muted-foreground"}`}>{p.titel}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ablauf */}
        <section id="ablauf" className="mx-auto max-w-screen-2xl scroll-mt-6 px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl">In fünf Phasen zur gewählten JAV</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Das Tool führt den Wahlvorstand durch den Ablauf nach Landespersonalvertretungsgesetz und Wahlordnung und hakt erledigte
            Schritte selbst ab, wo es das erkennen kann.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-5">
            {PHASEN.map((p, i) => (
              <li key={p.titel} className="relative grid content-start gap-3 border-t-4 border-foreground bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-brand-ink ring-2 ring-brand-ink">{i + 1}</span>
                <h3 className="text-lg font-bold">{p.titel}</h3>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funktionen */}
        <section className="border-y bg-card">
          <div className="mx-auto max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-3xl">Was das Tool übernimmt</h2>
            <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {FUNKTIONEN.map(({ icon: Icon, titel, text }) => (
                <div key={titel} className="grid grid-cols-[auto_1fr] gap-4">
                  <span aria-hidden className="flex size-10 items-center justify-center bg-brand-yellow text-brand-ink">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{titel}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Datenschutz und Sicherheit */}
        <section className="bg-brand-ink text-white">
          <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
            <div>
              <h2 className="text-3xl text-white">Datenschutz von Anfang an</h2>
              <p className="mt-2 max-w-md text-white/75">
                Die Wahl betrifft vor allem junge Beschäftigte und Auszubildende. Deshalb verarbeitet das Tool nur, was die Wahlordnung
                verlangt – und nie, wie jemand gewählt hat.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {SICHERHEIT.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 border-l-4 border-brand-yellow bg-white/5 p-4">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-yellow" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Zugang */}
        <section className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="grid content-start gap-3 border bg-card p-6">
            <h2 className="text-2xl">Sie gehören zum Wahlvorstand?</h2>
            <p className="text-muted-foreground">
              Melden Sie sich mit den Zugangsdaten an, die Sie von der Administration erhalten haben. Wahlhelferinnen und Wahlhelfer
              finden nach der Anmeldung den Einstieg in die Ansicht für den Wahltisch.
            </p>
            <div>
              <Button asChild>
                <Link href="/login">
                  Zur Anmeldung <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid content-start gap-3 border bg-card p-6">
            <h2 className="text-2xl">Sie sind Beschäftigte oder Auszubildende?</h2>
            <p className="text-muted-foreground">
              Termine, Wahlraum, Fristen für Wahlvorschläge und Einsprüche stehen im Wahlausschreiben, das in Ihrer Dienststelle aushängt.
              Fragen zur Wahl beantwortet der Wahlvorstand Ihrer Dienststelle.
            </p>
          </div>
        </section>

        <p className="mx-auto max-w-screen-2xl px-4 pb-10 text-xs text-muted-foreground sm:px-6 lg:px-8">
          Rechtsstand: {RECHTSSTAND.lpvg}; {RECHTSSTAND.lpvgwo}. Arbeitshilfe, keine Rechtsberatung.
        </p>
      </main>

      <SiteFooter oeffentlich />
    </div>
  );
}
