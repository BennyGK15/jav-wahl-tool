import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fromDbDate } from "@/lib/dates";
import { schwellenHinweise, verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn, formatIsoDate } from "@/lib/utils";
import { voterCounts } from "@/server/voters";
import { deleteVoterAction, renumberAction } from "./actions";
import { VoterForm } from "./voter-form";

export const metadata = { title: "Wählerverzeichnis" };

const ANSICHTEN = {
  berechtigt: { label: "Wählerverzeichnis", where: { wahlberechtigt: true } },
  waehlbar: {
    label: "Nur wählbar",
    where: { wahlberechtigt: false, waehlbar: true },
  },
  alle: { label: "Alle Personen", where: {} },
} as const;
type Ansicht = keyof typeof ANSICHTEN;

export default async function WaehlerPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ansicht?: string }>;
}>) {
  const session = await requireSession();
  const role = session.user.role;
  const canEdit = hasPermission(role, "voters.edit");
  if (!canEdit && !hasPermission(role, "voters.markVoted")) notFound();

  const { id } = await params;
  const { ansicht: rawAnsicht } = await searchParams;
  const ansicht: Ansicht =
    rawAnsicht && rawAnsicht in ANSICHTEN
      ? (rawAnsicht as Ansicht)
      : "berechtigt";

  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  const [voters, counts] = await Promise.all([
    prisma.voter.findMany({
      where: { electionId: id, ...ANSICHTEN[ansicht].where },
      orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
      select: {
        id: true,
        lfdNr: true,
        nachname: true,
        vorname: true,
        organisationseinheit: true,
        funktion: true,
        inAusbildung: true,
        wahlberechtigt: true,
        waehlbar: true,
      },
    }),
    voterCounts(id),
  ]);

  const hinweise =
    counts.wahlberechtigt > 0
      ? schwellenHinweise(
          election.wahlberechtigteSchaetzung,
          counts.wahlberechtigt,
          election.verfahren,
        )
      : [];
  const auskunft = verfahrensauskunft(counts.wahlberechtigt);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/wahl/${id}`} className="hover:underline">
              Wahlkalender
            </Link>{" "}
            / Wählerverzeichnis
          </p>
          <h1 className="text-3xl">Wählerverzeichnis</h1>
          <p className="text-muted-foreground">
            {election.dienststelle} · Stichtag für Alter und Ausbildung: Wahltag{" "}
            {formatIsoDate(fromDbDate(election.wahltag))}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <form action={renumberAction}>
              <input type="hidden" name="electionId" value={id} />
              <ConfirmSubmitButton
                variant="outline"
                size="sm"
                confirmText="Alle Personen alphabetisch neu nummerieren? Bereits ausgedruckte Listen stimmen danach nicht mehr."
              >
                Alphabetisch nummerieren
              </ConfirmSubmitButton>
            </form>
            <Button asChild size="sm" variant="outline">
              <Link href={`/wahl/${id}/waehler/import`}>CSV importieren</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/wahl/${id}/einsprueche`}>Einsprüche</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/wahl/${id}/waehler/auslage`}>
                Auslage-Fassung drucken
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Wahlberechtigt</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {counts.wahlberechtigt}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {auskunft.javMoeglich
              ? `JAV mit ${auskunft.mitglieder} ${auskunft.mitglieder === 1 ? "Mitglied" : "Mitgliedern"}`
              : "unter 5: keine JAV"}{" "}
            · Schätzung {election.wahlberechtigteSchaetzung}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Nur wählbar (nicht wahlberechtigt)
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {counts.nurWaehlbar}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            unter 26, nicht in Ausbildung
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erfasste Personen</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {counts.gesamt}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            inkl. weder noch
          </CardContent>
        </Card>
      </div>

      {hinweise.length > 0 && (
        <ul
          role="alert"
          className="grid gap-1 rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-4 text-sm text-foreground"
        >
          {hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
          <li>
            Bitte prüfen, ob Verfahren oder Wahlausschreiben angepasst werden
            müssen.
          </li>
        </ul>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Person erfassen</CardTitle>
            <CardDescription>
              Wahlberechtigung und Wählbarkeit werden automatisch zum Wahltag
              geprüft (§ 60 LPVG BW). Geburtsdatum und Ausbildungsende werden
              verschlüsselt gespeichert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoterForm electionId={id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-2">
          {(Object.keys(ANSICHTEN) as Ansicht[]).map((key) => (
            <Link
              key={key}
              href={`/wahl/${id}/waehler?ansicht=${key}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                key === ansicht
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
              aria-current={key === ansicht ? "page" : undefined}
            >
              {ANSICHTEN[key].label}
            </Link>
          ))}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {voters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge in dieser Ansicht.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Nr.</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">
                    Funktion / Organisationseinheit
                  </th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canEdit && <th className="py-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {voters.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-2 pr-4 tabular-nums">{v.lfdNr}</td>
                    <td className="py-2 pr-4">
                      {v.nachname}, {v.vorname}
                    </td>
                    <td className="py-2 pr-4">
                      {v.funktion ?? (
                        <span className="text-destructive">Funktion fehlt</span>
                      )}
                      {v.organisationseinheit && (
                        <span className="block text-xs text-muted-foreground">
                          {v.organisationseinheit}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {v.wahlberechtigt ? (
                          <Badge variant="secondary">wahlberechtigt</Badge>
                        ) : (
                          <Badge variant="outline">nicht wahlberechtigt</Badge>
                        )}
                        {v.waehlbar && <Badge variant="outline">wählbar</Badge>}
                        {v.inAusbildung && (
                          <Badge variant="outline">Ausbildung</Badge>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/wahl/${id}/waehler/${v.id}`}>
                              Bearbeiten
                            </Link>
                          </Button>
                          <form action={deleteVoterAction}>
                            <input type="hidden" name="voterId" value={v.id} />
                            <ConfirmSubmitButton
                              size="sm"
                              variant="ghost"
                              confirmText={`${v.vorname} ${v.nachname} wirklich löschen?`}
                            >
                              Löschen
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
