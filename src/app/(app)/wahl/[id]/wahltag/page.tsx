import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { VoteList, type VoteRow } from "./vote-list";

export const metadata = { title: "Wahltag" };

const zeit = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

export default async function WahltagPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "voters.markVoted")) notFound();
  const canCorrect = hasPermission(role, "voters.edit");

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  // Nur, was am Wahltag nötig ist – keine Geburtsdaten oder sonstigen Merkmale.
  const voters = await prisma.voter.findMany({
    where: { electionId: id, wahlberechtigt: true },
    orderBy: { lfdNr: "asc" },
    select: {
      id: true,
      lfdNr: true,
      nachname: true,
      vorname: true,
      votedAt: true,
      stimmabgabeArt: true,
      briefwahlBeantragtAm: true,
      briefwahlVersandtAm: true,
      briefwahlEingangAm: true,
    },
  });

  const rows: VoteRow[] = voters.map((v) => ({
    id: v.id,
    lfdNr: v.lfdNr,
    nachname: v.nachname,
    vorname: v.vorname,
    votedAt: v.votedAt ? zeit.format(v.votedAt) : null,
    art: v.stimmabgabeArt,
    briefBeantragt: Boolean(v.briefwahlBeantragtAm),
    briefVersandt: Boolean(v.briefwahlVersandtAm),
    briefEingegangen: Boolean(v.briefwahlEingangAm),
  }));

  const gesamt = rows.length;
  const gewaehlt = rows.filter((r) => r.votedAt).length;
  const brief = rows.filter((r) => r.art === "brief").length;
  const briefOffen = rows.filter(
    (r) => r.briefVersandt && !r.briefEingegangen,
  ).length;
  const beteiligung = gesamt ? Math.round((gewaehlt / gesamt) * 1000) / 10 : 0;
  const wahltag = fromDbDate(election.wahltag);
  const heute = todayBerlin();

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}`} className="hover:underline">
            Wahlkalender
          </Link>{" "}
          / Wahltag
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl">Wahltag – Stimmabgabe vermerken</h1>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/urne/${id}`}>Tablet-Ansicht für den Wahltisch</Link>
            </Button>
            {canCorrect && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/wahl/${id}/wahltag/briefwahl`}>
                  Briefwahlunterlagen drucken
                </Link>
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">
          {election.dienststelle} · {formatIsoDate(wahltag)}
        </p>
      </div>

      {heute !== wahltag && (
        <p
          role="note"
          className="rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-3 text-sm text-foreground"
        >
          Heute ist nicht der Wahltag. Stimmabgaben an der Urne bitte nur am
          Wahltag vermerken; Briefwahl-Anträge und -Versand können vorher
          erfasst werden.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gewählt</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {gewaehlt} / {gesamt}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Wahlbeteiligung {beteiligung.toLocaleString("de-DE")} %
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Davon per Brief</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{brief}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Wahlbriefe vor Schluss der Wahl in die Urne
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Briefwahl ausstehend</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {briefOffen}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Unterlagen versandt, Wahlbrief noch nicht da
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <VoteList rows={rows} canCorrect={canCorrect} />
        </CardContent>
      </Card>
    </div>
  );
}
