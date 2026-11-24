"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// Bewusst generisch: verrät nicht, ob der Benutzername existiert.
const GENERIC_ERROR =
  "Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen. Nach mehreren Fehlversuchen ist das Konto 15 Minuten gesperrt.";

export function LoginForm({ ziel }: { ziel: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [zeigen, setZeigen] = useState(false);
  const [feststell, setFeststell] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!username || !password) {
      setError("Bitte Benutzername und Passwort eingeben.");
      return;
    }
    startTransition(async () => {
      const { data, error: signInError } = await authClient.signIn.username({ username, password });
      if (signInError) {
        // Gesperrte Konten bekommen dieselbe Meldung – sonst ließe sich erkennen, welche Benutzernamen existieren
        setError(signInError.status === 429 ? "Zu viele Versuche. Bitte einige Minuten warten." : GENERIC_ERROR);
        return;
      }
      // Mit aktivem zweiten Faktor leitet das Plugin selbst zu /login/2fa weiter
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
      router.replace(ziel);
      router.refresh();
    });
  }

  const pruefeFeststell = (e: React.KeyboardEvent<HTMLInputElement>) => setFeststell(e.getModifierState?.("CapsLock") ?? false);

  return (
    <form action={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="username">Benutzername</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required className="h-11" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Passwort</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={zeigen ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 pr-12"
            onKeyDown={pruefeFeststell}
            onKeyUp={pruefeFeststell}
            aria-describedby={feststell ? "feststell" : undefined}
          />
          <button
            type="button"
            onClick={() => setZeigen((z) => !z)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={zeigen ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={zeigen}
          >
            {zeigen ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
        {feststell && (
          <p id="feststell" className="text-sm font-medium text-destructive">
            Die Feststelltaste ist aktiv.
          </p>
        )}
      </div>
      <div aria-live="assertive">
        {error && <p className="border-l-4 border-l-destructive bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Anmelden …" : "Anmelden"}
      </Button>
    </form>
  );
}
