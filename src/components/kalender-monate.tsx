import { Check } from "lucide-react";
import { isWorkday, type IsoDate } from "@/lib/fristen";
import { feiertageImZeitraum, monatsRaster } from "@/lib/kalender";
import { cn } from "@/lib/utils";

export interface KalenderTermin {
  key: string;
  iso: IsoDate;
  label: string;
  uhrzeit: string | null;
  erledigt: boolean;
  /** Sprungziel, z. B. "#frist-auslage_beginn" */
  href?: string;
}

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TAG_KURZ = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const kurz = (iso: IsoDate) => TAG_KURZ.format(new Date(`${iso}T00:00:00Z`));

type Art = "wahltag" | "ueberfaellig" | "offen" | "erledigt";

function artDesTages(
  termine: KalenderTermin[],
  istWahltag: boolean,
  heute: IsoDate,
): Art | null {
  if (istWahltag) return "wahltag";
  if (termine.length === 0) return null;
  const offen = termine.filter((t) => !t.erledigt);
  if (offen.length === 0) return "erledigt";
  return offen.some((t) => t.iso < heute) ? "ueberfaellig" : "offen";
}

const ART_KLASSE: Record<Art, string> = {
  wahltag: "bg-foreground font-bold text-background",
  ueberfaellig: "bg-destructive font-bold text-white",
  offen: "bg-brand-yellow font-bold text-brand-ink",
  erledigt: "bg-secondary font-semibold text-muted-foreground",
};

/** Kalenderansicht des Wahlkalenders: ein Blatt je Monat mit markierten Terminen und Terminliste. */
export function KalenderMonate({
  termine,
  wahltag,
  wahltagLabel,
  heute,
}: {
  termine: readonly KalenderTermin[];
  wahltag: IsoDate;
  wahltagLabel: string;
  heute: IsoDate;
}) {
  const daten = [wahltag, ...termine.map((t) => t.iso)].sort();
  const von = daten[0]!;
  const bis = daten[daten.length - 1]!;
  const monate = monatsRaster(von, bis);
  const feiertage = feiertageImZeitraum(
    `${von.slice(0, 7)}-01`,
    `${bis.slice(0, 7)}-31`,
  );
  const proTag = new Map<IsoDate, KalenderTermin[]>();
  for (const t of termine) proTag.set(t.iso, [...(proTag.get(t.iso) ?? []), t]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {monate.map((m) => {
          const wahltagTermin: KalenderTermin = {
            key: "wahltag",
            iso: wahltag,
            label: wahltagLabel,
            uhrzeit: null,
            erledigt: false,
          };
          const imMonat = [
            ...termine.filter((t) => t.iso.startsWith(m.key)),
            ...(wahltag.startsWith(m.key) ? [wahltagTermin] : []),
          ].sort(
            (a, b) =>
              a.iso.localeCompare(b.iso) ||
              (a.key === "wahltag" ? 1 : b.key === "wahltag" ? -1 : 0),
          );
          return (
            <section
              key={m.key}
              aria-labelledby={`monat-${m.key}`}
              className="flex flex-col overflow-hidden rounded-sm border bg-card break-inside-avoid"
            >
              <h3
                id={`monat-${m.key}`}
                className="bg-brand-yellow px-4 py-2 font-serif text-lg font-bold text-brand-ink"
              >
                {m.titel}
              </h3>
              <div className="px-3 pt-3">
                <table className="w-full table-fixed border-separate border-spacing-1 text-center text-sm">
                  <thead>
                    <tr>
                      {WOCHENTAGE.map((w, i) => (
                        <th
                          key={w}
                          scope="col"
                          className={cn(
                            "pb-1 text-xs font-semibold",
                            i >= 5
                              ? "text-muted-foreground"
                              : "text-foreground",
                          )}
                        >
                          {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.wochen.map((woche, wi) => (
                      <tr key={wi}>
                        {woche.map((tag, ti) => {
                          if (!tag) return <td key={ti} />;
                          const tagesTermine = proTag.get(tag) ?? [];
                          const istWahltag = tag === wahltag;
                          const art = artDesTages(
                            tagesTermine,
                            istWahltag,
                            heute,
                          );
                          const feiertag = feiertage.get(tag);
                          const frei = !isWorkday(tag);
                          const titel = [
                            feiertag,
                            istWahltag ? wahltagLabel : null,
                            ...tagesTermine.map(
                              (t) =>
                                `${t.label}${t.uhrzeit ? `, ${t.uhrzeit} Uhr` : ""}${t.erledigt ? " (erledigt)" : ""}`,
                            ),
                            tag === heute ? "heute" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          const klasse = cn(
                            "flex h-8 items-center justify-center rounded-sm tabular-nums no-underline",
                            art
                              ? ART_KLASSE[art]
                              : frei
                                ? "bg-muted/60 text-muted-foreground"
                                : "text-foreground",
                            feiertag && !art && "italic",
                            tag === heute &&
                              "ring-2 ring-destructive ring-offset-1 ring-offset-card",
                          );
                          const inhalt = (
                            <>
                              {Number(tag.slice(8))}
                              {titel && (
                                <span className="sr-only">: {titel}</span>
                              )}
                            </>
                          );
                          const ziel = tagesTermine[0]?.href;
                          return (
                            <td key={ti} title={titel || undefined}>
                              {ziel ? (
                                <a
                                  href={ziel}
                                  className={cn(klasse, "hover:opacity-80")}
                                >
                                  {inhalt}
                                </a>
                              ) : (
                                <span className={klasse}>{inhalt}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="mt-auto grid gap-1.5 border-t px-4 py-3 text-sm">
                {imMonat.length === 0 && (
                  <li className="text-muted-foreground">Keine Termine</li>
                )}
                {imMonat.map((t) => {
                  const art = artDesTages([t], t.key === "wahltag", heute)!;
                  return (
                    <li
                      key={t.key}
                      className={cn(
                        "grid grid-cols-[auto_1fr] items-baseline gap-x-2",
                        t.erledigt && "text-muted-foreground",
                      )}
                    >
                      <span className="inline-flex items-baseline gap-1.5 font-semibold whitespace-nowrap tabular-nums">
                        <span
                          aria-hidden
                          className={cn(
                            "inline-block size-2.5 translate-y-px rounded-full",
                            ART_KLASSE[art],
                          )}
                        />
                        {kurz(t.iso)}
                      </span>
                      <span className={cn(t.key === "wahltag" && "font-bold")}>
                        {t.href ? (
                          <a
                            href={t.href}
                            className="no-underline hover:underline"
                          >
                            {t.label}
                          </a>
                        ) : (
                          t.label
                        )}
                        {t.uhrzeit && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {t.uhrzeit} Uhr
                          </span>
                        )}
                        {t.erledigt && (
                          <Check
                            aria-label="erledigt"
                            className="ml-1 inline size-3.5"
                          />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(
          [
            ["offen", "offener Termin"],
            ["ueberfaellig", "überfällig"],
            ["erledigt", "erledigt"],
            ["wahltag", wahltagLabel],
          ] as const
        ).map(([art, text]) => (
          <span key={art} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block size-3 rounded-sm", ART_KLASSE[art])}
            />{" "}
            {text}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm ring-2 ring-destructive"
          />{" "}
          heute
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm bg-muted/60"
          />{" "}
          Wochenende, Feiertag (kein Arbeitstag)
        </span>
      </p>
    </div>
  );
}
