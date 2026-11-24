import Link from "next/link";
import { anteileText } from "@/lib/geschlechter";
import { loadGeschlechter } from "@/server/geschlechter";
import { BriefkopfSeiten, DokFuss } from "@/components/dokument";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";

export const metadata = { title: "Wählerverzeichnis – Auslage" };

/**
 * Zur Einsicht ausgelegte Fassung: nur laufende Nummer und Name.
 * Kein Geburtsdatum (§ 6 Abs. 4 LPVGWO), keine weiteren Merkmale (Datenminimierung).
 */
export default async function AuslagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  const voters = await prisma.voter.findMany({
    where: { electionId: id, wahlberechtigt: true },
    orderBy: { lfdNr: "asc" },
    select: { id: true, lfdNr: true, nachname: true, vorname: true, funktion: true },
  });

  const geschlechter = await loadGeschlechter(id);
  await writeAudit({ userId: session.user.id, action: "voters.auslage.generated", objectType: "election", objectId: id });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}/waehler`} className="hover:underline">
            Wählerverzeichnis
          </Link>{" "}
          / Auslage-Fassung
        </p>
        <PrintButton />
      </div>

      <DokFuss text={`JAV-Wahl ${election.dienststelle} · Wählerverzeichnis (Auslage)`} />
      <article className="dok mx-auto w-full max-w-3xl print:max-w-none">
        <BriefkopfSeiten kopf={{ dienststelle: election.dienststelle, art: "Wählerverzeichnis", datum: `Stand: ${formatIsoDate(todayBerlin())}` }}>
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Wählerverzeichnis</h1>
          <p>für die Wahl der Jugend- und Auszubildendenvertretung</p>
          <p className="mt-2 text-sm">
            Dienststelle: {election.dienststelle}
            <br />
            {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"}: {formatIsoDate(fromDbDate(election.wahltag))}
            {geschlechter.relevant && geschlechter.zaehlung && (
              <>
                <br />
                Anteile an den Wahlberechtigten (§ 6 Abs. 3 LPVGWO): {anteileText(geschlechter.zaehlung)}
              </>
            )}
          </p>
        </header>

        {voters.length === 0 ? (
          <p className="text-sm">Es sind noch keine Wahlberechtigten erfasst.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="w-16 py-1 pr-4">Nr.</th>
                <th className="py-1 pr-4">Familienname</th>
                <th className="py-1 pr-4">Vorname</th>
                <th className="py-1">Amts- oder Funktionsbezeichnung</th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v.id} className="border-b break-inside-avoid">
                  <td className="py-1 pr-4 tabular-nums">{v.lfdNr}</td>
                  <td className="py-1 pr-4">{v.nachname}</td>
                  <td className="py-1 pr-4">{v.vorname}</td>
                  <td className="py-1">{v.funktion ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="unterschrift mt-6 text-sm">
          <p>Zahl der Wahlberechtigten: {voters.length}</p>
          <p>Stand: {formatIsoDate(todayBerlin())}</p>
          <p className="mt-4">
            Einsprüche gegen die Richtigkeit des Wählerverzeichnisses können während der Auslegungsfrist schriftlich beim
            Wahlvorstand eingelegt werden.
          </p>
          <p className="mt-10">Der Wahlvorstand</p>
        </footer>
        </BriefkopfSeiten>
      </article>
    </div>
  );
}
