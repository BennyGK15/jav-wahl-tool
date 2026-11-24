import { notFound } from "next/navigation";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { DruckRahmen } from "@/components/druck-rahmen";
import { ErgebnisTabellen } from "@/components/ergebnis-tabellen";
import { writeAudit } from "@/lib/audit";
import { formatBerlinDateTime, fromDbDate, todayBerlin } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { loadErgebnis, wahlvorstandNamen } from "@/server/ergebnis";

export const metadata = { title: "Wahlniederschrift" };

export default async function NiederschriftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const d = await loadErgebnis(id).catch(() => null);
  if (!d) notFound();
  if (!d.result) {
    return (
      <NochNichtVerfuegbar
        titel="Wahlniederschrift"
        text="Die Wahlniederschrift (§ 29 LPVGWO) entsteht aus dem Wahlergebnis. Sie ist verfügbar, sobald nach dem Wahltag auf der Seite „Ergebnis“ die Auszählung erfasst ist."
        ziel={{ href: `/wahl/${id}/ergebnis`, label: "Zum Ergebnis" }}
      />
    );
  }
  const r = d.result;
  const a = parseAngaben(d.election.wahlausschreibenAngaben);
  const vorstand = await wahlvorstandNamen(id);
  const losNamen = d.losReihenfolge.map((x) =>
    d.wahlverfahren === "verhaeltnis"
      ? (d.nominations.find((n) => n.id === x)?.kennwort ?? "Wahlvorschlag")
      : (d.bewerber.get(x)?.name ?? "?"),
  );
  await writeAudit({
    userId: session.user.id,
    action: "result.minutes.generated",
    objectType: "election",
    objectId: id,
  });

  const zeile = (k: string, v: string | number) => (
    <tr className="border-b">
      <td className="py-1 pr-4">{k}</td>
      <td className="py-1 text-right tabular-nums">{v}</td>
    </tr>
  );

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/ergebnis`, label: "Ergebnis" }}
      titel="Niederschrift"
      kopf={{
        dienststelle: d.election.dienststelle,
        art: "Wahlniederschrift",
        datum: `Stand: ${formatIsoDate(todayBerlin())}`,
      }}
      entwurf={!d.festgestellt}
      hinweis="Muster – Pflichtinhalte nach § 29 und § 39 bzw. § 43 LPVGWO prüfen und ergänzen."
    >
      <article className="grid gap-5 text-sm">
        <header className="text-center">
          <h1 className="text-xl font-bold">Wahlniederschrift</h1>
          <p>über die Wahl der Jugend- und Auszubildendenvertretung</p>
          <p className="mt-1">Dienststelle: {d.election.dienststelle}</p>
        </header>

        <section className="grid gap-1">
          <p>
            Wahltag:{" "}
            <strong>{formatIsoDate(fromDbDate(d.election.wahltag))}</strong>
            {a.wahlzeitVon && a.wahlzeitBis && (
              <>
                , Wahlzeit {a.wahlzeitVon}–{a.wahlzeitBis} Uhr
              </>
            )}
            {a.wahlraum && <>, Wahlraum {a.wahlraum}</>}
          </p>
          <p>
            Öffentliche Stimmenauszählung:{" "}
            {a.auszaehlungZeit ? `${a.auszaehlungZeit} Uhr` : "____ Uhr"},{" "}
            {a.auszaehlungOrt ?? "________________"}
          </p>
          <p>
            Verfahren:{" "}
            {d.election.verfahren === "wahlversammlung"
              ? "Wahlversammlung, "
              : ""}
            {d.wahlverfahren === "verhaeltnis"
              ? "Verhältniswahl (Höchstzahlverfahren nach d'Hondt)"
              : "Mehrheitswahl"}{" "}
            · zu wählen: {d.sitze} {d.sitze === 1 ? "Mitglied" : "Mitglieder"}
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold">
            Anwesende Mitglieder des Wahlvorstands
          </h2>
          <ul className="grid gap-1">
            {vorstand.map((m) => (
              <li key={m.name}>
                ☐ {m.name} ({m.rolle})
              </li>
            ))}
            <li>☐ ________________________</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1 font-semibold">Zahlen</h2>
          <table className="w-full max-w-md border-collapse">
            <tbody>
              {zeile(
                "Wahlberechtigte laut Wählerverzeichnis",
                d.wahlberechtigte,
              )}
              {zeile(
                "Stimmabgaben laut Vermerk im Wählerverzeichnis",
                d.vermerkt,
              )}
              {zeile("davon schriftliche Stimmabgabe (Briefwahl)", d.brief)}
              {zeile("Abgegebene Stimmzettel", r.stimmzettelGesamt)}
              {zeile("gültige Stimmzettel", r.stimmzettelGueltig)}
              {zeile("ungültige Stimmzettel", r.stimmzettelUngueltig)}
              {r.stimmenUngueltig != null &&
                zeile(
                  "ungültige Stimmen auf gültigen Stimmzetteln",
                  r.stimmenUngueltig,
                )}
            </tbody>
          </table>
        </section>

        <ErgebnisTabellen d={d} mitHoechstzahlen />

        {losNamen.length > 0 && (
          <section>
            <h2 className="mb-1 font-semibold">Losentscheid</h2>
            <p>
              Bei Stimmengleichheit wurde durch Los entschieden. Gezogene
              Reihenfolge: {losNamen.join(" vor ")}.
            </p>
          </section>
        )}

        <section>
          <h2 className="mb-1 font-semibold">Besondere Vorkommnisse</h2>
          <p className="whitespace-pre-line">{r.vorkommnisse || "Keine."}</p>
        </section>

        <p>
          {d.festgestellt && r.festgestelltAm
            ? `Das Wahlergebnis wurde am ${formatBerlinDateTime(r.festgestelltAm)} Uhr festgestellt.`
            : "Das Wahlergebnis ist noch nicht festgestellt."}
        </p>

        <footer className="unterschrift mt-8 grid grid-cols-3 gap-6 text-xs">
          {["Vorsitz", "Mitglied", "Mitglied"].map((r2, i) => (
            <span key={i} className="border-t pt-1">
              {r2}
            </span>
          ))}
        </footer>
      </article>
    </DruckRahmen>
  );
}
