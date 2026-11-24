import Link from "next/link";
import { notFound } from "next/navigation";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { UrneAnsicht, type UrneZeile } from "./urne-ansicht";

export const metadata = { title: "Wahltag – Stimmabgabe" };

const uhrzeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

/**
 * Reduzierte Wahltag-Ansicht für Wahlhelferinnen und Wahlhelfer am Tablet: Suchen, bestätigen, vermerken.
 * Bewusst ohne Navigation und ohne Liste aller Namen (Bildschirm ist am Wahltisch für Wählende sichtbar).
 */
export default async function UrnePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.markVoted")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  // Nur, was am Wahltisch nötig ist – keine Geburtsdaten oder sonstigen Merkmale
  const voters = await prisma.voter.findMany({
    where: { electionId: id, wahlberechtigt: true },
    orderBy: { lfdNr: "asc" },
    select: { id: true, lfdNr: true, nachname: true, vorname: true, votedAt: true, stimmabgabeArt: true, briefwahlVersandtAm: true },
  });
  const zeilen: UrneZeile[] = voters.map((v) => ({
    id: v.id,
    lfdNr: v.lfdNr,
    nachname: v.nachname,
    vorname: v.vorname,
    gewaehltUm: v.votedAt ? uhrzeit.format(v.votedAt) : null,
    art: v.stimmabgabeArt,
    briefUnterlagen: Boolean(v.briefwahlVersandtAm),
  }));
  const wahltag = fromDbDate(election.wahltag);
  const name = session.user.displayUsername ?? session.user.username ?? session.user.name;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-brand-yellow text-brand-ink">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="leading-tight">
            <p className="text-xs font-bold tracking-[0.12em] uppercase">Wahltag · Stimmabgabe</p>
            <p className="text-sm">
              {election.dienststelle} · {formatIsoDate(wahltag)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{name}</span>
            <Link href="/" className="rounded-sm px-3 py-2 font-semibold no-underline hover:bg-brand-ink hover:text-brand-yellow">
              Beenden
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {todayBerlin() !== wahltag && (
          <p role="note" className="mb-4 border-l-4 border-l-foreground bg-highlight p-3 text-sm">
            Heute ist nicht der Wahltag ({formatIsoDate(wahltag)}). Stimmabgaben bitte nur am Wahltag vermerken.
          </p>
        )}
        <UrneAnsicht zeilen={zeilen} />
      </main>
    </div>
  );
}
