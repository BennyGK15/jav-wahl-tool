import Link from "next/link";
import type { ReactNode } from "react";
import { BriefkopfSeiten, DokFuss } from "./dokument";
import { PrintButton } from "./print-button";

/** Rahmen für Druckseiten: Brotkrumen + Druckknopf (nicht gedruckt) und Entwurfswarnung. */
export function DruckRahmen({
  zurueck,
  titel,
  entwurf,
  hinweis,
  kopf,
  fuss,
  children,
}: {
  zurueck: { href: string; label: string };
  titel: string;
  entwurf: boolean;
  hinweis?: ReactNode;
  /** Briefkopf oben auf jeder gedruckten Seite (bei Serienbriefen stattdessen je Schreiben <Briefkopf> verwenden) */
  kopf?: { dienststelle: string; art: string; datum?: string | null };
  /** Fußzeile im Ausdruck; seiten=false bei Serienbriefen */
  fuss?: { text: string; seiten?: boolean };
  children: ReactNode;
}) {
  const fussText =
    fuss?.text ?? (kopf ? `JAV-Wahl ${kopf.dienststelle} · ${kopf.art}` : null);
  const entwurfMarke = entwurf && (
    <p className="mb-4 text-center text-lg font-bold tracking-widest text-destructive">
      ENTWURF
    </p>
  );
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          <Link href={zurueck.href} className="hover:underline">
            {zurueck.label}
          </Link>{" "}
          / {titel}
        </p>
        <PrintButton />
      </div>
      {entwurf && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive print:hidden"
        >
          Das Ergebnis ist noch nicht festgestellt – dies ist ein Entwurf und
          darf nicht ausgehängt oder versandt werden.
        </p>
      )}
      {hinweis && (
        <div
          role="note"
          className="rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-3 text-sm text-foreground print:hidden"
        >
          {hinweis}
        </div>
      )}
      {fussText && (
        <DokFuss
          text={entwurf ? `ENTWURF · ${fussText}` : fussText}
          seiten={fuss?.seiten ?? true}
        />
      )}
      <div className="dok mx-auto w-full max-w-3xl print:max-w-none">
        {kopf ? (
          <BriefkopfSeiten kopf={kopf}>
            {entwurfMarke}
            {children}
          </BriefkopfSeiten>
        ) : (
          <>
            {entwurfMarke}
            {children}
          </>
        )}
      </div>
    </div>
  );
}

/** Wert in einem Druckdokument; fehlt er, erscheint ein roter Platzhalter (auch im Ausdruck). */
export function Wert({ v, l }: { v: string | null | undefined; l: string }) {
  return v ? (
    <strong>{v}</strong>
  ) : (
    <span className="rounded bg-destructive/10 px-1 font-medium text-destructive">
      [fehlt: {l}]
    </span>
  );
}
