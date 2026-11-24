import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { sicheresZiel } from "@/lib/weiter";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string; abgemeldet?: string }> }) {
  const sp = await searchParams;
  const ziel = sicheresZiel(sp.weiter);
  const session = await getSession();
  if (session && !session.user.banned) redirect(ziel);

  const hinweis = sp.abgemeldet
    ? "Sie haben sich abgemeldet."
    : sp.weiter && ziel !== "/"
      ? "Bitte melden Sie sich an, um fortzufahren. Danach geht es direkt zur aufgerufenen Seite."
      : null;

  return (
    <AuthShell>
      <div className="grid w-full max-w-sm gap-7">
        <div>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Wahlvorstand · Wahlhelfer</p>
          <h1 className="mt-1 text-4xl">Anmelden</h1>
        </div>
        {hinweis && (
          <p role="status" className="border-l-4 border-l-foreground bg-card p-3 text-sm">
            {hinweis}
          </p>
        )}
        <LoginForm ziel={ziel} />
        <div className="grid gap-2 border-t pt-5 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Erste Anmeldung?</span> Sie erhalten Benutzername und Startpasswort von der
            Administration und legen danach ein eigenes Passwort fest.
          </p>
          <p>
            <span className="font-semibold text-foreground">Passwort vergessen oder Konto gesperrt?</span> Die Administration setzt das
            Passwort zurück. Nach fünf Fehlversuchen ist das Konto für 15 Minuten gesperrt.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
