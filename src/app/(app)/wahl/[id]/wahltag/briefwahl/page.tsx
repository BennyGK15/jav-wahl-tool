import Link from "next/link";
import { Briefkopf } from "@/components/dokument";
import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";

export const metadata = { title: "Briefwahlunterlagen" };

/** Anschreiben und „Erklärung zur schriftlichen Stimmabgabe“ je beantragender Person. */
export default async function BriefwahlPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ alle?: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const alle = (await searchParams).alle === "1";
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();
  const personen = await prisma.voter.findMany({
    where: { electionId: id, wahlberechtigt: true, briefwahlBeantragtAm: { not: null }, ...(alle ? {} : { briefwahlVersandtAm: null }) },
    orderBy: { lfdNr: "asc" },
    select: { id: true, lfdNr: true, nachname: true, vorname: true },
  });
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const wahltag = formatIsoDate(fromDbDate(election.wahltag));
  const rueckgabe = `${wahltag}${a.wahlzeitBis ? `, ${a.wahlzeitBis} Uhr` : ""}`;
  await writeAudit({ userId: session.user.id, action: "briefwahl.printed", objectType: "election", objectId: id, fields: [`anzahl:${personen.length}`] });

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/wahltag`, label: "Wahltag" }}
      titel="Briefwahlunterlagen"
      fuss={{ text: `JAV-Wahl ${election.dienststelle} · Briefwahlunterlagen`, seiten: false }}
      entwurf={false}
      hinweis={
        <p>
          Muster – Inhalt nach § 23 LPVGWO prüfen. {alle ? "Alle Anträge" : "Nur Anträge ohne erfassten Versand"} ({personen.length}).{" "}
          <Link href={alle ? "?" : "?alle=1"} className="underline">
            {alle ? "Nur offene anzeigen" : "Alle anzeigen"}
          </Link>
          . Beilegen: Stimmzettel, Wahlumschlag, frankierter Rückumschlag, Wahlausschreiben. Nach dem Versand im Wahltag-Bereich
          „Versand“ abhaken.
        </p>
      }
    >
      {personen.length === 0 ? (
        <p className="text-sm">Keine Anträge auf Briefwahl {alle ? "" : "ohne erfassten Versand "}vorhanden.</p>
      ) : (
        personen.map((p, i) => (
          <div key={p.id} className={`grid gap-8 text-sm leading-relaxed ${i < personen.length - 1 ? "mb-16 break-after-page print:mb-0" : ""}`}>
            <article className="grid gap-3">
              <Briefkopf
                dienststelle={election.dienststelle}
                art="Briefwahlunterlagen"
                datum={`${a.ausstellungsort ?? "________________"}, ${formatIsoDate(todayBerlin())}`}
              />
              <p>
                An
                <br />
                <strong>
                  {p.vorname} {p.nachname}
                </strong>
                <br />
                ______________________________
                <br />
                ______________________________
              </p>
              <h1 className="font-bold">Ihre Unterlagen für die schriftliche Stimmabgabe (Briefwahl)</h1>
              <p>Guten Tag {p.vorname} {p.nachname},</p>
              <p>
                anbei erhalten Sie die Unterlagen für die Wahl der Jugend- und Auszubildendenvertretung ({election.dienststelle}) am{" "}
                {wahltag}. So wählen Sie per Brief:
              </p>
              <ol className="list-decimal pl-6">
                <li>Stimmzettel unbeobachtet ausfüllen und in den Wahlumschlag legen; Wahlumschlag verschließen.</li>
                <li>Die untenstehende Erklärung ausfüllen und unterschreiben.</li>
                <li>Wahlumschlag und Erklärung zusammen in den Rückumschlag stecken und verschließen.</li>
                <li>
                  Rückumschlag so absenden oder abgeben, dass er beim Wahlvorstand spätestens am <strong>{rueckgabe}</strong> vorliegt.
                  Später eingehende Wahlbriefe werden nicht berücksichtigt.
                </li>
              </ol>
              <p className="unterschrift">Der Wahlvorstand</p>
            </article>
            <article className="unterschrift grid gap-3 border-t border-dashed border-black pt-6">
              <h2 className="font-bold">Erklärung zur schriftlichen Stimmabgabe</h2>
              <p>
                Ich, {p.vorname} {p.nachname} (Nr. {p.lfdNr} im Wählerverzeichnis), versichere gegenüber dem Wahlvorstand, dass
                ich den beigefügten Stimmzettel persönlich gekennzeichnet habe.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-6 text-xs">
                <span className="border-t border-black pt-1">Ort, Datum</span>
                <span className="border-t border-black pt-1">Unterschrift</span>
              </div>
            </article>
          </div>
        ))
      )}
    </DruckRahmen>
  );
}
