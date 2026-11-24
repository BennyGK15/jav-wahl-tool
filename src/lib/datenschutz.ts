/**
 * Angaben und Festlegungen für die Datenschutz-Unterlagen (Verarbeitungsverzeichnis, TOM,
 * Datenschutz-Folgenabschätzung, Datenschutzhinweis). Reine Daten und Funktionen.
 */
import { z } from "zod";

const feld = (max = 300) => z.string().trim().max(max).optional();

/** Bearbeitbar in der Anwendung (Seite Datenschutz-Unterlagen). */
export const datenschutzAngabenSchema = z.object({
  verantwortlicheStelle: feld(200),
  anschrift: feld(300),
  leitung: feld(200),
  ansprechperson: feld(300),
  dsbName: feld(200),
  dsbKontakt: feld(300),
  betrieb: feld(300),
  serverstandort: feld(200),
});
export type DatenschutzAngaben = z.infer<typeof datenschutzAngabenSchema>;

export const DATENSCHUTZ_FELDER: { key: keyof DatenschutzAngaben; label: string; hinweis?: string; vorgabe?: string }[] = [
  { key: "verantwortlicheStelle", label: "Verantwortliche Stelle", hinweis: "z. B. die Dienststelle" },
  { key: "anschrift", label: "Anschrift" },
  { key: "leitung", label: "Vertreten durch (Leitung)" },
  { key: "ansprechperson", label: "Ansprechperson für die Wahl", hinweis: "z. B. Vorsitz des Wahlvorstands mit Kontakt" },
  { key: "dsbName", label: "Datenschutzbeauftragte/r" },
  { key: "dsbKontakt", label: "Kontakt der/des Datenschutzbeauftragten" },
  { key: "betrieb", label: "Betrieb der Anwendung", vorgabe: "Eigener Betrieb durch die IT der Dienststelle – keine Auftragsverarbeitung" },
  { key: "serverstandort", label: "Serverstandort", vorgabe: "Eigene Server der Dienststelle in Deutschland" },
];

export function parseDatenschutzAngaben(v: unknown): DatenschutzAngaben {
  const r = datenschutzAngabenSchema.safeParse(v ?? {});
  return r.success ? r.data : {};
}

/** Wert oder Vorgabe; null, wenn beides fehlt. */
export function angabe(a: DatenschutzAngaben, key: keyof DatenschutzAngaben): string | null {
  return a[key] || DATENSCHUTZ_FELDER.find((f) => f.key === key)?.vorgabe || null;
}

/** Frist für alles, was Gesetz und Wahlordnung nicht regeln (Festlegung des Wahlvorstands). */
export const TAGE_NACH_ABSCHLUSS = 30;

export interface Loeschfrist {
  daten: string;
  frist: string;
  grundlage: string;
  umsetzung: string;
}

/** Löschkonzept: gesetzliche Vorgaben, sonst 30 Tage nach Abschluss der Wahl; während einer laufenden Wahl keine Löschung. */
export const LOESCHFRISTEN: Loeschfrist[] = [
  {
    daten: "Elektronische Wahldaten: Wählerverzeichnis, Stimmabgabevermerke, Briefwahl, Einsprüche, Wahlvorschläge, Ergebnis",
    frist:
      "Unverzüglich, sobald die Gültigkeit oder Ungültigkeit der Wahl feststeht: frühestens am Tag nach Ende der Anfechtungsfrist (12 Arbeitstage ab Bekanntgabe des Ergebnisses), bei Anfechtung nach rechtskräftigem Abschluss des Verfahrens",
    grundlage: "§ 32 LPVGWO, § 21 Abs. 1 LPVG",
    umsetzung: "Löschtermin wird vorgeschlagen; Löschung erst nach Abschluss der Wahl, bei laufender Anfechtung gesperrt",
  },
  {
    daten: "Wahlunterlagen in Papierform: Niederschriften, Bekanntmachungen, Stimmzettel",
    frist: "Aufbewahrung durch den Personalrat mindestens bis zur Durchführung der nächsten Personalratswahl; personenbezogene Daten in Niederschriften spätestens am Ende des achten Jahres",
    grundlage: "§ 32 LPVGWO, § 67 Abs. 4 LPVG",
    umsetzung: "Organisatorisch (Personalrat)",
  },
  {
    daten: "Zurückgewiesene Wahlbriefe",
    frist: "Einen Monat nach Bekanntmachung des Wahlergebnisses vernichten, bei Anfechtung einen Monat nach rechtskräftigem Abschluss",
    grundlage: "§ 23 Abs. 7 LPVGWO",
    umsetzung: "Organisatorisch (Wahlvorstand)",
  },
  {
    daten: "Sitzungen mit IP-Adresse und Browserkennung; Bestätigungscodes",
    frist: "Mit Ablauf (Sitzung nach 8 Stunden)",
    grundlage: "Art. 5 Abs. 1 lit. c, e DSGVO",
    umsetzung: "Automatisch, stündlich",
  },
  {
    daten: "Einträge der Anmeldebremse",
    frist: "Ein Tag",
    grundlage: "Art. 5 Abs. 1 lit. c, e DSGVO",
    umsetzung: "Automatisch, stündlich",
  },
  {
    daten: "Audit-Log (ohne Inhalte, IP-Adressen pseudonymisiert)",
    frist: `${TAGE_NACH_ABSCHLUSS} Tage nach Abschluss der Wahl; nicht während einer laufenden Wahl oder Anfechtung`,
    grundlage: "Festlegung des Wahlvorstands (keine gesetzliche Vorgabe)",
    umsetzung: "Automatisch",
  },
  {
    daten: "Benutzerkonten (außer Administration)",
    frist: `${TAGE_NACH_ABSCHLUSS} Tage nach Abschluss der Wahl`,
    grundlage: "Festlegung des Wahlvorstands (keine gesetzliche Vorgabe)",
    umsetzung: "Hinweis in der Anwendung; Löschung durch die Administration",
  },
  {
    daten: "Datensicherungen",
    frist: "Spätestens mit Ablauf der Frist der gesicherten Daten",
    grundlage: "Art. 5 Abs. 1 lit. e DSGVO",
    umsetzung: "Im Sicherungskonzept festzulegen",
  },
];

