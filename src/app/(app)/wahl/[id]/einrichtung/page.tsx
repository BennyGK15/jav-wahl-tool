import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fromDbDate } from "@/lib/dates";
import { bereitZumAbschluss, ortFelder, type SchrittKey } from "@/lib/einrichtung";
import { mindestStuetzunterschriften, STUETZ_RECHTSGRUNDLAGE } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn, formatIsoDate } from "@/lib/utils";
import { wahlvorstandNamen } from "@/server/ergebnis";
import { loadEinrichtung } from "@/server/einrichtung";
import { DatenschutzForm } from "../../../datenschutz/datenschutz-form";
import { WahlvorstandForm } from "../wahlvorstand/wahlvorstand-form";
import { AbschlussForm, OrteForm, StuetzForm } from "./schritt-forms";

export const metadata = { title: "Wahl einrichten" };

const VERFAHREN = { regulaer: "Reguläres Verfahren", wahlversammlung: "Wahlversammlung (vereinfachtes Verfahren)" } as const;

export default async function EinrichtungPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ schritt?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "election.manage")) notFound();
  const { id } = await params;
  const { schritt } = await searchParams;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();
  if (!election.einrichtungOffen) redirect(`/wahl/${id}`);

  const { stand, datenschutz, schritte } = await loadEinrichtung(election);
  const bereit = bereitZumAbschluss(schritte);
  const ersterOffener = schritte.find((s) => s.key !== "grunddaten" && !s.erledigt)?.key ?? "abschluss";
  const aktiv: SchrittKey = schritte.some((s) => s.key === schritt) ? (schritt as SchrittKey) : ersterOffener;
  const index = schritte.findIndex((s) => s.key === aktiv);
  const naechster = schritte[index + 1];
  const aktuell = schritte[index];
  if (!aktuell) notFound();
  const href = (k: SchrittKey) => `/wahl/${id}/einrichtung?schritt=${k}`;
  const erledigt = schritte.filter((s) => s.erledigt).length;

  const vorstand = stand.angaben.wahlvorstand ?? [];
  const vorschlagVorstand = vorstand.length
    ? vorstand
    : (await wahlvorstandNamen()).map((m, i) => ({ name: m.name, funktion: i === 0 && m.rolle === "Vorsitz" ? ("vorsitz" as const) : ("mitglied" as const) }));
  const stuetzVorschlag = mindestStuetzunterschriften(election.wahlberechtigteSchaetzung);
  const werte = Object.fromEntries(
    ortFelder(election.verfahren).map((f) => [f.key, typeof stand.angaben[f.key] === "string" ? (stand.angaben[f.key] as string) : ""]),
  );

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          {election.dienststelle} · {formatIsoDate(fromDbDate(election.wahltag))}
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Wahl einrichten</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Diese Angaben braucht der Wahlvorstand im Lauf der Wahl immer wieder – im Wahlausschreiben, in den Bekanntmachungen, bei
          den Fristen und am Wahltag. Wer sie jetzt einmal vollständig erfasst, muss später nichts nachtragen. Der Wahlkalender und
          die Phasen werden freigeschaltet, sobald alle Schritte erledigt sind.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Schritte der Einrichtung" className="self-start rounded-sm border bg-card p-4">
          <p className="mb-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {erledigt} von {schritte.length - 1} erledigt
          </p>
          <ol className="grid gap-1">
            {schritte.map((s, i) => (
              <li key={s.key}>
                <Link
                  href={href(s.key)}
                  aria-current={s.key === aktiv ? "step" : undefined}
                  className={cn(
                    "grid grid-cols-[auto_1fr] items-start gap-3 rounded-sm p-2 no-underline hover:bg-secondary",
                    s.key === aktiv && "bg-secondary ring-1 ring-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-bold",
                      s.erledigt ? "bg-foreground text-background" : s.key === aktiv ? "bg-brand-yellow text-brand-ink ring-2 ring-brand-ink" : "border border-muted-foreground/60 text-muted-foreground",
                    )}
                  >
                    {s.erledigt ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold">{s.titel}</span>
                    <span className="block text-xs text-muted-foreground">{s.erledigt ? "erledigt" : s.kurz}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">
                {index + 1}. {aktuell.titel}
              </CardTitle>
              {aktuell.erledigt && <Badge>erledigt</Badge>}
            </div>
            {aktuell.fehlt.length > 0 && <CardDescription>Es fehlt noch: {aktuell.fehlt.join(", ")}.</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-6">
            {aktiv === "grunddaten" && (
              <div className="grid gap-4">
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Dienststelle</dt>
                    <dd className="font-semibold">{election.dienststelle}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Verfahren</dt>
                    <dd className="font-semibold">{VERFAHREN[election.verfahren]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"}</dt>
                    <dd className="font-semibold">{formatIsoDate(fromDbDate(election.wahltag))}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Wahlberechtigte (Schätzung)</dt>
                    <dd className="font-semibold">{election.wahlberechtigteSchaetzung}</dd>
                  </div>
                </dl>
                <p className="text-sm">
                  <Link href={`/wahl/${id}/bearbeiten`} className="font-semibold">
                    Grunddaten ändern
                  </Link>
                </p>
              </div>
            )}

            {aktiv === "wahlvorstand" && (
              <>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Der Personalrat bestimmt den Wahlvorstand, den Vorsitz und die Stellvertretung (§ 62 Abs. 1 LPVG). Mindestens ein
                  Mitglied muss in den Personalrat wählbar sein (§ 54 Abs. 1 Nr. 3 LPVGWO). Die Liste wird für die Bekanntmachung, die
                  Niederschriften und alle Unterschriftsfelder verwendet.
                </p>
                <WahlvorstandForm electionId={id} liste={vorschlagVorstand} bestelltAm={stand.angaben.wahlvorstandBestelltAm ?? null} />
              </>
            )}

            {aktiv === "orte" && (
              <>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Diese Angaben stehen im Wahlausschreiben und in den Bekanntmachungen. Der Dienstschluss wird bei allen Fristenden
                  als Uhrzeit eingetragen. Pflichtfelder sind mit * markiert.
                </p>
                <OrteForm electionId={id} felder={ortFelder(election.verfahren)} werte={werte} />
              </>
            )}

            {aktiv === "unterschriften" && (
              <>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Wahlvorschläge der Beschäftigten brauchen mindestens ein Zwanzigstel der Wahlberechtigten als Unterstützer, in jedem
                  Fall genügen 50 ({STUETZ_RECHTSGRUNDLAGE}). Bei {election.wahlberechtigteSchaetzung} geschätzten Wahlberechtigten
                  ergibt das <strong>{stuetzVorschlag}</strong>. Die Zahl steht im Wahlausschreiben – bitte nach dem Aufstellen des
                  Wählerverzeichnisses noch einmal prüfen.
                </p>
                <StuetzForm electionId={id} wert={election.stuetzunterschriftenMin} vorschlag={stuetzVorschlag} />
              </>
            )}

            {aktiv === "datenschutz" && (
              <>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Diese Angaben gelten für die ganze Anwendung und erscheinen im Verzeichnis der Verarbeitungstätigkeiten, in den
                  TOM, der DSFA und im Datenschutzhinweis für die Beschäftigten.
                  {!hasPermission(session.user.role, "privacy.manage") && " Nur Administration und Vorsitz können sie ändern."}
                </p>
                <DatenschutzForm angaben={datenschutz} />
              </>
            )}

            {aktiv === "abschluss" && (
              <>
                <ul className="grid gap-2 text-sm">
                  {schritte
                    .filter((s) => s.key !== "abschluss")
                    .map((s) => (
                      <li key={s.key} className="flex items-start gap-2">
                        <span aria-hidden className={cn("mt-0.5", s.erledigt ? "text-foreground" : "text-destructive")}>
                          {s.erledigt ? "✓" : "✗"}
                        </span>
                        <span>
                          <strong>{s.titel}</strong>
                          {!s.erledigt && (
                            <>
                              {" "}
                              – fehlt: {s.fehlt.join(", ")} ·{" "}
                              <Link href={href(s.key)} className="font-semibold">
                                ergänzen
                              </Link>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Beim Abschluss wird der Wahlkalender neu berechnet und der Dienstschluss bei den Fristenden eingetragen. Danach
                  führt die Übersicht Schritt für Schritt durch die Wahl. Alle Angaben bleiben später an ihrer Stelle änderbar.
                </p>
                <AbschlussForm electionId={id} bereit={bereit} />
              </>
            )}

            {aktiv !== "abschluss" && naechster && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  {aktuell.erledigt ? "Dieser Schritt ist vollständig." : "Erst speichern, dann weiter – oder später zurückkommen."}
                </span>
                <Button asChild variant={aktuell.erledigt ? "default" : "outline"}>
                  <Link href={href(naechster.key)}>
                    Weiter: {naechster.titel} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
