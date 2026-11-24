/**
 * Wann ein Schritt im Wahlkalender automatisch als erledigt gilt. Reine Funktionen.
 * Grundsatz: Nur was die App sicher erkennen kann (Freigaben, Entscheidungen, abgelaufene Fristen).
 * Tätigkeiten außerhalb der App (aushängen, einladen) bleiben zum Abhaken von Hand.
 */

/** Kennung in Deadline.erledigtVon für automatisch gesetzte Haken. */
export const AUTO_ERLEDIGT = "system:auto";

export interface AutoStand {
  /** Jetzt als Berliner Ortszeit "YYYY-MM-DD HH:MM" */
  jetzt: string;
  /** Fristende je Termin als "YYYY-MM-DD HH:MM" (ohne Uhrzeit: 23:59) */
  fristende: Record<string, string>;
  wahlausschreibenFreigegeben: boolean;
  /** Wahlvorschläge im Status „eingegangen“ (noch nicht geprüft) */
  ungepruefteVorschlaege: number;
  /** Einsprüche ohne Entscheidung */
  offeneEinsprueche: number;
  /** Zuletzt erzeugte Bekanntmachung der Wahlvorschläge ("YYYY-MM-DD HH:MM") */
  vorschlaegeBekanntmachungAm: string | null;
  /** Auslagefassung des Wählerverzeichnisses wurde erzeugt */
  auslageErzeugt: boolean;
}

/** Fristenden: erledigt, sobald die Frist abgelaufen ist. */
const FRISTENDEN = [
  "wahlvorschlaege_ende",
  "berichtigung_ende",
  "nachfrist_ende",
  "auslage_ende",
  "aushang_ergebnis_ende",
  "anfechtung_ende",
];

/** Wann der Haken automatisch gesetzt wird – für Hinweise in der Oberfläche. */
export const AUTO_HINWEIS: Record<string, string> = {
  stichtag_feststellung: "sobald das Wahlausschreiben freigegeben ist",
  wahlausschreiben: "sobald das Wahlausschreiben freigegeben ist",
  auslage_beginn:
    "sobald die Auslagefassung erzeugt und der Termin erreicht ist",
  maengel_mitteilung:
    "sobald die Einreichungsfrist abgelaufen und jeder Wahlvorschlag geprüft ist",
  bekanntmachung_vorschlaege:
    "sobald nach Ablauf der Fristen die Bekanntmachung erzeugt ist",
  einspruch_entscheidung:
    "sobald die Auslage beendet und über jeden Einspruch entschieden ist",
  ...Object.fromEntries(
    FRISTENDEN.map((k) => [k, "sobald die Frist abgelaufen ist"]),
  ),
};

function abgelaufen(s: AutoStand, key: string): boolean {
  const ende = s.fristende[key];
  return Boolean(ende && s.jetzt > ende);
}

/**
 * true = erledigt, false = (noch) nicht erledigt, undefined = nicht automatisch erkennbar (nur von Hand).
 */
export function autoErledigt(key: string, s: AutoStand): boolean | undefined {
  if (FRISTENDEN.includes(key)) return abgelaufen(s, key);
  switch (key) {
    case "stichtag_feststellung":
    case "wahlausschreiben":
      return s.wahlausschreibenFreigegeben;
    case "auslage_beginn": {
      const termin = s.fristende.auslage_beginn?.slice(0, 10);
      return (
        s.auslageErzeugt && Boolean(termin && s.jetzt.slice(0, 10) >= termin)
      );
    }
    case "maengel_mitteilung":
      return (
        abgelaufen(s, "wahlvorschlaege_ende") && s.ungepruefteVorschlaege === 0
      );
    case "einspruch_entscheidung":
      return abgelaufen(s, "auslage_ende") && s.offeneEinsprueche === 0;
    case "bekanntmachung_vorschlaege": {
      // Bekanntmachung zählt erst, wenn sie nach der letzten Vorschlagsfrist erzeugt wurde
      const letzte =
        s.fristende.nachfrist_ende ??
        s.fristende.berichtigung_ende ??
        s.fristende.wahlvorschlaege_ende;
      return Boolean(
        s.vorschlaegeBekanntmachungAm &&
        (!letzte || s.vorschlaegeBekanntmachungAm > letzte) &&
        s.ungepruefteVorschlaege === 0,
      );
    }
    default:
      return undefined;
  }
}
