/**
 * Monatsraster für die Kalenderansicht des Wahlkalenders. Reine Funktionen.
 * Wochen beginnen am Montag; Tage außerhalb des Monats sind null.
 */
import { addDays, holidaysBW, weekday, type IsoDate } from "./fristen";

export interface Monat {
  /** "YYYY-MM" */
  key: string;
  titel: string;
  wochen: (IsoDate | null)[][];
}

const MONATSNAME = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

function ersterTag(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

function naechsterMonat(ersterImMonat: IsoDate): IsoDate {
  const y = Number(ersterImMonat.slice(0, 4));
  const m = Number(ersterImMonat.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Alle Monate von `von` bis `bis` (jeweils einschließlich) als Wochenraster Mo–So. */
export function monatsRaster(von: IsoDate, bis: IsoDate): Monat[] {
  const monate: Monat[] = [];
  for (let erster = ersterTag(von); erster <= bis; erster = naechsterMonat(erster)) {
    const key = erster.slice(0, 7);
    const wochen: (IsoDate | null)[][] = [];
    let woche: (IsoDate | null)[] = Array.from({ length: (weekday(erster) + 6) % 7 }, () => null);
    for (let d = erster; d.startsWith(key); d = addDays(d, 1)) {
      woche.push(d);
      if (woche.length === 7) {
        wochen.push(woche);
        woche = [];
      }
    }
    if (woche.length) wochen.push([...woche, ...Array.from({ length: 7 - woche.length }, () => null)]);
    monate.push({ key, titel: MONATSNAME.format(new Date(`${erster}T00:00:00Z`)), wochen });
  }
  return monate;
}

/** Gesetzliche Feiertage in BW im Zeitraum als Map Datum → Name. */
export function feiertageImZeitraum(von: IsoDate, bis: IsoDate): Map<IsoDate, string> {
  const map = new Map<IsoDate, string>();
  for (let y = Number(von.slice(0, 4)); y <= Number(bis.slice(0, 4)); y++) {
    for (const h of holidaysBW(y)) if (h.date >= von && h.date <= bis) map.set(h.date, h.name);
  }
  return map;
}
