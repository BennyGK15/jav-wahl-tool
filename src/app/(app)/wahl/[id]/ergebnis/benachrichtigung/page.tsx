import { notFound } from "next/navigation";
import { Briefkopf } from "@/components/dokument";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { DruckRahmen } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { gewaehlteUndErsatz, loadErgebnis } from "@/server/ergebnis";

export const metadata = { title: "Benachrichtigung der Gewählten" };

/** Je gewählter Person ein Schreiben mit Rückmeldeabschnitt; jede Seite wird einzeln gedruckt. */
export default async function BenachrichtigungPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const d = await loadErgebnis(id).catch(() => null);
  if (!d) notFound();
  if (!d.result) {
    return (
      <NochNichtVerfuegbar
        titel="Benachrichtigung der Gewählten"
        text="Die Benachrichtigungen der Gewählten (§ 30 LPVGWO) entstehen aus dem Wahlergebnis. Sie sind verfügbar, sobald nach dem Wahltag auf der Seite „Ergebnis“ die Auszählung erfasst ist."
        ziel={{ href: `/wahl/${id}/ergebnis`, label: "Zum Ergebnis" }}
      />
    );
  }
  const { gewaehlt } = gewaehlteUndErsatz(d);
  const ort = parseAngaben(d.election.wahlausschreibenAngaben).ausstellungsort ?? "________________";
  const wahltag = formatIsoDate(fromDbDate(d.election.wahltag));
  await writeAudit({ userId: session.user.id, action: "result.letters.generated", objectType: "election", objectId: id });

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/ergebnis`, label: "Ergebnis" }}
      titel="Benachrichtigungen"
      fuss={{ text: `JAV-Wahl ${d.election.dienststelle} · Benachrichtigung`, seiten: false }}
      entwurf={!d.festgestellt}
      hinweis="Benachrichtigung und Frist für die Erklärung nach § 30 LPVGWO prüfen und ggf. im Text ergänzen."
    >
      {gewaehlt.length === 0 ? (
        <p className="text-sm">Es gibt noch keine Gewählten.</p>
      ) : (
        gewaehlt.map((cid, i) => {
          const b = d.bewerber.get(cid)!;
          return (
            <article key={cid} className={`grid gap-4 text-sm ${i < gewaehlt.length - 1 ? "mb-16 break-after-page print:mb-0" : ""}`}>
              <Briefkopf dienststelle={d.election.dienststelle} art="Benachrichtigung" datum={`${ort}, ${formatIsoDate(todayBerlin())}`} />
              <p>
                An
                <br />
                <strong>
                  {b.vorname} {b.nachname}
                </strong>
                <br />
                {d.election.dienststelle}
              </p>
              <h1 className="font-bold">Ihre Wahl in die Jugend- und Auszubildendenvertretung</h1>
              <p>
                Guten Tag {b.vorname} {b.nachname},
              </p>
              <p>
                der Wahlvorstand teilt Ihnen mit, dass Sie bei der Wahl am {wahltag} zum Mitglied der Jugend- und
                Auszubildendenvertretung gewählt worden sind.
              </p>
              <p>
                Bitte erklären Sie dem Wahlvorstand schriftlich, ob Sie die Wahl annehmen. Geben Sie dazu den unteren
                Abschnitt unterschrieben beim Wahlvorstand ab.
              </p>
              <p>Wir gratulieren Ihnen herzlich.</p>
              <p className="mt-6">Der Wahlvorstand</p>

              <div className="mt-8 border-t border-dashed pt-4">
                <p className="font-semibold">Erklärung</p>
                <p className="mt-2">
                  Ich, {b.vorname} {b.nachname}, wurde am {wahltag} in die Jugend- und Auszubildendenvertretung gewählt.
                </p>
                <p className="mt-2">☐ Ich nehme die Wahl an. &nbsp;&nbsp; ☐ Ich lehne die Wahl ab.</p>
                <div className="mt-10 grid grid-cols-2 gap-6 text-xs">
                  <span className="border-t pt-1">Ort, Datum</span>
                  <span className="border-t pt-1">Unterschrift</span>
                </div>
              </div>
            </article>
          );
        })
      )}
    </DruckRahmen>
  );
}
