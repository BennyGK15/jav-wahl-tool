import { notFound } from "next/navigation";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { DruckRahmen } from "@/components/druck-rahmen";
import { ErgebnisTabellen } from "@/components/ergebnis-tabellen";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { loadErgebnis } from "@/server/ergebnis";

export const metadata = { title: "Bekanntmachung des Wahlergebnisses" };

export default async function ErgebnisBekanntmachungPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const d = await loadErgebnis(id).catch(() => null);
  if (!d) notFound();
  if (!d.result) {
    return (
      <NochNichtVerfuegbar
        titel="Bekanntmachung des Wahlergebnisses"
        text="Die Bekanntmachung des Wahlergebnisses (§ 31 LPVGWO) entsteht aus dem Wahlergebnis und ist danach zwei Wochen auszuhängen. Sie ist verfügbar, sobald nach dem Wahltag auf der Seite „Ergebnis“ die Auszählung erfasst ist."
        ziel={{ href: `/wahl/${id}/ergebnis`, label: "Zum Ergebnis" }}
      />
    );
  }
  const r = d.result;
  const ort = parseAngaben(d.election.wahlausschreibenAngaben).ausstellungsort;
  const beteiligung = d.wahlberechtigte ? ((r.stimmzettelGesamt / d.wahlberechtigte) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "–";
  await writeAudit({ userId: session.user.id, action: "result.notice.generated", objectType: "election", objectId: id });

  return (
    <DruckRahmen zurueck={{ href: `/wahl/${id}/ergebnis`, label: "Ergebnis" }} titel="Bekanntmachung" kopf={{ dienststelle: d.election.dienststelle, art: "Bekanntmachung", datum: `Stand: ${formatIsoDate(todayBerlin())}` }}
      entwurf={!d.festgestellt} hinweis="Inhalt gegen § 31 LPVGWO prüfen.">
      <article className="grid gap-5 text-sm">
        <header className="text-center">
          <h1 className="text-xl font-bold">Bekanntmachung des Wahlergebnisses</h1>
          <p>Wahl der Jugend- und Auszubildendenvertretung</p>
          <p className="mt-1">
            Dienststelle: <strong>{d.election.dienststelle}</strong> · Wahltag: <strong>{formatIsoDate(fromDbDate(d.election.wahltag))}</strong>
          </p>
        </header>

        <table className="w-full max-w-md border-collapse">
          <tbody>
            {[
              ["Wahlberechtigte", d.wahlberechtigte],
              ["Abgegebene Stimmzettel", r.stimmzettelGesamt],
              ["davon gültig", r.stimmzettelGueltig],
              ["davon ungültig", r.stimmzettelUngueltig],
              ["Wahlbeteiligung", `${beteiligung} %`],
            ].map(([k, v]) => (
              <tr key={String(k)} className="border-b">
                <td className="py-1 pr-4">{k}</td>
                <td className="py-1 text-right tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ErgebnisTabellen d={d} />

        <p>Die Gewählten werden schriftlich benachrichtigt.</p>
        <footer className="unterschrift mt-6 grid gap-10">
          <p>
            {ort ?? "________________"}, den {formatIsoDate(todayBerlin())}
          </p>
          <p>Der Wahlvorstand</p>
        </footer>
      </article>
    </DruckRahmen>
  );
}
