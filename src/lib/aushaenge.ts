/**
 * Aushänge und Auslagen während der Wahl: Welches Dokument muss von wann bis wann in der Dienststelle
 * aushängen bzw. zur Einsicht ausliegen? Reine Funktionen ohne Abhängigkeiten zur Datenbank.
 *
 * Zeiträume, deren Ende nicht durch eine geprüfte Fristregel abgedeckt ist, sind mit `geprueft: false`
 * gekennzeichnet und in der Oberfläche als „Zeitraum prüfen“ markiert.
 */
import { addDays, type IsoDate, type Verfahren } from "./fristen";
import type { Permission } from "./rbac";

export type AushangStatus = "kommt" | "haengt" | "beendet";

export interface Aushang {
  key: string;
  titel: string;
  /** Aushang am schwarzen Brett oder Auslage zur Einsicht */
  art: "aushang" | "auslage";
  /** Beginn; null = noch nicht bestimmbar (siehe vonText) */
  von: IsoDate | null;
  /** Letzter Tag; null = noch nicht bestimmbar (siehe bisText) */
  bis: IsoDate | null;
  /** Beschreibung des Beginns, wenn noch kein Datum feststeht oder es nur „spätestens“ gilt */
  vonText: string;
  bisText: string;
  rechtsgrundlage: string;
  /** Zeitraum gegen den amtlichen Text abgeglichen */
  geprueft: boolean;
  /** Ort, an dem das Dokument aushängt bzw. ausliegt (aus den Angaben zum Wahlausschreiben) */
  ort: string | null;
  /** Seite mit dem Dokument, relativ zur Wahl */
  pfad: string;
  rechte: readonly Permission[];
  /** Zusätzlicher Hinweis (z. B. „noch nicht freigegeben“) */
  hinweis?: string;
  status: AushangStatus;
}

export interface AushangEingabe {
  verfahren: Verfahren;
  heute: IsoDate;
  wahltag: IsoDate;
  wahlvorstandBestelltAm: IsoDate | null;
  /** Tatsächlicher Erlass oder – falls noch nicht erlassen – spätester Termin laut Wahlkalender */
  wahlausschreibenAm: IsoDate | null;
  wahlausschreibenErlassen: boolean;
  wahlausschreibenFreigegeben: boolean;
  auslageBeginn: IsoDate | null;
  auslageEnde: IsoDate | null;
  bekanntmachungVorschlaege: IsoDate | null;
  nachfristBekanntgemachtAm: IsoDate | null;
  nachfristEnde: IsoDate | null;
  wvEinladung: IsoDate | null;
  /** Tag der Bekanntgabe des Wahlergebnisses (Feststellung) */
  ergebnisBekanntgabe: IsoDate | null;
  aushangErgebnisEnde: IsoDate | null;
  bekanntmachungsort: string | null;
  auslageOrt: string | null;
}

/**
 * Status am Tag `heute`. Fehlt der Beginn, entscheidet `ohneBeginn`, ob das Dokument schon hängt
 * (z. B. Wahlvorstand) oder erst später kommt (z. B. Wahlergebnis).
 */
export function aushangStatus(heute: IsoDate, von: IsoDate | null, bis: IsoDate | null, ohneBeginn: "haengt" | "kommt"): AushangStatus {
  if (bis && heute > bis) return "beendet";
  if (von) return heute < von ? "kommt" : "haengt";
  return ohneBeginn;
}

