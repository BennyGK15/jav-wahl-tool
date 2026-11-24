import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { loeschVorschlag } from "@/lib/aufbewahrung";
import { TAGE_NACH_ABSCHLUSS } from "@/lib/datenschutz";
import { addDays } from "@/lib/fristen";
import { AnfechtungForm, CloseForm, DeleteForm, RetentionForm } from "./forms";

export const metadata = { title: "Aufbewahrung und Löschung" };

const STATUS = { vorbereitung: "Vorbereitung", eingeleitet: "eingeleitet", wahl: "Ergebnis festgestellt", abgeschlossen: "abgeschlossen" } as const;

export default async function AufbewahrungPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "retention.execute")) notFound();

  const elections = await prisma.election.findMany({
    orderBy: { wahltag: "desc" },
    include: {
      result: { select: { festgestelltAm: true } },
      deadlines: { where: { ruleKey: "anfechtung_ende" } },
      _count: { select: { voters: true } },
    },
  });
  const heute = todayBerlin();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Aufbewahrung und Löschung</h1>
        <div className="grid max-w-3xl gap-2 text-muted-foreground">
          <p>
            Elektronisch gespeicherte Daten und Wahlunterlagen sind unverzüglich zu löschen, sobald die Gültigkeit oder Ungültigkeit der
            Wahl feststeht (§ 32 LPVGWO) – also nach Ablauf der Anfechtungsfrist von 12 Arbeitstagen ab Bekanntgabe des Ergebnisses
            (§ 21 LPVG) bzw. nach rechtskräftigem Abschluss eines Anfechtungsverfahrens. Die Frist bitte mit der/dem Datenschutzbeauftragten
            abstimmen. Nach Ablauf wird die Wahl mit allen Daten endgültig gelöscht; das Audit-Log enthält keine Inhalte und bleibt.
          </p>
          <p>
            <strong className="text-foreground">Vor dem Löschen:</strong> Die Wahlunterlagen (Niederschriften, Bekanntmachungen, Stimmzettel
            usw.) bewahrt der Personalrat in schriftlicher Form mindestens bis zur nächsten Personalratswahl auf (§ 32 LPVGWO). Also
            Wahlniederschrift, Bekanntmachungen und Sitzungsniederschriften vorher ausdrucken. Zurückgewiesene Wahlbriefe sind einen Monat
            nach Bekanntmachung des Ergebnisses zu vernichten (§ 23 Abs. 7 LPVGWO).
          </p>
        </div>
      </div>

      {elections.length === 0 && <p className="text-sm text-muted-foreground">Keine Wahlen gespeichert.</p>}

      {elections.map((e) => {
        const frist = e.retentionUntil ? fromDbDate(e.retentionUntil) : null;
        const faellig = Boolean(frist && frist <= heute);
        const anf = e.anfechtungAm ? fromDbDate(e.anfechtungAm) : null;
        const anfErledigt = e.anfechtungErledigtAm ? fromDbDate(e.anfechtungErledigtAm) : null;
        const fristEnde = e.deadlines[0] ? fromDbDate(e.deadlines[0].datum) : null;
        const v = loeschVorschlag({ anfechtungsfristEnde: fristEnde, anfechtungAm: anf, anfechtungErledigtAm: anfErledigt });
        return (
          <Card key={e.id} className={faellig && e.status === "abgeschlossen" ? "border-destructive/50" : undefined}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {e.dienststelle} · Wahl am {formatIsoDate(fromDbDate(e.wahltag))}
                </CardTitle>
                <Badge variant={e.status === "abgeschlossen" ? "outline" : "secondary"}>{STATUS[e.status]}</Badge>
                {faellig && <Badge variant="warning">Frist abgelaufen</Badge>}
              </div>
              <CardDescription>
                {e._count.voters} Personendatensätze · {frist ? `aufzubewahren bis ${formatIsoDate(frist)}` : "keine Aufbewahrungsfrist festgelegt"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 text-sm sm:col-span-2">
                {e.status !== "vorbereitung" && (
                  <p>
                    <strong>Vor dem Löschen:</strong>{" "}
                    <Link href={`/wahl/${e.id}/wahlakte`} className="underline">
                      Wahlakte für den Personalrat zusammenstellen und ausdrucken
                    </Link>
                    .
                  </p>
                )}
                <p>
                  <strong>Löschtermin nach § 32 LPVGWO:</strong>{" "}
                  {v.gesperrt ? (
                    <span className="text-destructive">{v.grund}</span>
                  ) : v.fruehestens ? (
                    <>
                      frühestens {formatIsoDate(v.fruehestens)} – {v.grund} Danach sind die elektronischen Daten unverzüglich zu löschen.
                    </>
                  ) : (
                    v.grund
                  )}
                </p>
                {e.result?.festgestelltAm && <AnfechtungForm electionId={e.id} am={anf} erledigtAm={anfErledigt} />}
              </div>
              {!v.gesperrt && <RetentionForm electionId={e.id} value={frist} vorschlag={v.fruehestens} />}
              {e.status !== "abgeschlossen" && (
                <div className="grid gap-1 text-sm">
                  <p className="text-muted-foreground">
                    {e.result?.festgestelltAm ? "Ergebnis festgestellt – die Wahl kann abgeschlossen werden." : "Abschluss erst nach Feststellung des Ergebnisses."}
                  </p>
                  {e.result?.festgestelltAm && <CloseForm electionId={e.id} />}
                </div>
              )}
              {e.status === "abgeschlossen" && faellig && !v.gesperrt && (
                <div className="sm:col-span-2">
                  <DeleteForm electionId={e.id} dienststelle={e.dienststelle} />
                </div>
              )}
              {e.status === "abgeschlossen" && e.abgeschlossenAm && (
                <p className="text-sm sm:col-span-2">
                  Abgeschlossen am {formatIsoDate(fromDbDate(e.abgeschlossenAm))}. Benutzerkonten (außer Administration) bitte ab{" "}
                  <strong>{formatIsoDate(addDays(fromDbDate(e.abgeschlossenAm), TAGE_NACH_ABSCHLUSS))}</strong> löschen; das Audit-Log löscht die Anwendung dann
                  automatisch (Löschkonzept, siehe Datenschutz-Unterlagen).
                </p>
              )}
              {e.status === "abgeschlossen" && !faellig && (
                <p className="text-sm text-muted-foreground">Löschung ist nach Ablauf der Frist möglich.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
