import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isRole, ROLE_LABELS } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { TwoFactorSetup } from "./two-factor-setup";

export const metadata = { title: "Mein Konto" };

export default async function KontoPage() {
  const session = await requireSession();
  const u = session.user;
  const aktiv = Boolean(u.twoFactorEnabled);
  const empfohlen = u.role === "vorsitz" || u.role === "admin";

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-3xl">Mein Konto</h1>
      <Card>
        <CardHeader>
          <CardTitle>{u.name}</CardTitle>
          <CardDescription>
            Benutzername {u.displayUsername ?? u.username} ·{" "}
            {isRole(u.role) ? ROLE_LABELS[u.role] : "ohne Rolle"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/passwort">Passwort ändern</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Zweiter Faktor (Authenticator-App)</CardTitle>
            {aktiv ? (
              <Badge variant="success">aktiv</Badge>
            ) : empfohlen ? (
              <Badge variant="warning">empfohlen</Badge>
            ) : null}
          </div>
          <CardDescription>
            Zusätzlich zum Passwort wird bei der Anmeldung ein Code aus einer
            App wie FreeOTP, Aegis, Microsoft oder Google Authenticator
            abgefragt. Für Vorsitz und Administration dringend empfohlen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup aktiv={aktiv} />
        </CardContent>
      </Card>
    </div>
  );
}
