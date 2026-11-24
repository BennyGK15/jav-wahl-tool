import Link from "next/link";

/** `oeffentlich`: ohne Link auf die Datenschutz-Unterlagen (nur angemeldet erreichbar). */
export function SiteFooter({
  oeffentlich = false,
}: Readonly<{ oeffentlich?: boolean }>) {
  return (
    <footer className="mt-auto bg-brand-ink text-sm text-white print:hidden">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-6">
        <p className="font-semibold">
          JAV-Wahl-Tool · Arbeitshilfe für den Wahlvorstand
          {!oeffentlich && (
            <>
              {" · "}
              <Link
                href="/datenschutz"
                className="text-white underline underline-offset-4"
              >
                Datenschutz
              </Link>
            </>
          )}
        </p>
        <p className="text-white/75">
          Rechtsgrundlagen: LPVG BW und LPVGWO in der jeweils geltenden Fassung.
          Personenbezogene Daten werden verschlüsselt gespeichert.
        </p>
      </div>
    </footer>
  );
}
