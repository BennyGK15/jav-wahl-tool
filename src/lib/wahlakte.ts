/**
 * Wahlakte: Welche Unterlagen übergibt der Wahlvorstand nach der Wahl in Papierform an den Personalrat
 * (§ 32 LPVGWO)? Reine Funktionen ohne Abhängigkeiten zur Datenbank.
 *
 * Unterschieden wird zwischen Dokumenten, die die Anwendung erzeugt (vor dem Löschen der Daten
 * ausdrucken!), und Papieroriginalen, die nur beim Wahlvorstand liegen (Unterschriften, Stimmzettel …).
 */
import type { Verfahren } from "./fristen";
import type { Permission } from "./rbac";

/** ausdruck = aus der Anwendung drucken; original = Papier beim Wahlvorstand; beides = Ausdruck plus Originale */
export type AkteForm = "ausdruck" | "original" | "beides";

export interface AkteEintrag {
  key: string;
  titel: string;
  form: AkteForm;
  /** Was genau beizulegen ist (unterschrieben, mit Aushangvermerk …) */
  hinweis?: string;
  /** Seite in der Anwendung, relativ zur Wahl */
  pfad?: string;
  rechte?: readonly Permission[];
  /** Erwartete Zahl an Schreiben/Vorgängen, soweit aus den Daten bekannt */
  anzahl?: number;
  /** Gesetzt, wenn der Ausdruck noch nicht in endgültiger Fassung möglich ist */
  offen?: string;
}

export interface AkteAbschnitt {
  key: string;
  titel: string;
  eintraege: AkteEintrag[];
}

export interface AkteEingabe {
  verfahren: Verfahren;
  ergebnisFestgestellt: boolean;
  wahlausschreibenFreigegeben: boolean;
  nachfristBekanntgemacht: boolean;
  /** Entschiedene Einsprüche gegen das Wählerverzeichnis */
  einsprueche: number;
  einspruecheOffen: number;
  wahlvorschlaege: number;
  /** Vorschläge mit Mängelmitteilung oder Zurückweisung (ungültig/zurückgegeben) */
  vorschlaegeBeanstandet: number;
  briefwahlAntraege: number;
  /** Gewählte und Ersatzmitglieder, die benachrichtigt werden */
  gewaehlte: number;
}

const OHNE_ERGEBNIS = "Erst nach Feststellung des Ergebnisses endgültig – vorher nur Entwurf.";

