import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BESTAETIGUNG, DEV_RESET_ERLAUBT } from "@/lib/dev-reset";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Entwicklung: Neustart" };

export default async function EntwicklungPage() {
  if (!DEV_RESET_ERLAUBT) notFound();
  const session = await requireSession();
  if (!hasPermission(session.user.role, "users.manage")) notFound();
  const [wahlen, personen, benutzer] = await Promise.all([
    prisma.election.count(),
    prisma.voter.count(),
    prisma.user.count(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          Nur in der Entwicklungsumgebung sichtbar
        </p>
        <h1 className="mt-1 text-3xl">Neu starten</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Setzt die Anwendung auf den Stand einer frischen Installation zurück,
          damit sich der komplette Ablauf – ab dem Einrichtungsassistenten –
          erneut durchspielen lässt.
        </p>
      </div>
      <Card className="max-w-3xl border-destructive">
        <CardHeader>
          <CardTitle className="text-base">Was passiert</CardTitle>
          <CardDescription>
            Das lässt sich nicht rückgängig machen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold">Wird gelöscht</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>
                  {wahlen} {wahlen === 1 ? "Wahl" : "Wahlen"} mit {personen}{" "}
                  {personen === 1 ? "Person" : "Personen"} im Wählerverzeichnis
                </li>
                <li>
                  Wahlvorschläge, Einsprüche, Fristen, Checklisten, Ergebnisse
                </li>
                <li>Angepasste Fristregeln (zurück auf die Vorgaben)</li>
                <li>Audit-Log</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 font-semibold">Bleibt erhalten</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>
                  {benutzer}{" "}
                  {benutzer === 1 ? "Benutzerkonto" : "Benutzerkonten"} mit
                  Rollen, Passwörtern und 2FA
                </li>
                <li>Laufende Anmeldungen – du bleibst eingeloggt</li>
                <li>Feiertage</li>
              </ul>
            </div>
          </div>
          <ResetForm bestaetigung={BESTAETIGUNG} />
        </CardContent>
      </Card>
    </div>
  );
}
