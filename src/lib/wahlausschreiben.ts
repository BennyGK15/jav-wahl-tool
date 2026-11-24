import { z } from "zod";

const zeit = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit im Format HH:MM");
const text = (max = 255) => z.string().trim().max(max);

/** Mitglieder des Wahlvorstands mit Ersatzmitgliedern in der vom Personalrat bestimmten Reihenfolge (§ 1 Abs. 3 LPVGWO). */
export const wahlvorstandSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Name fehlt").max(120),
      funktion: z.enum(["vorsitz", "stellvertretung", "mitglied"]),
      /** Ersatzmitglieder für dieses Mitglied, in Reihenfolge, durch Komma getrennt */
      ersatz: z.string().trim().max(250).optional(),
      /** Nach § 9 LPVG in den Personalrat wählbar (§ 54 Abs. 1 Nr. 3 LPVGWO) */
      prWaehlbar: z.boolean().optional(),
    }),
  )
  .max(9);

export type WahlvorstandMitglied = z.infer<typeof wahlvorstandSchema>[number];

export const FUNKTION_LABEL = { vorsitz: "Vorsitz", stellvertretung: "Stellvertretender Vorsitz", mitglied: "Mitglied" } as const;

/** Organisatorische Angaben, die nicht aus dem Wahlkalender kommen. Alle optional – Fehlendes wird markiert. */
export const angabenSchema = z.object({
  ausstellungsort: text(120).optional(),
  wahlzeitVon: zeit.optional(),
  wahlzeitBis: zeit.optional(),
  wahlraum: text().optional(),
  auslageOrt: text().optional(),
  auslageZeiten: text().optional(),
  einreichungsstelle: text().optional(),
  bekanntmachungsort: text().optional(),
  auszaehlungZeit: zeit.optional(),
  auszaehlungOrt: text().optional(),
  briefwahlHinweis: text(1000).optional(),
  /** Ende der Dienststunden der Mehrheit der Wahlberechtigten – Fristenden dürfen nicht davor liegen (§ 55 Abs. 2 LPVGWO) */
  dienstschluss: zeit.optional(),
  /** Ergebnis des Losentscheids um den letzten Sitz bei der Verteilung auf Frauen und Männer (§ 7 Abs. 2 Satz 5 LPVGWO) */
  geschlechterLos: z.enum(["w", "m"]).optional(),
  /** Wahlvorstand (strukturiert); ungültige Altdaten werden verworfen statt alle Angaben zu verlieren */
  wahlvorstand: wahlvorstandSchema.optional().catch(undefined),
  /** Tag der Bestimmung des Wahlvorstands durch den Personalrat */
  wahlvorstandBestelltAm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

export type Angaben = z.infer<typeof angabenSchema>;

/** Liest gespeicherte Angaben robust (unbekannte/ungültige Felder werden verworfen). */
export function parseAngaben(value: unknown): Angaben {
  const r = angabenSchema.safeParse(value ?? {});
  return r.success ? r.data : {};
}
