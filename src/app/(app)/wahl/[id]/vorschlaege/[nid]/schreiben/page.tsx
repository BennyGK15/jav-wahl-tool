import Link from "next/link";
import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { formatBerlinDateTime, todayBerlin } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { getDeadlineEnd } from "@/server/elections";
import { loadNominations } from "@/server/nominations";

export const metadata = { title: "Schreiben zum Wahlvorschlag" };

const ARTEN = {
  maengel: { titel: "Mitteilung von Mängeln", art: "Mängelmitteilung" },
  zurueckweisung: { titel: "Zurückweisung des Wahlvorschlags", art: "Entscheidung" },
} as const;

/** „2026-12-11 16:00“ → „Fr., 11.12.2026, 16:00 Uhr“ */
const fristText = (ende: string | null) => (ende ? `${formatIsoDate(ende.slice(0, 10))}, ${ende.slice(11)} Uhr` : null);

export default async function VorschlagSchreibenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; nid: string }>;
  searchParams: Promise<{ art?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "nominations.edit")) notFound();
  const { id, nid } = await params;
  const artKey = (await searchParams).art === "zurueckweisung" ? "zurueckweisung" : "maengel";
  const data = await loadNominations(id).catch(() => null);
  const n = data?.nominations.find((x) => x.id === nid);
  if (!data || !n) notFound();
  const { election } = data;
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const berichtigungBis = fristText(await getDeadlineEnd(id, "berichtigung_ende"));
  const maengel = n.checks.filter((c) => c.status === "fehler");
  const hinweise = n.checks.filter((c) => c.status === "hinweis");
  const bezeichnung = n.kennwort ? `„${n.kennwort}“` : "ohne Kennwort";
  const ort = a.ausstellungsort ? `${a.ausstellungsort}, ` : "";
  await writeAudit({ userId: session.user.id, action: `nomination.letter.${artKey}`, objectType: "nomination", objectId: nid });

  const empfaenger = (
    <p>
      An die Vertreterin bzw. den Vertreter
      <br />
      des Wahlvorschlags {bezeichnung}
      <br />
      ______________________________
      <br />
      ______________________________
    </p>
  );

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/vorschlaege/${nid}`, label: "Wahlvorschlag" }}
      titel={ARTEN[artKey].titel}
      entwurf={false}
      kopf={{ dienststelle: election.dienststelle, art: ARTEN[artKey].art, datum: `${ort}${formatIsoDate(todayBerlin())}` }}
      hinweis={
        <>
          {artKey === "maengel"
            ? "Unverzüglich, spätestens am Arbeitstag nach Ablauf der Einreichungsfrist, unter Rückgabe des Wahlvorschlags mitteilen (§ 14 Abs. 2 LPVGWO)."
            : "Die Zurückweisung ist der Vertretung des Wahlvorschlags und betroffenen Bewerbern unverzüglich gegen Unterschrift zu eröffnen oder sonst zuzustellen (§ 15 Abs. 6 LPVGWO)."}{" "}
          Die Mängel stammen aus dem Prüfprotokoll – bitte prüfen und bei Bedarf ergänzen.{" "}
          <Link href={`?art=${artKey === "maengel" ? "zurueckweisung" : "maengel"}`} className="underline">
            {artKey === "maengel" ? "Zur Zurückweisung" : "Zur Mängelmitteilung"}
          </Link>
        </>
      }
    >
      <article className="grid gap-4 text-sm leading-relaxed">
        {empfaenger}
        <h1 className="mt-4 text-lg font-bold">
          {ARTEN[artKey].titel} {bezeichnung}
        </h1>
        <p>
          Wahl der Jugend- und Auszubildendenvertretung bei {election.dienststelle} · Eingang des Wahlvorschlags: {formatBerlinDateTime(n.eingangAm)} Uhr
        </p>

        {artKey === "maengel" ? (
          <>
            <p>der Wahlvorstand hat Ihren Wahlvorschlag geprüft und folgende Mängel festgestellt (§ 14 Abs. 2 LPVGWO):</p>
            {maengel.length ? (
              <ol className="list-decimal space-y-1 pl-6">
                {maengel.map((m) => (
                  <li key={m.text}>{m.text}</li>
                ))}
              </ol>
            ) : (
              <p className="italic">[Keine Mängel im Prüfprotokoll – bitte hier eintragen.]</p>
            )}
            <p>
              Den Wahlvorschlag erhalten Sie hiermit zurück. Bitte beseitigen Sie die Mängel unverzüglich und reichen Sie den
              berichtigten Wahlvorschlag spätestens bis <strong>{berichtigungBis ?? "zum dritten Arbeitstag nach Ablauf der Einreichungsfrist"}</strong> beim
              Wahlvorstand wieder ein{a.einreichungsstelle ? ` (${a.einreichungsstelle})` : ""}.
            </p>
            <p>
              Bitte beachten Sie: Fehlende Unterschriften oder Zustimmungserklärungen sowie Bedingungen können nach Ablauf der
              Einreichungsfrist nicht mehr behoben werden; dies gilt nicht für Unterschriften, die wegen der Streichung von
              Doppelunterschriften fehlen (§ 14 Abs. 2 Satz 2, § 15 Abs. 4 LPVGWO). Wird der Wahlvorschlag nicht rechtzeitig oder
              ohne Behebung der Mängel wieder eingereicht, ist er ungültig (§ 15 Abs. 5 Nr. 5 LPVGWO).
            </p>
          </>
        ) : (
          <>
            <p>
              der Wahlvorstand hat in seiner Sitzung am ______________ beschlossen, Ihren Wahlvorschlag als ungültig zurückzuweisen
              (§ 15 Abs. 5 LPVGWO).
            </p>
            <p className="font-semibold">Gründe:</p>
            {maengel.length || n.pruefnotiz ? (
              <ol className="list-decimal space-y-1 pl-6">
                {maengel.map((m) => (
                  <li key={m.text}>{m.text}</li>
                ))}
                {n.pruefnotiz && <li className="whitespace-pre-line">{n.pruefnotiz}</li>}
              </ol>
            ) : (
              <p className="italic">[Gründe eintragen.]</p>
            )}
          </>
        )}

        {hinweise.length > 0 && artKey === "maengel" && (
          <>
            <p className="font-semibold">Außerdem weisen wir auf Folgendes hin:</p>
            <ul className="list-disc space-y-1 pl-6">
              {hinweise.map((h) => (
                <li key={h.text}>{h.text}</li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-10 grid w-64 gap-1">
          <span className="border-t border-black pt-1">Vorsitz des Wahlvorstands</span>
        </div>

        <div className="mt-8 grid gap-3 border-t border-dashed border-black pt-4">
          <p className="font-semibold">Empfangsbestätigung</p>
          <p>
            {artKey === "maengel" ? "Mängelmitteilung und Wahlvorschlag" : "Entscheidung über die Zurückweisung"} erhalten am ______________ um ______ Uhr.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-8">
            <span className="border-t border-black pt-1">Name (Blockschrift)</span>
            <span className="border-t border-black pt-1">Unterschrift</span>
          </div>
        </div>
      </article>
    </DruckRahmen>
  );
}
