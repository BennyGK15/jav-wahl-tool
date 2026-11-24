import Link from "next/link";
import { notFound } from "next/navigation";
import { WahlausschreibenDokument } from "@/components/wahlausschreiben-dokument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBerlinDateTime, fromDbDate } from "@/lib/dates";
import { computeSchedule } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { loadRules } from "@/server/elections";
import { buildWahlausschreiben, type FehlZiel } from "@/server/wahlausschreiben";
import { SprungLink } from "@/components/sprung-link";
import { anteileText, sitzeText } from "@/lib/geschlechter";
import { loadGeschlechter } from "@/server/geschlechter";
import { setGeschlechterLosAction } from "./actions";
import { AngabenForm, ReleaseForm } from "./forms";

export const metadata = { title: "Wahlausschreiben" };

export default async function WahlausschreibenPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "deadlines.read")) notFound();
  const canManage = hasPermission(role, "election.manage");
  const canRelease = hasPermission(role, "documents.release");

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();
  const geschlechter = await loadGeschlechter(id);
  const angaben = parseAngaben(election.wahlausschreibenAngaben);
  if (election.verfahren === "wahlversammlung") {
    return <p className="text-muted-foreground">Bei der Wahlversammlung gibt es kein Wahlausschreiben, sondern eine Einladung.</p>;
  }

  const [{ view, fehlend, sha256 }, documents, rules] = await Promise.all([
    buildWahlausschreiben(id),
    prisma.document.findMany({ where: { electionId: id, typ: "wahlausschreiben" }, orderBy: { version: "desc" } }),
    loadRules("regulaer"),
  ]);
  const spaetestens = computeSchedule(fromDbDate(election.wahltag), rules.filter((r) => r.key === "wahlausschreiben"))[0]?.date ?? null;
  const aktuell = documents[0];
  /** Ziel für einen Sprung; Felder des Formulars nur, wenn es angezeigt wird (Vorsitz). */
  const zielHref = (z: FehlZiel): string | null => {
    if (z.art === "feld") return canManage ? `#${z.feld}` : null;
    if (z.art === "kalender") return `/wahl/${id}${z.frist ? `#frist-${z.frist}` : ""}`;
    if (z.art === "seite") return `/wahl/${id}/${z.href}`;
    return `/wahl/${id}/vorschlaege#${z.anker}`;
  };
  const veraendert = aktuell && aktuell.sha256 !== sha256;
  const freigeber = new Map(
    (await prisma.user.findMany({
      where: { id: { in: documents.map((d) => d.freigegebenVon).filter((x): x is string => Boolean(x)) } },
      select: { id: true, displayUsername: true, username: true },
    })).map((u) => [u.id, u.displayUsername ?? u.username ?? "?"]),
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/wahl/${id}`} className="hover:underline">
              Wahlkalender
            </Link>{" "}
            / Wahlausschreiben
          </p>
          <h1 className="text-3xl">Wahlausschreiben</h1>
          <p className="text-muted-foreground">
            Spätestens zu erlassen am {spaetestens ? formatIsoDate(spaetestens) : "–"} ·{" "}
            {aktuell ? `freigegeben in Version ${aktuell.version}` : "noch nicht freigegeben"}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/wahl/${id}/wahlausschreiben/druck`}>Druckansicht</Link>
        </Button>
      </div>

      <div role="note" className="rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-4 text-sm text-foreground">
        Das Muster beruht auf der Arbeitsunterlage der Vorrecherche. Vor dem Aushang bitte gegen <strong>alle Pflichtangaben
        des § 9 LPVGWO</strong> in der geltenden Fassung prüfen und Fehlendes ergänzen. Fehler im Wahlausschreiben können
        die Wahl anfechtbar machen.
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Angaben</CardTitle>
            <CardDescription>Fristen, Wahltag und Mitgliederzahl kommen automatisch aus Wahlkalender und Wählerverzeichnis.</CardDescription>
          </CardHeader>
          <CardContent>
            <AngabenForm
              electionId={id}
              angaben={parseAngaben(election.wahlausschreibenAngaben)}
              erlassAm={election.wahlausschreibenAm ? fromDbDate(election.wahlausschreibenAm) : null}
              erlassSpaetestens={spaetestens}
            />
          </CardContent>
        </Card>
      )}

      {geschlechter.relevant && (
        <Card id="geschlechter" tabIndex={-1}>
          <CardHeader>
            <CardTitle className="text-base">Frauen und Männer (§ 11 LPVG, § 8 LPVGWO)</CardTitle>
            <CardDescription>
              Ab drei Mitgliedern stellt der Wahlvorstand die Anteile fest und verteilt die Sitze nach d&apos;Hondt auf Frauen und
              Männer. Grundlage sind die Wahlberechtigten im Wählerverzeichnis (Stichtag: 10. Arbeitstag vor Erlass, § 5 LPVGWO).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {!geschlechter.zaehlung ? (
              <p>
                Noch keine Wahlberechtigten erfasst.{" "}
                <Link href={`/wahl/${id}/waehler`} className="font-semibold">
                  Zum Wählerverzeichnis
                </Link>
              </p>
            ) : (
              <>
                <p>
                  Wahlberechtigte: <strong>{anteileText(geschlechter.zaehlung)}</strong>
                  {geschlechter.zaehlung.divers > 0 && ` · ${geschlechter.zaehlung.divers} divers`}
                  {geschlechter.zaehlung.ohneAngabe > 0 && (
                    <span className="text-destructive"> · bei {geschlechter.zaehlung.ohneAngabe} fehlt die Angabe</span>
                  )}
                </p>
                {geschlechter.zaehlung.divers > 0 && (
                  <p className="text-muted-foreground">
                    Das Gesetz kennt nur Frauen und Männer; Personen mit dem Eintrag „divers“ sind bei der Verteilung nicht
                    berücksichtigt. Im Zweifel mit dem Rechtsamt abstimmen.
                  </p>
                )}
                {geschlechter.verteilung && !geschlechter.verteilung.losOffen && (
                  <p>
                    Sitze: <strong>{sitzeText(geschlechter.verteilung)}</strong> von {geschlechter.sitze}
                    {angaben.geschlechterLos && ` (nach Losentscheid zugunsten der ${angaben.geschlechterLos === "w" ? "Frauen" : "Männer"})`}
                  </p>
                )}
                {geschlechter.verteilung?.losOffen && (
                  <div className="grid gap-2 rounded-sm border border-destructive p-3">
                    <p className="font-semibold text-destructive">
                      Gleiche Höchstzahlen um den letzten Sitz – der Wahlvorstand entscheidet durch Los (§ 7 Abs. 2 Satz 5 LPVGWO).
                    </p>
                    {canManage ? (
                      <form action={setGeschlechterLosAction} className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="electionId" value={id} />
                        <span>Das Los fiel auf:</span>
                        <Button type="submit" size="sm" variant="outline" name="gewinner" value="w">
                          Frauen
                        </Button>
                        <Button type="submit" size="sm" variant="outline" name="gewinner" value="m">
                          Männer
                        </Button>
                      </form>
                    ) : (
                      <p>Der Vorsitz hält das Ergebnis des Losentscheids hier fest.</p>
                    )}
                  </div>
                )}
                {angaben.geschlechterLos && canManage && (
                  <form action={setGeschlechterLosAction}>
                    <input type="hidden" name="electionId" value={id} />
                    <Button type="submit" size="sm" variant="ghost" name="gewinner" value="">
                      Losentscheid zurücksetzen
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Freigabe</CardTitle>
          <CardDescription>
            Eine Freigabe hält Version, Zeitpunkt, Person und eine Prüfsumme des Inhalts fest. Ändert sich danach etwas,
            ist eine neue Freigabe nötig.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {fehlend.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium">Für die Freigabe fehlt noch:</p>
              <ul className="mt-1 list-disc pl-5 text-destructive">
                {fehlend.map((f) => {
                  const href = zielHref(f.ziel);
                  return <li key={f.label}>{href ? <SprungLink href={href}>{f.label}</SprungLink> : f.label}</li>;
                })}
              </ul>
            </div>
          ) : veraendert ? (
            <p className="text-sm text-destructive">Der Inhalt hat sich seit Version {aktuell.version} geändert. Bitte neu freigeben und neu aushängen.</p>
          ) : aktuell ? (
            <p className="text-sm text-muted-foreground">Der aktuelle Stand entspricht Version {aktuell.version}.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Alle Angaben vollständig.</p>
          )}
          {canRelease && <ReleaseForm electionId={id} disabled={fehlend.length > 0 || (Boolean(aktuell) && !veraendert)} />}
          {documents.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant={d.id === aktuell?.id ? "secondary" : "outline"}>Version {d.version}</Badge>
                  <span>
                    {d.freigegebenAm ? formatBerlinDateTime(d.freigegebenAm) : "–"} · {d.freigegebenVon ? freigeber.get(d.freigegebenVon) : "–"}
                  </span>
                  <code className="text-xs text-muted-foreground" title={d.sha256}>
                    {d.sha256.slice(0, 12)}…
                  </code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau</CardTitle>
        </CardHeader>
        <CardContent>
          <WahlausschreibenDokument v={view} />
        </CardContent>
      </Card>
    </div>
  );
}
