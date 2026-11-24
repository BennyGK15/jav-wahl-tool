/**
 * Löschung nach § 32 LPVGWO: Elektronisch gespeicherte Daten und Wahlunterlagen sind unverzüglich zu löschen,
 * sobald die Gültigkeit oder Ungültigkeit der Wahl feststeht – also nach Ablauf der Anfechtungsfrist
 * (§ 21 Abs. 1 LPVG: 12 Arbeitstage ab Bekanntgabe des Ergebnisses) oder nach Abschluss eines Anfechtungsverfahrens.
 * Reine Funktionen.
 */
import { addDays, type IsoDate } from "./fristen";

export interface LoeschStand {
  /** Letzter Tag der Anfechtungsfrist; null, solange das Ergebnis nicht festgestellt ist */
  anfechtungsfristEnde: IsoDate | null;
  /** Tag, an dem der Wahlvorstand von einer Anfechtung erfahren hat */
  anfechtungAm: IsoDate | null;
  /** Tag des rechtskräftigen Abschlusses des Anfechtungsverfahrens */
  anfechtungErledigtAm: IsoDate | null;
}

export interface LoeschVorschlag {
  /** Frühester Löschtermin; null = noch nicht bestimmbar */
  fruehestens: IsoDate | null;
  /** Löschung gesperrt (laufende Anfechtung) */
  gesperrt: boolean;
  grund: string;
}

export function loeschVorschlag(s: LoeschStand): LoeschVorschlag {
  if (s.anfechtungAm && !s.anfechtungErledigtAm) {
    return { fruehestens: null, gesperrt: true, grund: "Die Wahl ist angefochten – Daten bis zum rechtskräftigen Abschluss des Verfahrens aufbewahren." };
  }
  if (s.anfechtungAm && s.anfechtungErledigtAm) {
    return {
      fruehestens: addDays(s.anfechtungErledigtAm, 1),
      gesperrt: false,
      grund: `Anfechtungsverfahren am ${s.anfechtungErledigtAm.split("-").reverse().join(".")} abgeschlossen.`,
    };
  }
  if (s.anfechtungsfristEnde) {
    return {
      fruehestens: addDays(s.anfechtungsfristEnde, 1),
      gesperrt: false,
      grund: `Die Anfechtungsfrist endet am ${s.anfechtungsfristEnde.split("-").reverse().join(".")} (§ 21 LPVG).`,
    };
  }
  return { fruehestens: null, gesperrt: false, grund: "Erst nach Feststellung des Ergebnisses bestimmbar." };
}
