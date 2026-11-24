import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeAudit } from "@/lib/audit";
import { formatBerlinDateTime, fromDbDate, todayBerlin } from "@/lib/dates";
import { anteileText, sitzeText } from "@/lib/geschlechter";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { wahlvorstandNamen } from "@/server/ergebnis";
import { loadGeschlechter } from "@/server/geschlechter";
import { STATUS_LABEL } from "@/server/nominations";
import { voterCounts } from "@/server/voters";

export const metadata = { title: "Sitzungsniederschrift" };

const GEGENSTAENDE = {
  verzeichnis: "Wählerverzeichnis, Zahl der zu wählenden Mitglieder, anteilige Vertretung der Geschlechter (§§ 6, 8 LPVGWO, § 61 LPVG)",
  einsprueche: "Einsprüche gegen das Wählerverzeichnis (§ 6 Abs. 5 und 6 LPVGWO)",
  vorschlaege: "Zulassung und Reihenfolge der Wahlvorschläge (§§ 15, 17 LPVGWO)",
  nachfrist: "Nachfrist für die Einreichung von Wahlvorschlägen (§ 16 LPVGWO)",
} as const;
type Gegenstand = keyof typeof GEGENSTAENDE;

const ENTSCHEIDUNG = { offen: "noch offen", stattgegeben: "stattgegeben", zurueckgewiesen: "zurückgewiesen" } as const;

function Beschluss() {
  return (
    <p className="mt-2">
      Beschluss: ☐ einstimmig &nbsp; ☐ mit ____ Ja- / ____ Nein-Stimmen &nbsp; (Beschlussfassung mit einfacher Stimmenmehrheit, § 1 Abs. 4 LPVGWO)
    </p>
  );
}

