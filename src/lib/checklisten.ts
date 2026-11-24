/** Standard-Checklisten aus der Arbeitsunterlage für den Wahlvorstand (reguläres Verfahren). */

export type Phase = "vorbereitung" | "wahltag" | "abschluss";

export const PHASEN: Record<Phase, { titel: string; beschreibung: string }> = {
  vorbereitung: {
    titel: "Vorbereitung",
    beschreibung:
      "Bestellung, Wählerverzeichnis, Wahlausschreiben, Wahlvorschläge",
  },
  wahltag: {
    titel: "Wahltag",
    beschreibung: "Wahlraum, Stimmabgabe, Auszählung",
  },
  abschluss: {
    titel: "Abschluss",
    beschreibung: "Bekanntmachung, Benachrichtigung, Aufbewahrung",
  },
};

export const STANDARD_CHECKLISTE: Record<Phase, readonly string[]> = {
  vorbereitung: [
    "Beschluss des Personalrats über die Bestellung des Wahlvorstands liegt vor",
    "Vorsitz und Stellvertretung sind bestimmt",
    "Mindestens ein Mitglied ist nach § 9 LPVG BW in den Personalrat wählbar",
    "Erste Sitzung durchgeführt, Geschäftsverteilung festgelegt, Niederschrift erstellt",
    "Beschäftigtendaten bei Dienststellenleitung / Personalstelle angefordert",
    "Wählerverzeichnis erstellt (unter 18-Jährige und alle Auszubildenden, Außenstellen berücksichtigt)",
    "Zahl der JAV-Mitglieder nach § 61 LPVG BW festgestellt",
    "Fristen berechnet und Fristregeln gegen die LPVGWO geprüft",
    "Wahlausschreiben erlassen, unterschrieben und ausgehängt",
    "LPVG und Wahlordnung zur Einsicht ausgelegt",
    "Wählerverzeichnis ausgelegt (ohne Geburtsdatum), Einsprüche entschieden",
    "Wahlvorschläge mit Datum und Uhrzeit entgegengenommen und geprüft",
    "Gültige Wahlvorschläge bekannt gemacht",
    "Stimmzettel, Umschläge, Wahlurne und Wahlkabine vorbereitet",
    "Briefwahlunterlagen versandt",
    "Wahlhelferinnen und Wahlhelfer eingeteilt und eingewiesen",
  ],
  wahltag: [
    "Wahlraum eingerichtet, Wahlgeheimnis gewährleistet",
    "Wahlurne vor Beginn leer vorgezeigt und verschlossen",
    "Wählerverzeichnis für die Stimmabgabe bereitgestellt",
    "Wahlberechtigung geprüft und Stimmabgabe vermerkt",
    "Wahlbriefe vor Abschluss der Wahl in die Urne gegeben",
    "Unregelmäßigkeiten dokumentiert",
    "Öffentliche Stimmenauszählung durchgeführt",
    "Wahlergebnis festgestellt und Wahlniederschrift unterschrieben",
  ],
  abschluss: [
    "Wahlergebnis bekannt gemacht",
    "Gewählte schriftlich benachrichtigt, Annahme bzw. Ablehnung erfasst",
    "Einladung zur konstituierenden Sitzung versandt",
    "Wahlunterlagen vollständig zusammengestellt und sicher aufbewahrt",
    "Aufbewahrungsfrist festgelegt (mit Datenschutzbeauftragter/-m abgestimmt)",
  ],
};
