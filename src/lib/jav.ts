/**
 * Fachregeln aus dem LPVG BW. Reine Funktionen ohne Abhängigkeiten.
 * Abgeglichen mit dem amtlichen Text des LPVG (siehe RECHTSSTAND in ./fristen).
 */

import { regelWahlzeitraum } from "./fristen";

export type IsoDate = string;

/** Vollendete Lebensjahre an einem Stichtag. */
export function ageOn(birthDate: IsoDate, day: IsoDate): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export interface EligibilityInput {
  birthDate: IsoDate;
  inTraining: boolean;
  electionDay: IsoDate;
}

export interface Eligibility {
  /** § 60 Abs. 1 LPVG BW: unter 18 oder in beruflicher Ausbildung */
  wahlberechtigt: boolean;
  /** § 60 Abs. 2 LPVG BW: unter 26 oder in beruflicher Ausbildung */
  waehlbar: boolean;
  age: number;
}

export function eligibility({
  birthDate,
  inTraining,
  electionDay,
}: EligibilityInput): Eligibility {
  const age = ageOn(birthDate, electionDay);
  return {
    wahlberechtigt: inTraining || age < 18,
    waehlbar: inTraining || age < 26,
    age,
  };
}

/** § 61 LPVG BW: Anzahl der JAV-Mitglieder nach Zahl der Wahlberechtigten. 0 = keine JAV. */
export function javSize(wahlberechtigte: number): 0 | 1 | 3 | 5 | 7 {
  if (wahlberechtigte < 5) return 0;
  if (wahlberechtigte <= 20) return 1;
  if (wahlberechtigte <= 50) return 3;
  if (wahlberechtigte <= 200) return 5;
  return 7;
}

/** § 62 Abs. 2 LPVG BW: Wahlversammlung möglich bei höchstens 20 Wahlberechtigten. */
export function wahlversammlungZulaessig(wahlberechtigte: number): boolean {
  return wahlberechtigte >= 5 && wahlberechtigte <= 20;
}

/**
 * § 62 Abs. 3 LPVG BW: regelmäßige JAV-Wahlen im Wechsel zusammen mit den Personalratswahlen
 * (1.4.–31.7. eines Personalratswahljahres) und sonst vom 1.10. bis 31.1. Siehe regelWahlzeitraum.
 */
export function imRegelWahlzeitraum(iso: IsoDate): boolean {
  return regelWahlzeitraum(iso) !== null;
}

export interface Verfahrensauskunft {
  javMoeglich: boolean;
  mitglieder: 0 | 1 | 3 | 5 | 7;
  wahlversammlungMoeglich: boolean;
}

/** Was folgt aus der Zahl der Wahlberechtigten für Größe und Verfahren? */
export function verfahrensauskunft(
  wahlberechtigte: number,
): Verfahrensauskunft {
  return {
    javMoeglich: wahlberechtigte >= 5,
    mitglieder: javSize(wahlberechtigte),
    wahlversammlungMoeglich: wahlversammlungZulaessig(wahlberechtigte),
  };
}

/**
 * In Ausbildung am Stichtag: Ausbildungsverhältnis besteht und endet nicht vor dem Stichtag.
 * (Ausbildungsende = letzter Tag der Ausbildung.)
 */
export function inAusbildungAm(
  inAusbildung: boolean,
  ausbildungsende: IsoDate | null | undefined,
  day: IsoDate,
): boolean {
  if (!inAusbildung) return false;
  return !ausbildungsende || ausbildungsende >= day;
}

/**
 * Hinweise, wenn die tatsächliche Zahl (Wählerverzeichnis) andere Folgen hat als die Schätzung
 * beim Anlegen der Wahl. Leeres Array = keine Abweichung mit Folgen.
 */
export function schwellenHinweise(
  schaetzung: number,
  tatsaechlich: number,
  verfahren: "regulaer" | "wahlversammlung",
): string[] {
  const vorher = verfahrensauskunft(schaetzung);
  const jetzt = verfahrensauskunft(tatsaechlich);
  const hinweise: string[] = [];
  if (!jetzt.javMoeglich) {
    hinweise.push(
      `Laut Verzeichnis gibt es nur ${tatsaechlich} Wahlberechtigte – unter 5 wird keine JAV gebildet (§ 59 LPVG BW).`,
    );
    return hinweise;
  }
  if (vorher.mitglieder !== jetzt.mitglieder) {
    hinweise.push(
      `Die JAV-Größe ändert sich: ${tatsaechlich} statt geschätzt ${schaetzung} Wahlberechtigte ergeben ${jetzt.mitglieder} statt ${vorher.mitglieder} Mitglieder (§ 61 LPVG BW).`,
    );
  }
  if (verfahren === "wahlversammlung" && !jetzt.wahlversammlungMoeglich) {
    hinweise.push(
      `Mit ${tatsaechlich} Wahlberechtigten ist keine Wahlversammlung mehr zulässig (höchstens 20, § 62 Abs. 2 LPVG BW).`,
    );
  }
  return hinweise;
}

/**
 * Mindestzahl der Stützunterschriften für Wahlvorschläge der Beschäftigten bei der JAV-Wahl.
 *
 * § 62 Abs. 1 LPVG BW verweist u. a. auf § 13 Abs. 6: Bei gemeinsamer Wahl muss jeder Wahlvorschlag der
 * Beschäftigten von mindestens einem Zwanzigstel der Wahlberechtigten unterzeichnet sein; nach § 13 Abs. 4
 * Satz 3 (entsprechend) genügen in jedem Fall 50. „Mindestens ein Zwanzigstel“ → aufrunden.
 * (Fassung vom 12.03.2015, Stand der geprüften Gesamtausgabe 2020 – vor Verwendung gegen die aktuelle Fassung prüfen.)
 */
export const STUETZ_RECHTSGRUNDLAGE =
  "§ 62 Abs. 1 i. V. m. § 13 Abs. 6 und Abs. 4 Satz 3 LPVG BW";

export function mindestStuetzunterschriften(wahlberechtigte: number): number {
  if (!Number.isFinite(wahlberechtigte) || wahlberechtigte <= 0) return 0;
  return Math.min(50, Math.ceil(wahlberechtigte / 20));
}
