"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function TwoFactorForm() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    const trustDevice = formData.get("trustDevice") === "on";
    startTransition(async () => {
      const { error: e } = backup
        ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice });
      if (e) {
        setError(e.status === 429 ? "Zu viele Versuche. Bitte später erneut versuchen." : "Der Code ist ungültig oder abgelaufen.");
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="code">{backup ? "Backup-Code" : "Code aus der App"}</Label>
            <Input
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode={backup ? "text" : "numeric"}
              pattern={backup ? undefined : "[0-9 ]{6,7}"}
              maxLength={backup ? 32 : 7}
              className="text-lg tracking-widest"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="trustDevice" />
            Diesem Gerät 30 Tage vertrauen (nur auf eigenen Geräten)
          </label>
          {error && (
            <p role="alert" className="border-l-4 border-l-destructive bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Prüfen …" : "Bestätigen"}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" className="underline" onClick={() => setBackup(!backup)}>
              {backup ? "Code aus der App verwenden" : "Backup-Code verwenden"}
            </button>
            <Link href="/login">Zurück zur Anmeldung</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
