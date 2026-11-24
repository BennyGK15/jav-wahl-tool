/**
 * CSV-Import für das Wählerverzeichnis. Reine Funktionen – laufen im Browser (Vorschau)
 * und auf dem Server (erneute Prüfung). Die Datei selbst wird nirgends gespeichert.
 */

export type ImportFeld =
  | "nachname"
  | "vorname"
  | "organisationseinheit"
  | "funktion"
  | "geburtsdatum"
  | "inAusbildung"
  | "ausbildungsende"
  | "geschlecht";

export const IMPORT_FELDER: { key: ImportFeld; label: string; pflicht: boolean }[] = [
  { key: "nachname", label: "Nachname", pflicht: true },
  { key: "vorname", label: "Vorname", pflicht: true },
  { key: "geburtsdatum", label: "Geburtsdatum", pflicht: true },
  { key: "inAusbildung", label: "In Ausbildung (ja/nein)", pflicht: false },
  { key: "ausbildungsende", label: "Ausbildungsende", pflicht: false },
  { key: "funktion", label: "Amts-/Funktionsbezeichnung bzw. Ausbildungsberuf", pflicht: false },
  { key: "organisationseinheit", label: "Organisationseinheit", pflicht: false },
  { key: "geschlecht", label: "Geschlecht (w/m/d)", pflicht: false },
];

/** Spaltenindex je Feld; -1 = nicht zugeordnet */
export type Zuordnung = Record<ImportFeld, number>;

export interface ImportZeile {
  nachname: string;
  vorname: string;
  organisationseinheit: string | null;
  funktion: string | null;
  geburtsdatum: string;
  inAusbildung: boolean;
  ausbildungsende: string | null;
  geschlecht: "w" | "m" | "d" | null;
}

export interface ImportFehler {
  /** Zeilennummer in der Datei (1-basiert, inkl. Kopfzeile) */
  zeile: number;
  fehler: string;
}

/** Erkennt das Trennzeichen anhand der ersten Zeile (Semikolon ist bei deutschem Excel üblich). */
export function erkenneTrennzeichen(text: string): string {
  const erste = text.split(/\r?\n/, 1)[0] ?? "";
  const kandidaten = [";", ",", "\t"];
  return kandidaten.reduce((best, c) => (erste.split(c).length > erste.split(best).length ? c : best), ";");
}