/** Aufgaben, die der Wahlvorstand vor dem Einsatz erledigt. „automatisch“ = erkennt die Anwendung selbst. */
export const DATENSCHUTZ_AUFGABEN = [
  { key: "angaben", text: "Angaben zur verantwortlichen Stelle und zur/zum Datenschutzbeauftragten in der Anwendung ausfüllen", automatisch: true },
  { key: "sicherung", text: "Datensicherung einrichten (Häufigkeit, Ort, Verschlüsselung, Löschung der Sicherungen, Wiederherstellungstest)" },
  { key: "personalrat", text: "Personalrat beteiligen und Einsatz der Anwendung abstimmen" },
  { key: "dsfa", text: "Datenschutz-Folgenabschätzung mit der/dem Datenschutzbeauftragten abstimmen und freigeben" },
  { key: "hinweis", text: "Datenschutzhinweis mit dem Wahlausschreiben bekanntmachen" },
  { key: "divers", text: "Umgang mit dem Geschlechtseintrag „divers“ bei der anteiligen Vertretung (§ 8 LPVGWO) abstimmen" },
] as const satisfies readonly { key: string; text: string; automatisch?: boolean }[];

export type AufgabeKey = (typeof DATENSCHUTZ_AUFGABEN)[number]["key"];

/** Gespeicherter Stand der von Hand abgehakten Aufgaben: Schlüssel → erledigt am (ISO-Zeitstempel) */
export const aufgabenStandSchema = z.record(z.string(), z.object({ erledigtAm: z.string(), von: z.string().optional() }));
export type AufgabenStand = z.infer<typeof aufgabenStandSchema>;

/** Sind alle Pflichtangaben (ohne Vorgabe) ausgefüllt? */
export function angabenVollstaendig(a: DatenschutzAngaben): boolean {
  return DATENSCHUTZ_FELDER.every((f) => f.vorgabe || a[f.key]);
}

export interface AufgabeStatus {
  key: AufgabeKey;
  text: string;
  automatisch: boolean;
  erledigt: boolean;
  erledigtAm: string | null;
}

export function aufgabenStatus(a: DatenschutzAngaben, stand: AufgabenStand): AufgabeStatus[] {
  return DATENSCHUTZ_AUFGABEN.map((x) => {
    const automatisch = "automatisch" in x && x.automatisch === true;
    const manuell = stand[x.key];
    return {
      key: x.key,
      text: x.text,
      automatisch,
      erledigt: automatisch ? angabenVollstaendig(a) : Boolean(manuell),
      erledigtAm: automatisch ? null : (manuell?.erledigtAm ?? null),
    };
  });
}

export const DATENSCHUTZ_DOKUMENTE = {
  verzeichnis: { titel: "Verzeichnis von Verarbeitungstätigkeiten", kurz: "Verarbeitungsverzeichnis", grundlage: "Art. 30 DSGVO" },
  tom: { titel: "Technische und organisatorische Maßnahmen", kurz: "TOM", grundlage: "Art. 32 DSGVO" },
  dsfa: { titel: "Datenschutz-Folgenabschätzung", kurz: "Folgenabschätzung", grundlage: "Art. 35 DSGVO" },
  hinweis: { titel: "Datenschutzhinweis zur Wahl der Jugend- und Auszubildendenvertretung", kurz: "Datenschutzhinweis", grundlage: "Art. 13, 14 DSGVO" },
} as const;
export type DatenschutzDokument = keyof typeof DATENSCHUTZ_DOKUMENTE;
