"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Schritt = { art: "start" } | { art: "scannen"; qr: string; secret: string; backupCodes: string[] } | { art: "fertig" };

export function TwoFactorSetup({ aktiv }: { aktiv: boolean }) {
  const router = useRouter();
  const [schritt, setSchritt] = useState<Schritt>({ art: "start" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function aktivieren(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    startTransition(async () => {
      const { data, error: e } = await authClient.twoFactor.enable({ password });
      if (e || !data) {
        setError("Das Passwort ist nicht korrekt.");
        return;
      }
      if (!("totpURI" in data)) {
        setError("Die Einrichtung per Authenticator-App ist nicht verfügbar.");
        return;
      }
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
      setSchritt({ art: "scannen", qr, secret, backupCodes: data.backupCodes });
    });
  }

  function bestaetigen(formData: FormData) {
    setError(null);
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    startTransition(async () => {
      const { error: e } = await authClient.twoFactor.verifyTotp({ code });
      if (e) {
        setError("Der Code stimmt nicht. Bitte Uhrzeit des Geräts prüfen und erneut versuchen.");
        return;
      }
      setSchritt({ art: "fertig" });
      router.refresh();
    });
  }

  function deaktivieren(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    if (!window.confirm("Zweiten Faktor wirklich abschalten? Das Konto ist danach nur noch mit dem Passwort geschützt.")) return;
    startTransition(async () => {
      const { error: e } = await authClient.twoFactor.disable({ password });
      if (e) {
        setError("Das Passwort ist nicht korrekt.");
        return;
      }
      router.refresh();
    });
  }

  const fehler = error && (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );

  if (aktiv && schritt.art !== "scannen") {
    return (
      <form action={deaktivieren} className="grid max-w-sm gap-3">
        <p className="text-sm">
          Der zweite Faktor ist <strong>aktiv</strong>.
        </p>
        <Label htmlFor="pw-off">Passwort zur Bestätigung</Label>
        <Input id="pw-off" name="password" type="password" autoComplete="current-password" required />
        {fehler}
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            Zweiten Faktor abschalten
          </Button>
        </div>
      </form>
    );
  }

  if (schritt.art === "scannen") {
    return (
      <div className="grid gap-6">
        <ol className="grid gap-6 sm:grid-cols-[auto_1fr]">
          <li className="grid content-start gap-2">
            <p className="text-sm font-semibold">1. QR-Code mit der Authenticator-App scannen</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- lokal erzeugtes data:-Bild */}
            <img src={schritt.qr} alt="QR-Code für die Authenticator-App" width={220} height={220} className="border bg-white p-2" />
            <p className="text-xs text-muted-foreground">
              Oder manuell eingeben: <code className="break-all">{schritt.secret}</code>
            </p>
          </li>
          <li className="grid content-start gap-2">
            <p className="text-sm font-semibold">2. Backup-Codes sicher aufbewahren</p>
            <p className="text-sm text-muted-foreground">Jeder Code funktioniert einmal, falls das Handy verloren geht.</p>
            <ul className="grid grid-cols-2 gap-1 bg-secondary p-3 font-mono text-sm">
              {schritt.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </li>
        </ol>
        <form action={bestaetigen} className="grid max-w-sm gap-2">
          <Label htmlFor="code">3. Code aus der App eingeben</Label>
          <Input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="tracking-widest" />
          {fehler}
          <div>
            <Button type="submit" disabled={pending}>
              Aktivieren
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (schritt.art === "fertig") {
    return <p className="text-sm">Der zweite Faktor ist eingerichtet. Ab der nächsten Anmeldung wird der Code abgefragt.</p>;
  }

  return (
    <form action={aktivieren} className="grid max-w-sm gap-3">
      <Label htmlFor="pw-on">Passwort zur Bestätigung</Label>
      <Input id="pw-on" name="password" type="password" autoComplete="current-password" required />
      {fehler}
      <div>
        <Button type="submit" disabled={pending}>
          Zweiten Faktor einrichten
        </Button>
      </div>
    </form>
  );
}
