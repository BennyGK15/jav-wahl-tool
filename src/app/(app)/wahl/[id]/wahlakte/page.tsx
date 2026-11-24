import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DruckRahmen } from "@/components/druck-rahmen";
import { Badge } from "@/components/ui/badge";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { berechneWahlakte, nummeriere, type AkteForm } from "@/lib/wahlakte";

export const metadata = { title: "Wahlakte" };

const FORM: Record<AkteForm, string> = {
  ausdruck: "aus der Anwendung drucken",
  original: "Papieroriginal",
  beides: "drucken + Original",
};

function Kaestchen() {
  return <span aria-hidden className="inline-block size-4 border-[1.5px] border-current align-middle" />;
}

/**
 * Inhaltsverzeichnis und Übergabevermerk für die Wahlunterlagen, die der Personalrat in Papierform
 * aufbewahrt (§ 32 LPVGWO). Auf dem Bildschirm mit Links zu den Druckseiten; der Ausdruck dient als
 * Deckblatt der Akte und als Quittung der Übergabe.
 */
export default async function WahlaktePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "voters.edit")) notFound();
  const { id } = await params;

  const election = await prisma.election.findUnique({ where: { id }, include: { result: { select: { festgestelltAm: true } } } });
  if (!election) notFound();

  const [freigabe, einsprueche, einspruecheOffen, wahlvorschlaege, beanstandet, briefwahl, gewaehlte] = await Promise.all([
    prisma.document.findFirst({ where: { electionId: id, typ: "wahlausschreiben", freigegebenAm: { not: null } }, select: { id: true } }),
    prisma.objection.count({ where: { electionId: id, entscheidung: { not: "offen" } } }),
    prisma.objection.count({ where: { electionId: id, entscheidung: "offen" } }),
    prisma.nomination.count({ where: { electionId: id } }),
    prisma.nomination.count({ where: { electionId: id, status: { in: ["ungueltig", "zurueckgegeben"] } } }),
    prisma.voter.count({ where: { electionId: id, wahlberechtigt: true, briefwahlBeantragtAm: { not: null } } }),
    prisma.resultEntry.count({ where: { electionId: id, ergebnis: "gewaehlt" } }),
  ]);

  const festgestellt = Boolean(election.result?.festgestelltAm);
  const abschnitte = berechneWahlakte({
    verfahren: election.verfahren,
    ergebnisFestgestellt: festgestellt,
    wahlausschreibenFreigegeben: Boolean(freigabe),
    nachfristBekanntgemacht: Boolean(election.nachfristBekanntgemachtAm),
    einsprueche,
    einspruecheOffen,
    wahlvorschlaege,
    vorschlaegeBeanstandet: beanstandet,
    briefwahlAntraege: briefwahl,
    gewaehlte,
  });
  const nr = nummeriere(abschnitte);
  const offen = abschnitte.flatMap((a) => a.eintraege).filter((x) => x.offen);

  const a = parseAngaben(election.wahlausschreibenAngaben);
  const wahltag = formatIsoDate(fromDbDate(election.wahltag));
  const loeschtermin = election.retentionUntil ? formatIsoDate(fromDbDate(election.retentionUntil)) : null;
  const base = `/wahl/${id}`;

  return (
    <DruckRahmen
      zurueck={{ href: `${base}/ergebnis`, label: "Ergebnis" }}
      titel="Wahlakte für den Personalrat"
      entwurf={false}
      kopf={{ dienststelle: election.dienststelle, art: "Übergabe der Wahlunterlagen", datum: [a.ausstellungsort, formatIsoDate(todayBerlin())].filter(Boolean).join(", ") }}
      hinweis={
        <div className="grid gap-1">
          <p>
            <strong>Vor dem Löschen drucken:</strong> Alles mit „drucken“ lässt sich nur aus der Anwendung erzeugen, solange die Daten der
            Wahl gespeichert sind.{" "}
            {loeschtermin ? (
              <>
                Festgelegter Löschtermin: <strong>{loeschtermin}</strong>.
              </>
            ) : (
              "Ein Löschtermin ist noch nicht festgelegt."
            )}
          </p>
          {offen.length > 0 && (
            <p>
              Noch nicht vollständig: {offen.map((x) => `${x.titel} (${x.offen})`).join("; ")}
            </p>
          )}
          <p>Diese Seite ausdrucken und als Deckblatt vor die Unterlagen legen; bei der Übergabe abhaken und unterschreiben.</p>
        </div>
      }
    >
      <article className="grid gap-6 text-sm leading-relaxed">
        <header>
          <h1 className="text-xl font-semibold">Wahlakte – Verzeichnis der Wahlunterlagen</h1>
          <p>
            Wahl der Jugend- und Auszubildendenvertretung · {election.dienststelle} ·{" "}
            {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"} am {wahltag}
          </p>
          <p className="mt-2">
            Die Wahlunterlagen werden vom Personalrat in schriftlicher Form mindestens bis zur nächsten Personalratswahl aufbewahrt
            (§ 32 LPVGWO). Sie enthalten personenbezogene Daten und sind verschlossen aufzubewahren.
          </p>
        </header>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left align-bottom">
              <th className="w-10 py-1 pr-3">Nr.</th>
              <th className="py-1 pr-3">Unterlage</th>
              <th className="w-40 py-1 pr-3 print:hidden">Form</th>
              <th className="w-20 py-1 pr-3">Anzahl</th>
              <th className="w-16 py-1 text-center">liegt bei</th>
            </tr>
          </thead>
          {abschnitte.map((abschnitt) => (
            <tbody key={abschnitt.key} className="break-inside-avoid">
              <tr>
                <th colSpan={5} className="pt-4 pb-1 text-left text-xs font-bold tracking-wide uppercase">
                  {abschnitt.titel}
                </th>
              </tr>
              {abschnitt.eintraege.map((x) => {
                const darf = x.pfad && x.rechte?.some((r) => hasPermission(role, r));
                return (
                  <tr key={x.key} className="border-b align-top break-inside-avoid">
                    <td className="py-2 pr-3 tabular-nums">{nr.get(x.key)}</td>
                    <td className="py-2 pr-3">
                      {darf ? (
                        <Link href={`${base}/${x.pfad}`} className="inline-flex items-center gap-1 font-semibold">
                          {x.titel} <ArrowRight aria-hidden className="size-3.5 print:hidden" />
                        </Link>
                      ) : (
                        <span className="font-semibold">{x.titel}</span>
                      )}
                      {x.hinweis && <span className="block text-xs">{x.hinweis}</span>}
                      {x.offen && (
                        <Badge variant="warning" className="mt-1 print:hidden">
                          {x.offen}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs print:hidden">{FORM[x.form]}</td>
                    <td className="py-2 pr-3 tabular-nums">{x.anzahl !== undefined ? x.anzahl : "______"}</td>
                    <td className="py-2 text-center">
                      <Kaestchen />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tbody className="break-inside-avoid">
            <tr>
              <th colSpan={5} className="pt-4 pb-1 text-left text-xs font-bold tracking-wide uppercase">
                Weitere Unterlagen
              </th>
            </tr>
            {[0, 1, 2].map((i) => (
              <tr key={i} className="border-b">
                <td className="py-3 pr-3 tabular-nums">{nr.size + i + 1}</td>
                <td className="py-3 pr-3" />
                <td className="py-3 pr-3 print:hidden" />
                <td className="py-3 pr-3">______</td>
                <td className="py-3 text-center">
                  <Kaestchen />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="grid gap-3 break-inside-avoid">
          <h2 className="font-bold">Übergabevermerk</h2>
          <p>
            Die oben abgehakten Wahlunterlagen wurden vom Wahlvorstand an den Personalrat zur Aufbewahrung übergeben. Die elektronisch
            gespeicherten Daten der Wahl werden nach Feststellung der Gültigkeit der Wahl gelöscht (§ 32 LPVGWO).
          </p>
          <p>Anzahl Ordner / Pakete: ______ · davon versiegelt (Stimmzettel): ______</p>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 print:grid-cols-2">
            <div className="grid gap-8">
              <span className="border-t border-black pt-1 text-xs">Ort, Datum</span>
              <span className="border-t border-black pt-1 text-xs">Für den Wahlvorstand (Vorsitz) – übergeben</span>
            </div>
            <div className="grid gap-8">
              <span className="border-t border-black pt-1 text-xs">Ort, Datum</span>
              <span className="border-t border-black pt-1 text-xs">Für den Personalrat – erhalten</span>
            </div>
          </div>
        </section>
      </article>
    </DruckRahmen>
  );
}