export function berechneAushaenge(e: AushangEingabe): Aushang[] {
  const { heute, wahltag } = e;
  const versammlung = e.verfahren === "wahlversammlung";
  const stimmabgabe = versammlung ? "Ende der Wahlversammlung" : "Abschluss der Stimmabgabe";
  const liste: Omit<Aushang, "status">[] = [];
  const status = new Map<string, "haengt" | "kommt">();

  // Wahlvorstand – § 1 Abs. 3 LPVGWO: unverzüglich nach der Bestimmung bis zur Bekanntmachung des Wahlergebnisses
  liste.push({
    key: "wahlvorstand",
    titel: "Bekanntmachung des Wahlvorstands",
    art: "aushang",
    von: e.wahlvorstandBestelltAm,
    bis: e.ergebnisBekanntgabe,
    vonText: e.wahlvorstandBestelltAm ? "ab der Bestimmung (unverzüglich)" : "unverzüglich nach der Bestimmung",
    bisText: "bis zur Bekanntmachung des Wahlergebnisses",
    rechtsgrundlage: "§ 1 Abs. 3 LPVGWO",
    geprueft: true,
    ort: e.bekanntmachungsort,
    pfad: "wahlvorstand/bekanntmachung",
    rechte: ["deadlines.read"],
  });
  status.set("wahlvorstand", "haengt");

  if (versammlung) {
    // Einladung zur Wahlversammlung – § 62 Abs. 2 Satz 2 LPVG: spätestens vier Wochen vor Ende der Amtszeit
    liste.push({
      key: "einladung",
      titel: "Einladung zur Wahlversammlung",
      art: "aushang",
      von: e.wvEinladung,
      bis: wahltag,
      vonText: "spätestens vier Wochen vor Ende der Amtszeit",
      bisText: "bis zur Wahlversammlung",
      rechtsgrundlage: "§ 62 Abs. 2 Satz 2 LPVG",
      geprueft: false,
      ort: e.bekanntmachungsort,
      pfad: "einladung",
      rechte: ["deadlines.read"],
    });
    status.set("einladung", "kommt");
  } else {
    // Wahlausschreiben – vom Erlass bis zum Abschluss der Stimmabgabe
    liste.push({
      key: "wahlausschreiben",
      titel: "Wahlausschreiben",
      art: "aushang",
      von: e.wahlausschreibenAm,
      bis: wahltag,
      vonText: e.wahlausschreibenErlassen ? "ab dem Erlass" : "ab dem Erlass (spätestens)",
      bisText: `bis zum ${stimmabgabe}`,
      rechtsgrundlage: "§ 9 LPVGWO",
      geprueft: false,
      ort: e.bekanntmachungsort,
      pfad: "wahlausschreiben/druck",
      rechte: ["deadlines.read"],
      hinweis: e.wahlausschreibenFreigegeben ? undefined : "Noch nicht freigegeben – erst nach Freigabe und Unterschrift aushängen.",
    });
    status.set("wahlausschreiben", "kommt");

    // Wählerverzeichnis – § 6 Abs. 4 LPVGWO (Zeitraum aus dem Wahlkalender)
    liste.push({
      key: "waehlerverzeichnis",
      titel: "Wählerverzeichnis (Auslagefassung)",
      art: "auslage",
      von: e.auslageBeginn,
      bis: e.auslageEnde,
      vonText: "spätestens 12 Arbeitstage vor dem Wahltag",
      bisText: "bis zum Ende der Einspruchsfrist",
      rechtsgrundlage: "§ 6 Abs. 4 LPVGWO",
      geprueft: true,
      ort: e.auslageOrt,
      pfad: "waehler/auslage",
      rechte: ["voters.edit"],
      hinweis: "Ohne Geburtsdaten auslegen; Einsicht zu den im Wahlausschreiben genannten Zeiten.",
    });
    status.set("waehlerverzeichnis", "kommt");

    // LPVG und Wahlordnung – laut Wahlausschreiben beim Wahlvorstand zur Einsicht
    liste.push({
      key: "gesetzestexte",
      titel: "LPVG und Wahlordnung (LPVGWO)",
      art: "auslage",
      von: e.wahlausschreibenAm,
      bis: wahltag,
      vonText: "ab dem Erlass des Wahlausschreibens",
      bisText: `bis zum ${stimmabgabe}`,
      rechtsgrundlage: "Hinweis im Wahlausschreiben",
      geprueft: false,
      ort: e.auslageOrt,
      pfad: "wahlausschreiben",
      rechte: ["deadlines.read"],
      hinweis: "Aktuelle Fassung von landesrecht-bw.de ausdrucken.",
    });
    status.set("gesetzestexte", "kommt");

    // Nachfrist – § 16 LPVGWO, nur wenn sie bekanntgemacht wurde
    if (e.nachfristBekanntgemachtAm) {
      liste.push({
        key: "nachfrist",
        titel: "Bekanntmachung der Nachfrist",
        art: "aushang",
        von: e.nachfristBekanntgemachtAm,
        bis: e.nachfristEnde,
        vonText: "ab der Bekanntmachung",
        bisText: "bis zum Ende der Nachfrist",
        rechtsgrundlage: "§ 16 Abs. 1 LPVGWO",
        geprueft: false,
        ort: e.bekanntmachungsort,
        pfad: "vorschlaege/nachfrist",
        rechte: ["nominations.edit"],
      });
      status.set("nachfrist", "kommt");
    }

    // Zugelassene Wahlvorschläge – § 18 Abs. 1 LPVGWO: spätestens 5 Arbeitstage vor dem Wahltag
    liste.push({
      key: "wahlvorschlaege",
      titel: "Bekanntmachung der Wahlvorschläge",
      art: "aushang",
      von: e.bekanntmachungVorschlaege,
      bis: wahltag,
      vonText: "spätestens 5 Arbeitstage vor dem Wahltag",
      bisText: `bis zum ${stimmabgabe}`,
      rechtsgrundlage: "§ 18 Abs. 1 LPVGWO",
      geprueft: false,
      ort: e.bekanntmachungsort,
      pfad: "vorschlaege/bekanntmachung",
      rechte: ["nominations.edit"],
      hinweis: "Ohne Namen der Unterzeichnenden (§ 18 Abs. 1 Satz 6 LPVGWO).",
    });
    status.set("wahlvorschlaege", "kommt");
  }

  // Wahlergebnis – § 31 Abs. 2 LPVGWO: zwei Wochen ab Bekanntgabe
  liste.push({
    key: "ergebnis",
    titel: "Bekanntmachung des Wahlergebnisses",
    art: "aushang",
    von: e.ergebnisBekanntgabe,
    bis: e.aushangErgebnisEnde ?? (e.ergebnisBekanntgabe ? addDays(e.ergebnisBekanntgabe, 14) : null),
    vonText: "ab der Feststellung des Ergebnisses",
    bisText: "zwei Wochen lang",
    rechtsgrundlage: "§ 31 Abs. 2 LPVGWO",
    geprueft: true,
    ort: e.bekanntmachungsort,
    pfad: "ergebnis/bekanntmachung",
    rechte: ["voters.edit"],
  });
  status.set("ergebnis", "kommt");

  return liste.map((a) => ({ ...a, status: aushangStatus(heute, a.von, a.bis, status.get(a.key) ?? "kommt") }));
}

/** Zeitraum für die Zeitleiste: vom frühesten Beginn bis zum spätesten Ende (mindestens heute und Wahltag). */
export function zeitleistenBereich(aushaenge: readonly Aushang[], heute: IsoDate, wahltag: IsoDate): { von: IsoDate; bis: IsoDate } {
  const daten = [heute, wahltag, ...aushaenge.flatMap((a) => [a.von, a.bis]).filter((d): d is IsoDate => Boolean(d))].sort();
  return { von: daten[0]!, bis: daten[daten.length - 1]! };
}
