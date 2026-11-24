"use client";

import "./globals.css";

/** Letzte Rückfallebene, wenn selbst das Layout nicht geladen werden kann. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body className="flex min-h-dvh flex-col">
        <div className="bg-brand-yellow">
          <div className="mx-auto flex h-16 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8 font-bold text-brand-ink">JAV-Wahl-Tool</div>
        </div>
        <main className="mx-auto grid w-full max-w-xl gap-4 px-4 py-16">
          <h1 className="text-4xl">Die Anwendung ist gerade nicht erreichbar</h1>
          <p className="text-muted-foreground">Bitte versuchen Sie es in einem Moment erneut. Besteht das Problem weiter, informieren Sie die Administration.</p>
          {error.digest && <p className="text-xs text-muted-foreground">Fehlerkennung: {error.digest}</p>}
          <div>
            <button type="button" onClick={reset} className="h-10 rounded-sm bg-brand-ink px-4 font-semibold text-white">
              Erneut versuchen
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
