/**
 * Einrichtungsassistent einer neuen Wahl: Welche Angaben vor dem Start vorliegen müssen,
 * damit der weitere Ablauf ohne Verzögerung läuft. Reine Funktionen.
 */
import type { Verfahren } from "./fristen";
import type { Angaben } from "./wahlausschreiben";

export type SchrittKey =
  | "grunddaten"
  | "wahlvorstand"
  | "orte"
  | "unterschriften"
  | "datenschutz"
  | "abschluss";

export interface OrtFeld {
  key: keyof Angaben;
  label: string;
  typ: "text" | "zeit" | "lang";
  hinweis?: string;
  pflicht: boolean;
}

const REGULAER: OrtFeld[] = [
  {
    key: "ausstellungsort",
    label: "Ausstellungsort",
    typ: "text",
    hinweis:
      "Ort für Datum und Unterschrift auf allen Dokumenten, z. B. „Musterstadt“",
    pflicht: true,
  },
  {
    key: "dienstschluss",
    label: "Dienstschluss der Mehrheit der Wahlberechtigten",
    typ: "zeit",
    hinweis:
      "Fristen enden nicht vor dieser Uhrzeit (§ 55 Abs. 2 LPVGWO); wird für alle Fristenden übernommen",
    pflicht: true,
  },
  {
    key: "einreichungsstelle",
    label: "Stelle für Wahlvorschläge und Einsprüche",
    typ: "text",
    hinweis:
      "Raum und Erreichbarkeit des Wahlvorstands, z. B. „Raum 2.14, Mo–Fr 8–15 Uhr“",
    pflicht: true,
  },
  {
    key: "bekanntmachungsort",
    label: "Ort der Bekanntmachungen",
    typ: "text",
    hinweis:
      "Aushang, zusätzlich elektronisch (§ 2 LPVGWO), z. B. „Schwarzes Brett Foyer und Intranet“",
    pflicht: true,
  },
  {
    key: "auslageOrt",
    label: "Ort der Auslage des Wählerverzeichnisses",
    typ: "text",
    pflicht: true,
  },
  {
    key: "auslageZeiten",
    label: "Zeiten der Einsichtnahme",
    typ: "text",
    hinweis: "Während der Dienststunden (§ 6 Abs. 4 LPVGWO)",
    pflicht: true,
  },
  { key: "wahlraum", label: "Wahlraum", typ: "text", pflicht: true },
  { key: "wahlzeitVon", label: "Wahlzeit von", typ: "zeit", pflicht: true },
  { key: "wahlzeitBis", label: "Wahlzeit bis", typ: "zeit", pflicht: true },
  {
    key: "auszaehlungZeit",
    label: "Beginn der Auszählung",
    typ: "zeit",
    hinweis:
      "Die Sitzung ist für die Beschäftigten öffentlich (§ 26 Abs. 6 LPVGWO)",
    pflicht: true,
  },
  {
    key: "auszaehlungOrt",
    label: "Ort der Auszählung",
    typ: "text",
    pflicht: true,
  },
  {
    key: "briefwahlHinweis",
    label: "Hinweis zur Briefwahl (optional)",
    typ: "lang",
    hinweis: "Erscheint im Wahlausschreiben",
    pflicht: false,
  },
];

const WAHLVERSAMMLUNG: OrtFeld[] = [
  {
    key: "ausstellungsort",
    label: "Ausstellungsort",
    typ: "text",
    hinweis: "Ort für Datum und Unterschrift auf allen Dokumenten",
    pflicht: true,
  },
  {
    key: "wahlraum",
    label: "Ort der Wahlversammlung",
    typ: "text",
    pflicht: true,
  },
  {
    key: "wahlzeitVon",
    label: "Beginn der Wahlversammlung",
    typ: "zeit",
    pflicht: true,
  },
  {
    key: "bekanntmachungsort",
    label: "Ort der Bekanntmachungen",
    typ: "text",
    hinweis: "Aushang, zusätzlich elektronisch (§ 2 LPVGWO)",
    pflicht: true,
  },
  {
    key: "einreichungsstelle",
    label: "Erreichbarkeit des Wahlvorstands",
    typ: "text",
    pflicht: true,
  },
];

export function ortFelder(verfahren: Verfahren): OrtFeld[] {
  return verfahren === "wahlversammlung" ? WAHLVERSAMMLUNG : REGULAER;
}

export interface EinrichtungStand {
  verfahren: Verfahren;
  angaben: Angaben;
  stuetzunterschriftenMin: number | null;
  datenschutzVollstaendig: boolean;
}

export interface SchrittStatus {
  key: SchrittKey;
  titel: string;
  kurz: string;
  erledigt: boolean;
  /** Was noch fehlt – für die Anzeige */
  fehlt: string[];
}

export function einrichtungsSchritte(s: EinrichtungStand): SchrittStatus[] {
  const vorstand = s.angaben.wahlvorstand ?? [];
  const vorstandFehlt = [
    ...(vorstand.some((m) => m.funktion === "vorsitz") ? [] : ["Vorsitz"]),
    ...(vorstand.length >= 3 ? [] : ["mindestens drei Mitglieder"]),
    ...(vorstand.some((m) => m.prWaehlbar)
      ? []
      : [
          "ein in den Personalrat wählbares Mitglied (§ 54 Abs. 1 Nr. 3 LPVGWO)",
        ]),
  ];
  const orteFehlt = ortFelder(s.verfahren)
    .filter((f) => f.pflicht && !s.angaben[f.key])
    .map((f) => f.label);
  const schritte: SchrittStatus[] = [
    {
      key: "grunddaten",
      titel: "Grunddaten",
      kurz: "Dienststelle, Wahlberechtigte, Termine",
      erledigt: true,
      fehlt: [],
    },
    {
      key: "wahlvorstand",
      titel: "Wahlvorstand",
      kurz: "Mitglieder und Ersatzmitglieder",
      erledigt: vorstandFehlt.length === 0,
      fehlt: vorstandFehlt,
    },
    {
      key: "orte",
      titel: "Orte und Zeiten",
      kurz: "Angaben für Wahlausschreiben und Fristen",
      erledigt: orteFehlt.length === 0,
      fehlt: orteFehlt,
    },
  ];
  if (s.verfahren === "regulaer") {
    schritte.push({
      key: "unterschriften",
      titel: "Stützunterschriften",
      kurz: "Mindestzahl für Wahlvorschläge",
      erledigt: s.stuetzunterschriftenMin != null,
      fehlt: s.stuetzunterschriftenMin != null ? [] : ["Mindestzahl"],
    });
  }
  schritte.push(
    {
      key: "datenschutz",
      titel: "Datenschutz",
      kurz: "Verantwortliche Stelle und Datenschutzbeauftragte/r",
      erledigt: s.datenschutzVollstaendig,
      fehlt: s.datenschutzVollstaendig
        ? []
        : ["Angaben zur verantwortlichen Stelle"],
    },
    {
      key: "abschluss",
      titel: "Abschluss",
      kurz: "Prüfen und Wahlkalender freischalten",
      erledigt: false,
      fehlt: [],
    },
  );
  return schritte;
}

/** Alle Schritte vor dem Abschluss erledigt? */
export function bereitZumAbschluss(schritte: SchrittStatus[]): boolean {
  return schritte.filter((x) => x.key !== "abschluss").every((x) => x.erledigt);
}
