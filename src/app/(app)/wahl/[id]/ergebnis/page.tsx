import Link from "next/link";
import { notFound } from "next/navigation";
import { ErgebnisTabellen } from "@/components/ergebnis-tabellen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBerlinDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { loadErgebnis, VERSAMMLUNG_KENNWORT } from "@/server/ergebnis";
import {
  addVersammlungsBewerberAction,
  removeVersammlungsBewerberAction,
} from "./actions";
import {
  AuszaehlungForm,
  FeststellenForm,
  LosForm,
  type StimmenFeld,
} from "./forms";

export const metadata = { title: "Ergebnis" };

export default async function ErgebnisPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "voters.edit")) notFound();
  const canFinalize = hasPermission(role, "result.finalize");

  const { id } = await params;
  const d = await loadErgebnis(id).catch(() => null);
  if (!d) notFound();
  const { election, result, festgestellt } = d;

  const listenLabel = (nid: string) => {
    const i = d.nominations.findIndex((n) => n.id === nid);
    const n = d.nominations[i]!;
    return `Wahlvorschlag ${n.ordnungsnummer ?? i + 1}${n.kennwort ? ` „${n.kennwort}“` : ""}`;
  };

  // Immer Stimmen je Person (§ 33 LPVGWO); bei Verhältniswahl nach Wahlvorschlag gruppiert
  const felder: StimmenFeld[] = [...d.bewerber.values()].map((b) => ({
    name: `bewerber_${b.candidateId}`,
    label: `${b.listenplatz}. ${b.nachname}, ${b.vorname}`,
    gruppe:
      d.wahlverfahren === "verhaeltnis"
        ? listenLabel(b.nominationId)
        : undefined,
    defaultValue: result
      ? (d.stimmenJeBewerber.get(b.candidateId) ?? null)
      : null,
  }));

  const versammlungsBewerber =
    election.verfahren === "wahlversammlung"
      ? await prisma.voter.findMany({
          where: { electionId: id, waehlbar: true },
          orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
          select: { id: true, lfdNr: true, nachname: true, vorname: true },
        })
      : [];
  const schonBewerber = new Set(
    election.verfahren === "wahlversammlung"
      ? (
          await prisma.nominationCandidate.findMany({
            where: {
              nomination: { electionId: id, kennwort: VERSAMMLUNG_KENNWORT },
            },
            select: { voterId: true },
          })
        ).map((c) => c.voterId)
      : [],
  );

  const losBeteiligte = d.los
    ? d.los.ids.map((x) => ({
        id: x,
        label:
          d.wahlverfahren === "verhaeltnis"
            ? listenLabel(x)
            : (d.bewerber.get(x)?.name ?? x),
      }))
    : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/wahl/${id}`} className="hover:underline">
              Wahlkalender
            </Link>{" "}
            / Ergebnis
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">Auszählung und Ergebnis</h1>
            {festgestellt ? (
              <Badge variant="secondary">
                festgestellt{" "}
                {result?.festgestelltAm &&
                  formatBerlinDateTime(result.festgestelltAm)}
              </Badge>
            ) : (
              <Badge variant="warning">Entwurf</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {d.wahlverfahren === "verhaeltnis"
              ? "Verhältniswahl (mehrere gültige Wahlvorschläge)"
              : d.wahlverfahren === "mehrheit"
                ? d.sitze === 1 && d.nominations.length > 1
                  ? "Mehrheitswahl (eine zu wählende Person)"
                  : "Mehrheitswahl"
                : "kein Wahlverfahren"}{" "}
            · {d.sitze} {d.sitze === 1 ? "Sitz" : "Sitze"} · {d.wahlberechtigte}{" "}
            Wahlberechtigte · {d.vermerkt} Stimmabgaben vermerkt (davon{" "}
            {d.brief} Brief)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.wahlverfahren && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/wahl/${id}/stimmzettel`}>Stimmzettel</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/wahl/${id}/ergebnis/bekanntmachung`}>
              Bekanntmachung
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/wahl/${id}/ergebnis/niederschrift`}>
              Niederschrift
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/wahl/${id}/ergebnis/benachrichtigung`}>
              Benachrichtigungen
            </Link>
          </Button>
        </div>
      </div>

      {!d.wahlverfahren && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-4 text-sm text-destructive"
        >
          Es gibt keinen gültigen Wahlvorschlag. Ohne gültigen Vorschlag kann
          keine Wahl stattfinden – bitte Nachfrist nach § 16 LPVGWO prüfen.
        </p>
      )}

      {election.verfahren === "wahlversammlung" && !festgestellt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Bewerberinnen und Bewerber aus der Wahlversammlung
            </CardTitle>
            <CardDescription>
              In der Versammlung vorgeschlagene, wählbare Personen erfassen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[...d.bewerber.values()].length > 0 && (
              <ul className="grid gap-1 text-sm">
                {[...d.bewerber.values()].map((b) => (
                  <li
                    key={b.candidateId}
                    className="flex items-center justify-between gap-2 border-b py-1"
                  >
                    {b.nachname}, {b.vorname}
                    <form action={removeVersammlungsBewerberAction}>
                      <input
                        type="hidden"
                        name="candidateId"
                        value={b.candidateId}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Entfernen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={addVersammlungsBewerberAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="electionId" value={id} />
              <select
                name="voterId"
                required
                defaultValue=""
                aria-label="Person"
                className="h-9 min-w-64 rounded-sm border border-input bg-card px-3 text-sm"
              >
                <option value="" disabled>
                  Wählbare Person auswählen …
                </option>
                {versammlungsBewerber
                  .filter((p) => !schonBewerber.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nachname}, {p.vorname} (Nr. {p.lfdNr})
                    </option>
                  ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                Hinzufügen
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {d.wahlverfahren && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auszählung</CardTitle>
            <CardDescription>
              {d.wahlverfahren === "verhaeltnis"
                ? `Gewählt werden Personen: Jede/r Wählende hat ${d.sitze} Stimmen, darf Bewerber anderer Vorschläge übernehmen und einer Person bis zu 3 Stimmen geben (§ 33 LPVGWO). Gültige Stimmen je Person eintragen – die Summe je Wahlvorschlag und die Sitzverteilung nach d'Hondt rechnet die App (§§ 37, 38 LPVGWO). Stimmen für übernommene Bewerber zählen für deren eigenen Vorschlag.`
                : `Jede/r Wählende hat bis zu ${d.sitze} ${d.sitze === 1 ? "Stimme" : "Stimmen"}, je Person höchstens eine (§ 40 LPVGWO). Gültige Stimmen je Person eintragen.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuszaehlungForm
              electionId={id}
              gesamt={result?.stimmzettelGesamt ?? null}
              ungueltig={result?.stimmzettelUngueltig ?? null}
              vorkommnisse={result?.vorkommnisse ?? null}
              felder={felder}
              feldTitel="Gültige Stimmen je Bewerberin/Bewerber"
              stimmenUngueltig={result?.stimmenUngueltig ?? null}
              disabled={festgestellt}
            />
          </CardContent>
        </Card>
      )}

      {d.pruefung &&
        (d.pruefung.fehler.length > 0 || d.pruefung.hinweise.length > 0) && (
          <ul className="grid gap-1 rounded-md border p-4 text-sm">
            {d.pruefung.fehler.map((f) => (
              <li key={f} className="text-destructive">
                {f}
              </li>
            ))}
            {d.pruefung.hinweise.map((h) => (
              <li
                key={h}
                className="text-foreground before:mr-1 before:content-['⚠']"
              >
                {h}
              </li>
            ))}
          </ul>
        )}

      {d.los && !festgestellt && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              Losentscheid erforderlich
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LosForm
              electionId={id}
              beteiligte={losBeteiligte}
              plaetze={d.los.plaetze}
            />
          </CardContent>
        </Card>
      )}

      {result && d.wahlverfahren && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {festgestellt ? "Festgestelltes Ergebnis" : "Vorschau"}
            </CardTitle>
            <CardDescription>
              {result.stimmzettelGesamt} Stimmzettel, davon{" "}
              {result.stimmzettelGueltig} gültig und{" "}
              {result.stimmzettelUngueltig} ungültig
              {d.losReihenfolge.length > 0 && " · Losentscheid berücksichtigt"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ErgebnisTabellen d={d} mitHoechstzahlen />
            {canFinalize ? (
              <FeststellenForm
                electionId={id}
                bereit={d.bereit}
                festgestellt={festgestellt}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Das Ergebnis stellt der Vorsitz des Wahlvorstands fest.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
