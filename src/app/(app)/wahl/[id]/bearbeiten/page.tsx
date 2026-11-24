import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fromDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { loadRules } from "@/server/elections";
import { ElectionForm } from "../../neu/election-form";
import { updateElectionAction } from "./actions";

export const metadata = { title: "Wahl bearbeiten" };

export default async function WahlBearbeitenPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "election.manage")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, include: { result: true } });
  if (!election) notFound();
  const erlassMonate = (await loadRules("regulaer")).find((r) => r.key === "wahlausschreiben")?.amount ?? 2;
  const gesperrt = election.status === "abgeschlossen" || Boolean(election.result?.festgestelltAm);

  return (
    <div className="grid max-w-3xl gap-6">
      <p className="text-sm text-muted-foreground">
        <Link href={`/wahl/${id}`} className="hover:underline">
          Wahlkalender
        </Link>{" "}
        / Bearbeiten
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Wahl bearbeiten</CardTitle>
          <CardDescription>
            Nach dem Speichern werden der Wahlkalender neu berechnet und – bei geändertem Wahltag – Wahlberechtigung und
            Wählbarkeit aller Personen neu geprüft. Manuell überschriebene Termine bleiben erhalten. Ein bereits freigegebenes
            Wahlausschreiben muss danach neu freigegeben werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gesperrt ? (
            <p className="text-sm text-muted-foreground">Nach Feststellung des Ergebnisses kann die Wahl nicht mehr geändert werden.</p>
          ) : (
            <ElectionForm
              action={updateElectionAction}
              submitLabel="Änderungen speichern"
              erlassMonate={erlassMonate}
              defaults={{
                electionId: election.id,
                dienststelle: election.dienststelle,
                wahlberechtigte: election.wahlberechtigteSchaetzung,
                verfahren: election.verfahren,
                wahltag: fromDbDate(election.wahltag),
                amtszeitEnde: election.amtszeitEnde ? fromDbDate(election.amtszeitEnde) : null,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
