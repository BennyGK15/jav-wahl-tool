import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import Wählerverzeichnis" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, select: { id: true, dienststelle: true } });
  if (!election) notFound();

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        <Link href={`/wahl/${id}/waehler`} className="hover:underline">
          Wählerverzeichnis
        </Link>{" "}
        / Import
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Daten der Personalstelle importieren</CardTitle>
          <CardDescription>
            Benötigt werden Nachname, Vorname und Geburtsdatum; optional Ausbildung (ja/nein), Ausbildungsende,
            Organisationseinheit und Geschlecht. Bitte nur die für die Wahl nötigen Spalten anfordern (Datenminimierung).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportWizard electionId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
