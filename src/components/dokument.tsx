/**
 * Gestaltungselemente für Druck- und Exportdokumente: Briefkopf und Fußzeile mit Seitenzahlen.
 * Zurückhaltend gehalten: Anthrazit als Strukturfarbe, Landesgelb nur als kleiner Akzent.
 */

/** Briefkopf des Wahlvorstands – oben auf jedem Dokument bzw. jedem Einzelschreiben. */
export function Briefkopf({ dienststelle, art, datum }: { dienststelle: string; art: string; datum?: string | null }) {
  return (
    <div className="dok-kopf relative mb-8 grid grid-cols-[auto_1fr_auto] items-start gap-4 border-b-[1.5pt] border-brand-ink pb-3 break-inside-avoid">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center bg-brand-yellow font-sans text-[11pt] font-bold tracking-tight text-brand-ink ring-1 ring-brand-ink ring-inset"
      >
        JAV
      </span>
      <div className="leading-tight">
        <p className="text-[7.5pt] font-bold tracking-[0.14em] text-brand-ink uppercase">Der Wahlvorstand</p>
        <p className="text-[9.5pt]">für die Wahl der Jugend- und Auszubildendenvertretung</p>
        <p className="text-[9.5pt] font-semibold">{dienststelle}</p>
      </div>
      <div className="text-right leading-tight">
        <p className="text-[7.5pt] font-bold tracking-[0.14em] text-brand-ink uppercase">{art}</p>
        {datum && <p className="mt-1 text-[9pt] text-neutral-600">{datum}</p>}
      </div>
      <span aria-hidden className="absolute -bottom-[3pt] left-0 h-[3pt] w-16 bg-brand-yellow" />
    </div>
  );
}

/** Text sicher in einen CSS-String setzen (auch gegen das Beenden des <style>-Elements). */
function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[<>\r\n]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`;
}

/**
 * Fußzeile im Ausdruck über Seitenränder (@page): links die Kennung des Dokuments, rechts „Seite x von y“.
 * Bei Serienbriefen (seiten=false) ohne Seitenzählung, weil sie über alle Schreiben liefe.
 */
export function DokFuss({ text, seiten = true }: { text: string; seiten?: boolean }) {
  const css = `@media print { @page {
    @bottom-left { content: ${cssString(text)}; font: 7.5pt/1.2 Arial, Helvetica, sans-serif; color: #5d5754; vertical-align: top; padding-top: 4mm; }
    ${seiten ? `@bottom-right { content: "Seite " counter(page) " von " counter(pages); font: 7.5pt/1.2 Arial, Helvetica, sans-serif; color: #5d5754; vertical-align: top; padding-top: 4mm; }` : ""}
  } }`;
  return <style>{css}</style>;
}
