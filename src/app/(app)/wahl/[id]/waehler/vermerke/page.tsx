import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";

export const metadata = { title: "Wählerverzeichnis mit Stimmabgabevermerken" };

const zeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const tag = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Wählerverzeichnis mit den Vermerken über die Stimmabgabe (Urne und Briefwahl) – für die Wahlakte.
 * Wie die Auslagefassung ohne Geburtsdaten (Datenminimierung); enthält nur, was die Akte braucht.
 */
export default async function VermerkePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  const voters = await prisma.voter.findMany({
    where: { electionId: id, wahlberechtigt: true },
    orderBy: { lfdNr: "asc" },
    select: {
      id: true,
      lfdNr: true,
      nachname: true,
      vorname: true,
      votedAt: true,
      stimmabgabeArt: true,
      briefwahlBeantragtAm: true,
      briefwahlVersandtAm: true,
      briefwahlEingangAm: true,
    },
  });
  await writeAudit({ userId: session.user.id, action: "voters.vermerke.printed", objectType: "election", objectId: id });

  const urne = voters.filter((v) => v.votedAt && v.stimmabgabeArt !== "brief").length;
  const brief = voters.filter((v) => v.votedAt && v.stimmabgabeArt === "brief").length;
  const briefwahl = voters.some((v) => v.briefwahlBeantragtAm);
  const wahltag = fromDbDate(election.wahltag);
  const vorWahltag = todayBerlin() < wahltag;

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/wahlakte`, label: "Wahlakte" }}
      titel="Wählerverzeichnis mit Stimmabgabevermerken"
      entwurf={false}
      kopf={{ dienststelle: election.dienststelle, art: "Wählerverzeichnis", datum: `Stand: ${formatIsoDate(todayBerlin())}` }}
      hinweis={
        vorWahltag
          ? "Die Stimmabgabe hat noch nicht stattgefunden. Für die Wahlakte erst nach Abschluss der Stimmabgabe drucken."
          : "Für die Wahlakte: nach Abschluss der Stimmabgabe drucken, von der bzw. dem Vorsitzenden unterschreiben lassen und beilegen."
      }
    >
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Wählerverzeichnis mit Stimmabgabevermerken</h1>
        <p>für die Wahl der Jugend- und Auszubildendenvertretung</p>
        <p className="mt-2 text-sm">
          Dienststelle: {election.dienststelle}
          <br />
          {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"}: {formatIsoDate(wahltag)}
        </p>
      </header>

      {voters.length === 0 ? (
        <p className="text-sm">Es sind keine Wahlberechtigten erfasst.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-foreground text-left align-bottom">
              <th className="w-14 py-1 pr-3">Nr.</th>
              <th className="py-1 pr-3">Familienname</th>
              <th className="py-1 pr-3">Vorname</th>
              <th className="py-1 pr-3">Stimmabgabe</th>
              {briefwahl && (
                <>
                  <th className="py-1 pr-3">Briefwahl­unterlagen versandt</th>
                  <th className="py-1">Wahlbrief eingegangen</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {voters.map((v) => (
              <tr key={v.id} className="border-b break-inside-avoid">
                <td className="py-1 pr-3 tabular-nums">{v.lfdNr}</td>
                <td className="py-1 pr-3">{v.nachname}</td>
                <td className="py-1 pr-3">{v.vorname}</td>
                <td className="py-1 pr-3 tabular-nums">
                  {v.votedAt ? `✓ ${v.stimmabgabeArt === "brief" ? "Brief" : "Urne"}, ${zeit.format(v.votedAt)}` : "–"}
                </td>
                {briefwahl && (
                  <>
                    <td className="py-1 pr-3 tabular-nums">{v.briefwahlVersandtAm ? tag.format(v.briefwahlVersandtAm) : v.briefwahlBeantragtAm ? "beantragt" : ""}</td>
                    <td className="py-1 tabular-nums">{v.briefwahlEingangAm ? zeit.format(v.briefwahlEingangAm) : ""}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="unterschrift mt-6 grid gap-1 text-sm">
        <p>Zahl der Wahlberechtigten: {voters.length}</p>
        <p>
          Stimmabgabe vermerkt: {urne + brief} (an der Urne {urne}, per Brief {brief})
        </p>
        <div className="mt-12 grid grid-cols-2 gap-6 text-xs">
          <span className="border-t border-black pt-1">Ort, Datum</span>
          <span className="border-t border-black pt-1">Vorsitz des Wahlvorstands</span>
        </div>
      </footer>
    </DruckRahmen>
  );
}