/** CSV nach RFC 4180 (Anführungszeichen, verdoppelte Anführungszeichen, Zeilenumbrüche in Feldern). */
export function parseCsv(input: string, trenn = erkenneTrennzeichen(input)): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let feld = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else inQuotes = false;
      } else feld += c;
    } else if (c === '"') inQuotes = true;
    else if (c === trenn) {
      row.push(feld);
      feld = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(feld);
      rows.push(row);
      row = [];
      feld = "";
    } else feld += c;
  }
  if (feld !== "" || row.length) {
    row.push(feld);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

/** Ordnet Spalten anhand der Überschriften zu. */
export function rateZuordnung(kopf: string[]): Zuordnung {
  const h = kopf.map(norm);
  const finde = (test: (x: string) => boolean, belegt: number[]) => h.findIndex((x, i) => !belegt.includes(i) && test(x));
  const z: Zuordnung = { nachname: -1, vorname: -1, organisationseinheit: -1, funktion: -1, geburtsdatum: -1, inAusbildung: -1, ausbildungsende: -1, geschlecht: -1 };
  const belegt: number[] = [];
  const setze = (k: ImportFeld, i: number) => {
    if (i >= 0) {
      z[k] = i;
      belegt.push(i);
    }
  };
  setze("vorname", finde((x) => x.includes("vorname") || x === "firstname", belegt));
  setze("nachname", finde((x) => x.includes("nachname") || x.includes("familienname") || x === "name" || x === "lastname", belegt));
  setze("geburtsdatum", finde((x) => x.includes("geburt") || x.startsWith("gebdat") || x.includes("birth"), belegt));
  setze("ausbildungsende", finde((x) => (x.includes("ausbildung") || x.includes("azubi")) && x.includes("ende"), belegt));
  // vor „Ausbildung“ und „Organisationseinheit“, damit „Ausbildungsberuf“ bzw. „Amtsbezeichnung“ hier landen
  setze("funktion", finde((x) => /funktion|amtsbez|dienstbez|beruf|taetigkeit|tatigkeit|stellenbez|jobtitle/.test(x), belegt));
  setze("inAusbildung", finde((x) => x.includes("ausbildung") || x.includes("azubi") || x.includes("auszubild"), belegt));
  // „Amt“ als Organisationseinheit, aber nicht „Amtsbezeichnung“ (das ist die Funktion)
  setze("organisationseinheit", finde((x) => /organisation|^oe$|abteilung|bereich|referat|dienststelle/.test(x) || (x.includes("amt") && !x.includes("bez")), belegt));
  setze("geschlecht", finde((x) => x.includes("geschlecht") || x === "gender" || x === "sex", belegt));
  return z;
}

/** Datum in ISO: 31.12.2008, 1.2.2008, 31.12.08, 2008-12-31. null = ungültig. */
export function parseDatum(raw: string, heute = new Date()): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) {
    y = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else if ((r = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s))) {
    d = Number(r[1]);
    m = Number(r[2]);
    y = Number(r[3]);
    if (r[3]!.length === 2) {
      const jj = heute.getFullYear() % 100;
      y += y <= jj ? 2000 : 1900;
    }
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseJaNein(raw: string): boolean | null {
  if (raw.trim() === "") return false;
  const s = norm(raw);
  if (["nein", "n", "0", "false", "falsch", "no", "keine"].includes(s)) return false;
  if (["ja", "j", "x", "1", "true", "wahr", "yes", "azubi", "auszubildende", "auszubildender"].includes(s)) return true;
  return null;
}

export function parseGeschlecht(raw: string): "w" | "m" | "d" | null | undefined {
  if (raw.trim() === "") return null;
  const s = norm(raw);
  if (["w", "weiblich", "f", "female", "frau"].includes(s)) return "w";
  if (["m", "mannlich", "maennlich", "male", "mann"].includes(s)) return "m";
  if (["d", "divers", "x", "diverse"].includes(s)) return "d";
  return undefined; // nicht erkannt
}

/** Wandelt Rohzeilen anhand der Zuordnung in geprüfte Importzeilen um. */
export function wandleZeilen(rows: string[][], z: Zuordnung, mitKopfzeile: boolean, heute = new Date()): { zeilen: ImportZeile[]; fehler: ImportFehler[] } {
  const zeilen: ImportZeile[] = [];
  const fehler: ImportFehler[] = [];
  const daten = mitKopfzeile ? rows.slice(1) : rows;
  const offset = mitKopfzeile ? 2 : 1;
  const heuteIso = heute.toISOString().slice(0, 10);

  daten.forEach((r, i) => {
    const nr = i + offset;
    const wert = (k: ImportFeld) => (z[k] >= 0 ? (r[z[k]] ?? "").trim() : "");
    const probleme: string[] = [];

    const nachname = wert("nachname");
    const vorname = wert("vorname");
    if (!nachname) probleme.push("Nachname fehlt");
    if (!vorname) probleme.push("Vorname fehlt");
    if (nachname.length > 120 || vorname.length > 120) probleme.push("Name zu lang");

    const geburtsdatum = parseDatum(wert("geburtsdatum"), heute);
    if (!geburtsdatum) probleme.push(`Geburtsdatum „${wert("geburtsdatum")}“ nicht lesbar`);
    else if (geburtsdatum < "1940-01-01" || geburtsdatum > heuteIso) probleme.push("Geburtsdatum nicht plausibel");

    const inAusbildung = z.inAusbildung >= 0 ? parseJaNein(wert("inAusbildung")) : false;
    if (inAusbildung === null) probleme.push(`Ausbildung „${wert("inAusbildung")}“ nicht erkannt (ja/nein)`);

    let ausbildungsende: string | null = null;
    if (wert("ausbildungsende")) {
      ausbildungsende = parseDatum(wert("ausbildungsende"), heute);
      if (!ausbildungsende) probleme.push(`Ausbildungsende „${wert("ausbildungsende")}“ nicht lesbar`);
    }

    const geschlecht = parseGeschlecht(wert("geschlecht"));
    if (geschlecht === undefined) probleme.push(`Geschlecht „${wert("geschlecht")}“ nicht erkannt (w/m/d)`);

    const oe = wert("organisationseinheit");
    const funktion = wert("funktion");
    if (probleme.length) {
      fehler.push({ zeile: nr, fehler: probleme.join("; ") });
      return;
    }
    zeilen.push({
      nachname,
      vorname,
      organisationseinheit: oe ? oe.slice(0, 120) : null,
      funktion: funktion ? funktion.slice(0, 120) : null,
      geburtsdatum: geburtsdatum!,
      // Ausbildungsende ohne Ausbildungsmerkmal bedeutet: in Ausbildung
      inAusbildung: Boolean(inAusbildung) || ausbildungsende != null,
      ausbildungsende,
      geschlecht: geschlecht ?? null,
    });
  });
  return { zeilen, fehler };
}

/** Schlüssel zur Erkennung von Dubletten */
export const dublettenSchluessel = (z: { nachname: string; vorname: string; geburtsdatum: string }) =>
  `${norm(z.nachname)}|${norm(z.vorname)}|${z.geburtsdatum}`;
