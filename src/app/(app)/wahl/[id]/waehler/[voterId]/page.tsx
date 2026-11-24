import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { getVoterDecrypted } from "@/server/voters";
import { VoterForm } from "../voter-form";

export const metadata = { title: "Person bearbeiten" };

export default async function VoterEditPage({
  params,
}: Readonly<{ params: Promise<{ id: string; voterId: string }> }>) {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "voters.edit") ||
    !hasPermission(session.user.role, "voters.sensitive.read")
  )
    notFound();

  const { id, voterId } = await params;
  const voter = await getVoterDecrypted(voterId);
  if (!voter || voter.electionId !== id) notFound();

  // Lesender Zugriff auf verschlüsselte Felder wird protokolliert.
  await writeAudit({
    userId: session.user.id,
    action: "voter.sensitive.read",
    objectType: "voter",
    objectId: voter.id,
    fields: ["geburtsdatum", "ausbildungsende"],
  });

  return (
    <div className="grid max-w-3xl gap-6">
      <p className="text-sm text-muted-foreground">
        <Link href={`/wahl/${id}/waehler`} className="hover:underline">
          Wählerverzeichnis
        </Link>{" "}
        / Nr. {voter.lfdNr}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>
            {voter.vorname} {voter.nachname}
          </CardTitle>
          <CardDescription>
            Änderungen werden protokolliert. Wahlberechtigung und Wählbarkeit
            werden neu geprüft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoterForm
            electionId={id}
            defaults={{
              voterId: voter.id,
              nachname: voter.nachname,
              vorname: voter.vorname,
              organisationseinheit: voter.organisationseinheit,
              funktion: voter.funktion,
              geburtsdatum: voter.geburtsdatum,
              inAusbildung: voter.inAusbildung,
              ausbildungsende: voter.ausbildungsende,
              geschlecht: voter.geschlecht,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