export default async function SitzungPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ datum?: string; beginn?: string; ende?: string; ort?: string; g?: string | string[] }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const election = await prisma.election.findUnique({ where: { id }, include: { deadlines: true } });
  if (!election) notFound();

  const [counts, geschlechter, objections, nominations, vorstand] = await Promise.all([
    voterCounts(id),
    loadGeschlechter(id),
    prisma.objection.findMany({ where: { electionId: id, entscheidung: { not: "offen" } }, orderBy: { eingangAm: "asc" }, include: { voter: { select: { lfdNr: true } } } }),
    prisma.nomination.findMany({ where: { electionId: id }, orderBy: [{ ordnungsnummer: "asc" }, { eingangAm: "asc" }] }),
    wahlvorstandNamen(id),
  ]);
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const stichtag = election.deadlines.find((d) => d.ruleKey === "stichtag_feststellung");
  const nachfristEnde = election.deadlines.find((d) => d.ruleKey === "nachfrist_ende");

  const gewaehlt = (Array.isArray(sp.g) ? sp.g : sp.g ? [sp.g] : []).filter((x): x is Gegenstand => x in GEGENSTAENDE);
  // Ohne Auswahl: alles vorschlagen, wozu es Daten gibt
  const auswahl: Gegenstand[] = gewaehlt.length
    ? gewaehlt
    : (["verzeichnis", objections.length ? "einsprueche" : null, nominations.length ? "vorschlaege" : null, election.nachfristBekanntgemachtAm ? "nachfrist" : null].filter(
        Boolean,
      ) as Gegenstand[]);
  const datum = sp.datum && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : todayBerlin();
  const zeit = (v?: string) => (v && /^\d{2}:\d{2}$/.test(v) ? v : null);
  await writeAudit({ userId: session.user.id, action: "election.minutes.generated", objectType: "election", objectId: id, fields: auswahl });

  let nr = 0;
  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}`, label: "Wahlkalender" }}
      titel="Sitzungsniederschrift"
      entwurf={false}
      kopf={{ dienststelle: election.dienststelle, art: "Niederschrift", datum: formatIsoDate(datum) }}
      hinweis={
        <form method="get" className="grid gap-3">
          <p>
            Niederschrift über eine Sitzung des Wahlvorstands (§ 19 LPVGWO). Gegenstände auswählen, Daten ergänzen, drucken und von allen
            Mitgliedern unterschreiben lassen. Die Inhalte kommen aus dem aktuellen Stand der Wahl.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 font-medium">
              Datum
              <Input type="date" name="datum" defaultValue={datum} className="w-40" />
            </label>
            <label className="grid gap-1 font-medium">
              Beginn
              <Input type="time" name="beginn" defaultValue={zeit(sp.beginn) ?? ""} className="w-28" />
            </label>
            <label className="grid gap-1 font-medium">
              Ende
              <Input type="time" name="ende" defaultValue={zeit(sp.ende) ?? ""} className="w-28" />
            </label>
            <label className="grid gap-1 font-medium">
              Ort
              <Input name="ort" defaultValue={sp.ort ?? ""} maxLength={120} className="w-56" />
            </label>
          </div>
          <fieldset className="grid gap-1">
            <legend className="font-medium">Gegenstände</legend>
            {(Object.keys(GEGENSTAENDE) as Gegenstand[]).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" name="g" value={k} defaultChecked={auswahl.includes(k)} /> {GEGENSTAENDE[k]}
              </label>
            ))}
          </fieldset>
          <div>
            <Button type="submit" size="sm" variant="outline">
              Übernehmen
            </Button>
          </div>
        </form>
      }
    >
      <article className="grid gap-5 text-sm leading-relaxed">
        <header className="text-center">
          <h1 className="text-xl font-bold">Niederschrift über die Sitzung des Wahlvorstands</h1>
          <p>für die Wahl der Jugend- und Auszubildendenvertretung</p>
        </header>
        <p>
          Sitzung am <strong>{formatIsoDate(datum)}</strong>
          {zeit(sp.beginn) ? `, Beginn ${zeit(sp.beginn)} Uhr` : ", Beginn ____ Uhr"}
          {zeit(sp.ende) ? `, Ende ${zeit(sp.ende)} Uhr` : ", Ende ____ Uhr"}, Ort: {sp.ort?.trim() || "______________________"}
        </p>

        <section>
          <h2 className="font-semibold">Anwesend</h2>
          <ul className="mt-1 grid gap-1">
            {vorstand.map((m) => (
              <li key={m.name}>
                ☐ {m.name} ({m.rolle})
              </li>
            ))}
            <li>☐ als Ersatzmitglied: ______________________ für ______________________</li>
          </ul>
          <p className="mt-2">Der Wahlvorstand ist beschlussfähig, wenn alle Mitglieder oder deren Ersatzmitglieder anwesend sind (§ 1 Abs. 4 LPVGWO).</p>
        </section>

        {auswahl.includes("verzeichnis") && (
          <section>
            <h2 className="font-semibold">
              {++nr}. {GEGENSTAENDE.verzeichnis}
            </h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Das Wählerverzeichnis ist angelegt; es enthält <strong>{counts.wahlberechtigt}</strong> wahlberechtigte Beschäftigte im Sinne von § 59
                LPVG{stichtag ? ` (Stichtag ${formatIsoDate(fromDbDate(stichtag.datum))}, § 5 LPVGWO)` : ""}.
              </li>
              <li>
                Zu wählen {geschlechter.sitze === 1 ? "ist" : "sind"} <strong>{geschlechter.sitze}</strong>{" "}
                {geschlechter.sitze === 1 ? "Mitglied" : "Mitglieder"} der Jugend- und Auszubildendenvertretung (§ 61 LPVG).
              </li>
              {geschlechter.relevant && geschlechter.zaehlung && (
                <li>
                  Anteile an den Wahlberechtigten: {anteileText(geschlechter.zaehlung)}.{" "}
                  {geschlechter.verteilung && !geschlechter.verteilung.losOffen
                    ? `Nach d'Hondt entfallen auf ${sitzeText(geschlechter.verteilung)} (§ 8 LPVGWO)${a.geschlechterLos ? `; über den letzten Sitz entschied das Los zugunsten der ${a.geschlechterLos === "w" ? "Frauen" : "Männer"}` : ""}.`
                    : "Über den letzten Sitz ist durch Los zu entscheiden; Ergebnis: ______________________."}
                </li>
              )}
            </ul>
            <Beschluss />
          </section>
        )}

        {auswahl.includes("einsprueche") && (
          <section>
            <h2 className="font-semibold">
              {++nr}. {GEGENSTAENDE.einsprueche}
            </h2>
            {objections.length === 0 ? (
              <p>Es liegen keine entschiedenen Einsprüche vor.</p>
            ) : (
              <table className="mt-1 w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-3">Eingang</th>
                    <th className="py-1 pr-3">betrifft lfd. Nr.</th>
                    <th className="py-1">Entscheidung</th>
                  </tr>
                </thead>
                <tbody>
                  {objections.map((o) => (
                    <tr key={o.id} className="border-b">
                      <td className="py-1 pr-3">{formatBerlinDateTime(o.eingangAm)}</td>
                      <td className="py-1 pr-3">{o.voter?.lfdNr ?? "–"}</td>
                      <td className="py-1">{ENTSCHEIDUNG[o.entscheidung]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-1">Die Begründungen ergeben sich aus den Einspruchsakten. Das Wählerverzeichnis wird bei begründeten Einsprüchen berichtigt.</p>
            <Beschluss />
          </section>
        )}

        {auswahl.includes("vorschlaege") && (
          <section>
            <h2 className="font-semibold">
              {++nr}. {GEGENSTAENDE.vorschlaege}
            </h2>
            {nominations.length === 0 ? (
              <p>Es sind keine Wahlvorschläge eingegangen.</p>
            ) : (
              <table className="mt-1 w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-3">Ordnungsnr.</th>
                    <th className="py-1 pr-3">Kennwort</th>
                    <th className="py-1 pr-3">Eingang</th>
                    <th className="py-1">Entscheidung</th>
                  </tr>
                </thead>
                <tbody>
                  {nominations.map((n) => (
                    <tr key={n.id} className="border-b">
                      <td className="py-1 pr-3">{n.ordnungsnummer ?? "–"}</td>
                      <td className="py-1 pr-3">{n.kennwort ?? "ohne Kennwort"}</td>
                      <td className="py-1 pr-3">{formatBerlinDateTime(n.eingangAm)}</td>
                      <td className="py-1">{STATUS_LABEL[n.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-1">
              Die gültigen Wahlvorschläge erhalten Ordnungsnummern in der Reihenfolge ihres Eingangs; bei berichtigten Vorschlägen zählt der
              Eingang der Berichtigung, bei gleichzeitigem Eingang entscheidet das Los (§ 17 LPVGWO). Gründe für Zurückweisungen ergeben sich aus
              den Prüfprotokollen.
            </p>
            <Beschluss />
          </section>
        )}

        {auswahl.includes("nachfrist") && (
          <section>
            <h2 className="font-semibold">
              {++nr}. {GEGENSTAENDE.nachfrist}
            </h2>
            <p>
              {election.nachfristBekanntgemachtAm
                ? `Da kein gültiger Wahlvorschlag vorliegt, wird am ${formatIsoDate(fromDbDate(election.nachfristBekanntgemachtAm))} eine Nachfrist von sechs Arbeitstagen bekanntgemacht${nachfristEnde ? `; sie endet am ${formatIsoDate(fromDbDate(nachfristEnde.datum))}${nachfristEnde.uhrzeit ? `, ${nachfristEnde.uhrzeit} Uhr` : ""}` : ""}.`
                : "Da kein gültiger Wahlvorschlag vorliegt, wird eine Nachfrist von sechs Arbeitstagen bekanntgemacht."}
            </p>
            <Beschluss />
          </section>
        )}

        <section>
          <h2 className="font-semibold">Weitere Beschlüsse / Bemerkungen</h2>
          <div className="mt-2 grid gap-5">
            <span className="block border-b border-black" />
            <span className="block border-b border-black" />
          </div>
        </section>

        <section className="unterschrift mt-6">
          <p className="mb-8">Unterschriften der Mitglieder des Wahlvorstands (§ 19 Satz 2 LPVGWO):</p>
          <div className="grid grid-cols-2 gap-x-10 gap-y-10">
            {vorstand.map((m) => (
              <span key={m.name} className="border-t border-black pt-1">
                {m.name} ({m.rolle})
              </span>
            ))}
          </div>
        </section>
      </article>
    </DruckRahmen>
  );
}
