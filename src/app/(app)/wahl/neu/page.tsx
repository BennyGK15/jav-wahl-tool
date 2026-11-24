import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { getActiveElection, loadRules } from "@/server/elections";
import { ElectionForm } from "./election-form";

export const metadata = { title: "Wahl anlegen" };

export default async function NeueWahlPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "election.manage")) {
    return (
      <p className="text-muted-foreground">
        Nur der Vorsitz des Wahlvorstands kann eine Wahl anlegen.
      </p>
    );
  }
  const active = await getActiveElection();
  if (active) redirect(`/wahl/${active.id}`);
  const erlassMonate =
    (await loadRules("regulaer")).find((r) => r.key === "wahlausschreiben")
      ?.amount ?? 2;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          Wahl einrichten · Schritt 1: Grunddaten
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Neue Wahl anlegen</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Danach führt der Assistent durch Wahlvorstand, Orte und Zeiten,
          Stützunterschriften und Datenschutz. Erst wenn alles vollständig ist,
          werden Wahlkalender und Phasen freigeschaltet – so fehlt später keine
          Angabe, wenn eine Frist läuft.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Grunddaten</CardTitle>
          <CardDescription>
            Aus der Zahl der Wahlberechtigten ergeben sich Größe der JAV und
            mögliches Verfahren, daraus der Wahlkalender.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ElectionForm
            erlassMonate={erlassMonate}
            submitLabel="Weiter zum Wahlvorstand"
          />
        </CardContent>
      </Card>
    </div>
  );
}
