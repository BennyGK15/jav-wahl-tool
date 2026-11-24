import { notFound } from "next/navigation";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { DruckRahmen, Wert } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { fromDbDate } from "@/lib/dates";
import { addWorkdays } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";

export const metadata = { title: "Bekanntmachung der Nachfrist" };

export default async function NachfristPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "nominations.edit")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, include: { deadlines: { where: { ruleKey: "nachfrist_ende" } } } });
  if (!election) notFound();
  if (!election.nachfristBekanntgemachtAm) {
    return (
      <NochNichtVerfuegbar
        titel="Nachfrist"
        text={
          <>
            Eine Nachfrist gibt es nur, wenn nach Ablauf der Einreichungs- und Berichtigungsfrist kein gültiger Wahlvorschlag
            vorliegt (§ 16 Abs. 1 LPVGWO). Sie beträgt sechs Arbeitstage und wird auf der Seite „Wahlvorschläge“ bekanntgemacht –
            danach steht hier das Dokument zum Aushang.
          </>
        }
        ziel={{ href: `/wahl/${id}/vorschlaege`, label: "Zu den Wahlvorschlägen" }}
      />
    );
  }
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const bekannt = fromDbDate(election.nachfristBekanntgemachtAm);
  const ende = election.deadlines[0];
  await writeAudit({ userId: session.user.id, action: "nominations.nachfrist.printed", objectType: "election", objectId: id });


  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/vorschlaege`, label: "Wahlvorschläge" }}
      titel="Nachfrist"
      kopf={{ dienststelle: election.dienststelle, art: "Bekanntmachung", datum: `Bekanntgemacht am ${formatIsoDate(bekannt)}` }}
      entwurf={false}
      hinweis="Muster nach der Arbeitsunterlage – Wortlaut gegen § 16 LPVGWO prüfen. Die Uhrzeit des Fristendes wird im Wahlkalender gepflegt."
    >
      <article className="grid gap-4 text-sm leading-relaxed">
        <header className="text-center">
          <h1 className="text-xl font-bold">Bekanntmachung</h1>
          <p>zur Einreichung weiterer Wahlvorschläge für die Wahl der Jugend- und Auszubildendenvertretung</p>
          <p className="mt-1">Dienststelle: {election.dienststelle}</p>
        </header>
        <p>
          Bei der Wahl der Jugend- und Auszubildendenvertretung ist bis zum Ablauf der Einreichungsfrist kein gültiger
          Wahlvorschlag eingegangen. Der Wahlvorstand fordert daher gemäß § 16 LPVGWO zur Einreichung von Wahlvorschlägen
          innerhalb einer Nachfrist von sechs Arbeitstagen auf.
        </p>
        <p>
          Die Nachfrist läuft vom <Wert v={formatIsoDate(addWorkdays(bekannt, 1))} l="Beginn" /> bis{" "}
          <Wert v={ende ? `${formatIsoDate(fromDbDate(ende.datum))}${ende.uhrzeit ? `, ${ende.uhrzeit} Uhr` : ""}` : null} l="Ende der Nachfrist" />.
        </p>
        <p>
          Einreichungsstelle: <Wert v={a.einreichungsstelle} l="Einreichungsstelle" />
        </p>
        <p>
          Für die Wahlvorschläge gelten die Anforderungen des Wahlausschreibens (insbesondere §§ 12 und 13 LPVGWO):
          erforderliche Stützunterschriften, schriftliche Zustimmung der vorgeschlagenen Personen.
        </p>
        <p>
          Gehen auch innerhalb der Nachfrist keine gültigen Wahlvorschläge ein, kann die Wahl nicht durchgeführt werden; der
          Wahlvorstand gibt dies bekannt.
        </p>
        <footer className="mt-8 grid gap-10">
          <p>
            {a.ausstellungsort ?? "________________"}, den {formatIsoDate(bekannt)}
          </p>
          <p>Der Wahlvorstand</p>
        </footer>
      </article>
    </DruckRahmen>
  );
}
