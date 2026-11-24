/**
 * Prüfprotokoll für Wahlvorschläge. Reine Funktionen ohne Abhängigkeiten.
 * Das Ergebnis ist eine Arbeitshilfe – die Entscheidung über die Gültigkeit trifft der Wahlvorstand.
 */

import { pruefeGeschlechter } from "./geschlechter";

export type PruefStatus = "ok" | "fehler" | "hinweis";

export interface Pruefpunkt {
  status: PruefStatus;
  text: string;
}

export interface PruefPerson {
  name: string;
  /** Auf wie vielen ANDEREN Wahlvorschlägen derselben Wahl die Person steht bzw. unterschrieben hat */
  aufAnderenVorschlaegen: number;
}

export interface PruefInput {
  einreicherArt: "beschaeftigte" | "gewerkschaft";
  gewerkschaft: string | null;
  /** Eingang in Berliner Ortszeit, "YYYY-MM-DD HH:MM" */
  eingang: string;
  /** Fristende in Berliner Ortszeit, "YYYY-MM-DD HH:MM"; null = nicht berechnet */
  fristende: string | null;
  bewerber: (PruefPerson & { waehlbar: boolean; zustimmung: boolean; geschlecht?: "w" | "m" | "d" | null })[];
  unterstuetzer: (PruefPerson & { wahlberechtigt: boolean })[];
  /** Vom Wahlvorstand festgelegte Mindestzahl; null = noch nicht festgelegt */
  mindestUnterschriften: number | null;
  /** Sitze für Frauen und Männer (ab 3 Mitgliedern, § 8 LPVGWO); undefined = nicht relevant, null = noch nicht ermittelt */
  geschlechterSitze?: { sitzeFrauen: number; sitzeMaenner: number } | null;
  /** Schriftliche Begründung für eine Abweichung (§ 12 Abs. 2 Satz 2 LPVGWO) */
  geschlechterBegruendung?: string | null;
}

const namen = (list: { name: string }[]) => list.map((p) => p.name).join(", ");

export function pruefeWahlvorschlag(i: PruefInput): Pruefpunkt[] {
  const p: Pruefpunkt[] = [];

  // Frist
  if (!i.fristende) {
    p.push({ status: "hinweis", text: "Fristende für Wahlvorschläge ist nicht berechnet – Rechtzeitigkeit manuell prüfen." });
  } else if (i.eingang <= i.fristende) {
    p.push({ status: "ok", text: `Rechtzeitig eingegangen (Fristende ${i.fristende} Uhr).` });
  } else {
    p.push({ status: "fehler", text: `Verspätet: Eingang ${i.eingang} Uhr, Fristende ${i.fristende} Uhr.` });
  }

  // Bewerberinnen und Bewerber
  if (i.bewerber.length === 0) {
    p.push({ status: "fehler", text: "Der Wahlvorschlag enthält keine Bewerberinnen oder Bewerber." });
  } else {
    const nichtWaehlbar = i.bewerber.filter((b) => !b.waehlbar);
    p.push(
      nichtWaehlbar.length
        ? { status: "fehler", text: `Nicht wählbar (§ 60 Abs. 2 LPVG BW): ${namen(nichtWaehlbar)}.` }
        : { status: "ok", text: `Alle ${i.bewerber.length} Bewerberinnen und Bewerber sind wählbar.` },
    );
    const ohneZustimmung = i.bewerber.filter((b) => !b.zustimmung);
    p.push(
      ohneZustimmung.length
        ? { status: "fehler", text: `Schriftliche Zustimmung fehlt: ${namen(ohneZustimmung)}.` }
        : { status: "ok", text: "Schriftliche Zustimmungen liegen vollständig vor." },
    );
    if (i.geschlechterSitze === null) {
      p.push({ status: "hinweis", text: "Die Sitze für Frauen und Männer (§ 8 LPVGWO) stehen noch nicht fest – siehe Seite Wahlausschreiben." });
    } else if (i.geschlechterSitze) {
      p.push(
        pruefeGeschlechter({
          verteilung: i.geschlechterSitze,
          bewerber: i.bewerber.map((b) => ({ geschlecht: b.geschlecht ?? null })),
          begruendung: i.geschlechterBegruendung ?? null,
        }),
      );
    }
    const mehrfach = i.bewerber.filter((b) => b.aufAnderenVorschlaegen > 0);
    if (mehrfach.length) {
      p.push({
        status: "hinweis",
        text: `Auch auf anderen Wahlvorschlägen benannt: ${namen(mehrfach)}. Die Person muss erklären, auf welchem Vorschlag sie bleibt.`,
      });
    }
  }

  // Einreicher
  if (i.einreicherArt === "gewerkschaft") {
    p.push(
      i.gewerkschaft?.trim()
        ? { status: "ok", text: `Eingereicht von der Gewerkschaft ${i.gewerkschaft.trim()}.` }
        : { status: "fehler", text: "Name der einreichenden Gewerkschaft fehlt." },
    );
    return p;
  }

  // Stützunterschriften (nur Vorschläge der Beschäftigten)
  const nichtBerechtigt = i.unterstuetzer.filter((u) => !u.wahlberechtigt);
  if (nichtBerechtigt.length) {
    p.push({ status: "fehler", text: `Unterschriften von nicht Wahlberechtigten zählen nicht: ${namen(nichtBerechtigt)}.` });
  }
  const doppelt = i.unterstuetzer.filter((u) => u.wahlberechtigt && u.aufAnderenVorschlaegen > 0);
  if (doppelt.length) {
    p.push({
      status: "hinweis",
      text: `Haben auch einen anderen Wahlvorschlag unterzeichnet: ${namen(doppelt)}. Jede wahlberechtigte Person darf nur einen Vorschlag unterzeichnen.`,
    });
  }
  const gueltig = i.unterstuetzer.filter((u) => u.wahlberechtigt).length;
  if (i.mindestUnterschriften == null) {
    p.push({
      status: "hinweis",
      text: `${gueltig} gültige Stützunterschriften. Die Mindestzahl ist noch nicht festgelegt.`,
    });
  } else if (gueltig >= i.mindestUnterschriften) {
    p.push({ status: "ok", text: `${gueltig} gültige Stützunterschriften (mindestens ${i.mindestUnterschriften}).` });
  } else {
    p.push({
      status: "fehler",
      text: `Nur ${gueltig} gültige Stützunterschriften, erforderlich sind mindestens ${i.mindestUnterschriften}.`,
    });
  }
  return p;
}

export function hatFehler(punkte: Pruefpunkt[]): boolean {
  return punkte.some((x) => x.status === "fehler");
}

/** Einspruch rechtzeitig? Beide Werte als Berliner Ortszeit "YYYY-MM-DD HH:MM". */
export function einspruchRechtzeitig(eingang: string, fristende: string | null): boolean | null {
  if (!fristende) return null;
  return eingang <= fristende;
}

/** Fristende aus Datum + optionaler Uhrzeit; ohne Uhrzeit gilt das Ende des Tages. */
export function fristendeAus(datumIso: string, uhrzeit: string | null | undefined): string {
  return `${datumIso} ${uhrzeit || "23:59"}`;
}