export function berechneWahlakte(e: AkteEingabe): AkteAbschnitt[] {
  const versammlung = e.verfahren === "wahlversammlung";
  const abschnitte: AkteAbschnitt[] = [];

  abschnitte.push({
    key: "bestellung",
    titel: "Bestellung und Sitzungen des Wahlvorstands",
    eintraege: [
      {
        key: "bestellung",
        titel: "Beschluss über die Bestellung des Wahlvorstands",
        form: "original",
        hinweis: "Beschluss bzw. Protokollauszug des Personalrats, ggf. Bestellung der Ersatzmitglieder.",
      },
      {
        key: "wahlvorstand",
        titel: "Bekanntmachung des Wahlvorstands",
        form: "beides",
        hinweis: "Ausgehängtes Exemplar mit Vermerk „ausgehängt vom … bis …“.",
        pfad: "wahlvorstand/bekanntmachung",
        rechte: ["deadlines.read"],
      },
      {
        key: "sitzungen",
        titel: "Niederschriften der Sitzungen des Wahlvorstands",
        form: "beides",
        hinweis: "Alle Sitzungen, jeweils unterschrieben – einschließlich der konstituierenden Sitzung.",
        pfad: "sitzung",
        rechte: ["voters.edit"],
      },
    ],
  });

  const einleitung: AkteEintrag[] = [];
  if (versammlung) {
    einleitung.push({
      key: "einladung",
      titel: "Einladung zur Wahlversammlung",
      form: "beides",
      hinweis: "Unterschriebenes, ausgehängtes Exemplar mit Aushangvermerk.",
      pfad: "einladung",
      rechte: ["deadlines.read"],
    });
  } else {
    einleitung.push({
      key: "wahlausschreiben",
      titel: "Wahlausschreiben",
      form: "beides",
      hinweis: "Unterschriebenes, ausgehängtes Exemplar mit Vermerk „ausgehängt vom … bis …“.",
      pfad: "wahlausschreiben/druck",
      rechte: ["deadlines.read"],
      offen: e.wahlausschreibenFreigegeben ? undefined : "Noch nicht freigegeben.",
    });
  }
  einleitung.push({
    key: "auslage",
    titel: "Wählerverzeichnis (ausgelegte Fassung)",
    form: "ausdruck",
    hinweis: "Die Fassung, die zur Einsicht auslag, mit allen Berichtigungen.",
    pfad: "waehler/auslage",
    rechte: ["voters.edit"],
  });
  if (e.einsprueche > 0 || e.einspruecheOffen > 0) {
    einleitung.push({
      key: "einsprueche",
      titel: "Einsprüche gegen das Wählerverzeichnis mit Entscheidungen",
      form: "beides",
      hinweis: "Eingegangene Einspruchsschreiben (Original) und Kopien der Entscheidungsschreiben.",
      pfad: "einsprueche",
      rechte: ["voters.edit"],
      anzahl: e.einsprueche + e.einspruecheOffen,
      offen: e.einspruecheOffen > 0 ? `${e.einspruecheOffen} noch nicht entschieden.` : undefined,
    });
  }
  abschnitte.push({ key: "einleitung", titel: versammlung ? "Einladung und Wählerverzeichnis" : "Einleitung der Wahl", eintraege: einleitung });

  if (!versammlung || e.wahlvorschlaege > 0) {
    const vorschlaege: AkteEintrag[] = [
      {
        key: "vorschlaege",
        titel: "Wahlvorschläge im Original",
        form: "original",
        hinweis: versammlung
          ? "In der Versammlung gemachte Vorschläge, soweit schriftlich festgehalten."
          : "Mit Eingangsvermerk (Datum, Uhrzeit), Zustimmungserklärungen der Bewerber und Stützunterschriften.",
        anzahl: e.wahlvorschlaege,
      },
    ];
    if (e.vorschlaegeBeanstandet > 0) {
      vorschlaege.push({
        key: "vorschlaege_schreiben",
        titel: "Mängelmitteilungen und Zurückweisungen",
        form: "ausdruck",
        hinweis: "Kopien der versandten Schreiben, ggf. mit Zustellnachweis.",
        pfad: "vorschlaege",
        rechte: ["nominations.edit"],
        anzahl: e.vorschlaegeBeanstandet,
      });
    }
    if (e.nachfristBekanntgemacht) {
      vorschlaege.push({
        key: "nachfrist",
        titel: "Bekanntmachung der Nachfrist",
        form: "beides",
        hinweis: "Ausgehängtes Exemplar mit Aushangvermerk.",
        pfad: "vorschlaege/nachfrist",
        rechte: ["nominations.edit"],
      });
    }
    if (!versammlung) {
      vorschlaege.push({
        key: "vorschlaege_bekanntmachung",
        titel: "Bekanntmachung der Wahlvorschläge",
        form: "beides",
        hinweis: "Ausgehängtes Exemplar mit Aushangvermerk.",
        pfad: "vorschlaege/bekanntmachung",
        rechte: ["nominations.edit"],
      });
    }
    abschnitte.push({ key: "vorschlaege", titel: "Wahlvorschläge", eintraege: vorschlaege });
  }

  const wahl: AkteEintrag[] = [
    {
      key: "vermerke",
      titel: "Wählerverzeichnis mit Stimmabgabevermerken",
      form: "ausdruck",
      hinweis: "Nach Abschluss der Stimmabgabe drucken – enthält Urnen- und Briefwahl.",
      pfad: "waehler/vermerke",
      rechte: ["voters.edit"],
    },
    {
      key: "stimmzettel_muster",
      titel: "Muster des Stimmzettels",
      form: "ausdruck",
      pfad: "stimmzettel",
      rechte: ["nominations.edit", "voters.edit"],
    },
    {
      key: "stimmzettel",
      titel: "Abgegebene Stimmzettel",
      form: "original",
      hinweis: "Gültige und ungültige Stimmzettel getrennt gebündelt, verpackt und versiegelt; Paket beschriftet.",
    },
  ];
  if (e.briefwahlAntraege > 0) {
    wahl.push({
      key: "briefwahl",
      titel: "Briefwahl: Anträge und Erklärungen zur schriftlichen Stimmabgabe",
      form: "original",
      hinweis:
        "Anträge und unterschriebene Erklärungen der rechtzeitig eingegangenen Wahlbriefe. Verspätete Wahlbriefe gehören nicht in die Akte: ungeöffnet einen Monat nach Bekanntmachung des Ergebnisses vernichten (§ 23 Abs. 7 LPVGWO).",
      anzahl: e.briefwahlAntraege,
    });
  }
  abschnitte.push({ key: "wahl", titel: versammlung ? "Wahlversammlung" : "Stimmabgabe", eintraege: wahl });

  const offenOhneErgebnis = e.ergebnisFestgestellt ? undefined : OHNE_ERGEBNIS;
  abschnitte.push({
    key: "ergebnis",
    titel: "Ergebnis",
    eintraege: [
      {
        key: "niederschrift",
        titel: "Wahlniederschrift",
        form: "beides",
        hinweis: "Von allen Mitgliedern des Wahlvorstands unterschrieben; ggf. mit Protokoll zum Losentscheid.",
        pfad: "ergebnis/niederschrift",
        rechte: ["voters.edit"],
        offen: offenOhneErgebnis,
      },
      {
        key: "ergebnis_bekanntmachung",
        titel: "Bekanntmachung des Wahlergebnisses",
        form: "beides",
        hinweis: "Ausgehängtes Exemplar mit Vermerk „ausgehängt vom … bis …“.",
        pfad: "ergebnis/bekanntmachung",
        rechte: ["voters.edit"],
        offen: offenOhneErgebnis,
      },
      {
        key: "benachrichtigung",
        titel: "Benachrichtigungen der Gewählten mit Erklärungen",
        form: "beides",
        hinweis: "Kopien der Benachrichtigungen und die zurückgegebenen Erklärungen über Annahme oder Ablehnung der Wahl.",
        pfad: "ergebnis/benachrichtigung",
        rechte: ["voters.edit"],
        anzahl: e.ergebnisFestgestellt ? e.gewaehlte : undefined,
        offen: offenOhneErgebnis,
      },
    ],
  });

  return abschnitte;
}

/** Fortlaufende Nummern über alle Abschnitte (1, 2, 3 …) für das Inhaltsverzeichnis. */
export function nummeriere(abschnitte: readonly AkteAbschnitt[]): Map<string, number> {
  const nr = new Map<string, number>();
  for (const a of abschnitte) for (const x of a.eintraege) nr.set(x.key, nr.size + 1);
  return nr;
}
