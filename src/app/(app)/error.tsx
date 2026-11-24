"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Fehler({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In Produktion liefert Next.js keine Details – nur bei bekannten deutschen Meldungen zeigen wir den Text.
  const keineBerechtigung = error.message === "Keine Berechtigung";

  return (
    <div className="grid max-w-xl gap-4">
      <p className="text-sm font-semibold text-muted-foreground">
        {keineBerechtigung ? "Zugriff verweigert" : "Fehler"}
      </p>
      <h1 className="text-4xl">
        {keineBerechtigung
          ? "Keine Berechtigung"
          : "Da ist etwas schiefgelaufen"}
      </h1>
      <p className="text-muted-foreground">
        {keineBerechtigung
          ? "Für diese Aktion fehlt Ihrer Rolle die Berechtigung. Wenden Sie sich bei Bedarf an den Vorsitz des Wahlvorstands."
          : "Die Aktion konnte nicht ausgeführt werden. Ihre Eingaben wurden nicht oder nur teilweise gespeichert. Bitte versuchen Sie es erneut."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Fehlerkennung für die Administration: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!keineBerechtigung && (
          <Button onClick={reset}>Erneut versuchen</Button>
        )}
        <Button asChild variant="outline">
          <Link href="/">Zur Übersicht</Link>
        </Button>
      </div>
    </div>
  );
}
