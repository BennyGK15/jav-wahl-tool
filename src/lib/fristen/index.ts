/**
 * Fristenberechnung für die JAV-Wahl (LPVGWO BW, §§ 186–193 BGB).
 *
 * Reine Funktionen ohne Abhängigkeiten. Datumswerte sind ISO-Strings "YYYY-MM-DD"
 * und werden intern in UTC gerechnet, damit Zeitzonen und Sommerzeit keine Rolle spielen.
 *
 * Die Regelwerte (DEFAULT_RULES) sind gegen den amtlichen Text abgeglichen (siehe RECHTSSTAND).
 * Bei Rechtsänderungen hier und in RECHTSSTAND anpassen.
 */

/** Stand des Abgleichs mit Landesrecht BW (landesrecht-bw.de). */
export const RECHTSSTAND = {
  lpvg: "LPVG i. d. F. vom 12.03.2015, zuletzt geändert durch Gesetz vom 21.12.2023 (GBl. S. 482)",
  lpvgwo:
    "LPVGWO i. d. F. vom 12.03.2015, zuletzt geändert durch Verordnung vom 25.07.2023 (GBl. S. 277)",
  geprueftAm: "2026-11-04",
} as const;

/** Kennung für Regeln, die gegen den amtlichen Text abgeglichen wurden (statt einer Benutzer-ID). */
export const PRUEFER_LANDESRECHT = "system:landesrecht-bw";

export type IsoDate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIso(iso: IsoDate): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Ungültiges Datum: ${iso}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  ) {
    throw new Error(`Ungültiges Datum: ${iso}`);
  }
  return ms;
}

export function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(parseIso(iso) + days * DAY_MS);
}

/** 0 = Sonntag … 6 = Samstag */
export function weekday(iso: IsoDate): number {
  return new Date(parseIso(iso)).getUTCDay();
}

/** Ostersonntag nach der Gaußschen Osterformel (gregorianisch, anonymer Algorithmus). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(Date.UTC(year, month - 1, day));
}

export interface Holiday {
  date: IsoDate;
  name: string;
}

/** Gesetzliche Feiertage in Baden-Württemberg (Feiertagsgesetz BW). */
export function holidaysBW(year: number): Holiday[] {
  const easter = easterSunday(year);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fixed = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`;
  const list: Holiday[] = [
    { date: fixed(1, 1), name: "Neujahr" },
    { date: fixed(1, 6), name: "Heilige Drei Könige" },
    { date: addDays(easter, -2), name: "Karfreitag" },
    { date: addDays(easter, 1), name: "Ostermontag" },
    { date: fixed(5, 1), name: "Tag der Arbeit" },
    { date: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { date: addDays(easter, 50), name: "Pfingstmontag" },
    { date: addDays(easter, 60), name: "Fronleichnam" },
    { date: fixed(10, 3), name: "Tag der Deutschen Einheit" },
    { date: fixed(11, 1), name: "Allerheiligen" },
    { date: fixed(12, 25), name: "1. Weihnachtstag" },
    { date: fixed(12, 26), name: "2. Weihnachtstag" },
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

export interface WorkdayOptions {
  /** Zusätzliche arbeitsfreie Tage (z. B. örtliche Feiertage), ISO-Daten. */
  extraNonWorkdays?: readonly IsoDate[];
  /** Heiligabend und Silvester ausnehmen (§ 55 Abs. 1 Satz 2 LPVGWO). Standard: true */
  excludeChristmasEveAndNewYearsEve?: boolean;
}

const holidayCache = new Map<number, Set<IsoDate>>();

function holidaySet(year: number): Set<IsoDate> {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(holidaysBW(year).map((h) => h.date));
    holidayCache.set(year, set);
  }
  return set;
}

export function isHolidayBW(iso: IsoDate): boolean {
  return holidaySet(Number(iso.slice(0, 4))).has(iso);
}

/** Arbeitstag (§ 55 Abs. 1 Satz 2 LPVGWO): Montag bis Freitag ohne gesetzliche Feiertage, Heiligabend und Silvester. */
export function isWorkday(iso: IsoDate, opts: WorkdayOptions = {}): boolean {
  const wd = weekday(iso);
  if (wd === 0 || wd === 6) return false;
  if (isHolidayBW(iso)) return false;
  const md = iso.slice(5);
  if (
    (opts.excludeChristmasEveAndNewYearsEve ?? true) &&
    (md === "12-24" || md === "12-31")
  )
    return false;
  if (opts.extraNonWorkdays?.includes(iso)) return false;
  return true;
}

function assertCount(n: number) {
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`Anzahl Arbeitstage muss ≥ 1 sein: ${n}`);
}

/**
 * n Arbeitstage NACH einem Ereignis. Der Ereignistag zählt nicht mit (§ 187 Abs. 1 BGB).
 * Ergebnis ist der letzte Tag der Frist.
 */
export function addWorkdays(
  start: IsoDate,
  n: number,
  opts?: WorkdayOptions,
): IsoDate {
  assertCount(n);
  let current = start;
  let counted = 0;
  while (counted < n) {
    current = addDays(current, 1);
    if (isWorkday(current, opts)) counted++;
  }
  return current;
}

/**
 * Der n-te Arbeitstag VOR einem Stichtag (z. B. „spätestens 5 Arbeitstage vor dem Wahltag").
 * Der Stichtag selbst zählt nicht mit.
 */
export function subtractWorkdays(
  end: IsoDate,
  n: number,
  opts?: WorkdayOptions,
): IsoDate {
  assertCount(n);
  let current = end;
  let counted = 0;
  while (counted < n) {
    current = addDays(current, -1);
    if (isWorkday(current, opts)) counted++;
  }
  return current;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Datum n Monate früher; fehlt der Tag im Zielmonat, gilt dessen letzter Tag (vgl. § 188 Abs. 3 BGB). */
export function subtractMonths(iso: IsoDate, n: number): IsoDate {
  const d = new Date(parseIso(iso));
  let year = d.getUTCFullYear();
  let month0 = d.getUTCMonth() - n;
  while (month0 < 0) {
    month0 += 12;
    year -= 1;
  }
  const day = Math.min(d.getUTCDate(), daysInMonth(year, month0));
  return toIso(Date.UTC(year, month0, day));
}

/** Fällt ein Fristende auf Samstag, Sonntag oder Feiertag, endet es am nächsten Werktag (§ 193 BGB). */
export function shiftToNextBusinessDay(iso: IsoDate): IsoDate {
  let current = iso;
  while (
    weekday(current) === 0 ||
    weekday(current) === 6 ||
    isHolidayBW(current)
  ) {
    current = addDays(current, 1);
  }
  return current;
}

/** Nächster Arbeitstag vor einem Datum, falls dieses kein Arbeitstag ist (für „spätestens"-Termine). */
export function shiftToPreviousWorkday(
  iso: IsoDate,
  opts?: WorkdayOptions,
): IsoDate {
  let current = iso;
  while (!isWorkday(current, opts)) current = addDays(current, -1);
  return current;
}

// ---------------------------------------------------------------------------
// Regeln und Wahlkalender
// ---------------------------------------------------------------------------

export type Verfahren = "regulaer" | "wahlversammlung";

export interface DeadlineRule {
  key: string;
  label: string;
  /** Für welches Wahlverfahren die Regel gilt */
  verfahren: Verfahren;
  /** Bezugspunkt: erster Wahltag, Erlass des Wahlausschreibens oder Ende der Amtszeit der bisherigen JAV */
  anchor: "wahltag" | "wahlausschreiben" | "amtszeitende";
  direction: "vor" | "nach";
  unit: "arbeitstage" | "wochen" | "monate";
  amount: number;
  legalBasis: string;
  /** Erst nach Prüfung gegen den amtlichen Text auf true setzen. */
  verified: boolean;
}

/**
 * Fristregeln für die JAV-Wahl. Für das reguläre Verfahren gelten nach § 54 Abs. 1 LPVGWO die §§ 1–44 LPVGWO entsprechend.
 * Abgeglichen mit dem amtlichen Text (RECHTSSTAND). „verified: false“ = keine gesetzliche Frist, nur Empfehlung.
 */
export const DEFAULT_RULES: readonly DeadlineRule[] = [
  // Reguläres Verfahren
  {
    key: "stichtag_feststellung",
    verfahren: "regulaer",
    label: "Stichtag: Zahl der Beschäftigten und Wahlberechtigten feststellen",
    anchor: "wahlausschreiben",
    direction: "vor",
    unit: "arbeitstage",
    amount: 10,
    legalBasis: "§ 5 Satz 2 LPVGWO",
    verified: true,
  },
  {
    key: "wahlausschreiben",
    verfahren: "regulaer",
    label: "Erlass des Wahlausschreibens (spätestens)",
    anchor: "wahltag",
    direction: "vor",
    unit: "monate",
    amount: 2,
    legalBasis: "§ 9 Abs. 1 LPVGWO",
    verified: true,
  },
  {
    key: "wahlvorschlaege_ende",
    verfahren: "regulaer",
    label: "Ende der Einreichungsfrist für Wahlvorschläge",
    anchor: "wahlausschreiben",
    direction: "nach",
    unit: "arbeitstage",
    amount: 12,
    legalBasis: "§ 11 Abs. 2 LPVGWO",
    verified: true,
  },
  {
    key: "maengel_mitteilung",
    verfahren: "regulaer",
    label: "Mängel an Wahlvorschlägen mitteilen (spätestens)",
    anchor: "wahlausschreiben",
    direction: "nach",
    unit: "arbeitstage",
    amount: 13,
    legalBasis: "§ 14 Abs. 2 Satz 1 LPVGWO",
    verified: true,
  },
  {
    key: "berichtigung_ende",
    verfahren: "regulaer",
    label: "Ende der Frist für berichtigte Wahlvorschläge",
    anchor: "wahlausschreiben",
    direction: "nach",
    unit: "arbeitstage",
    amount: 15,
    legalBasis: "§ 14 Abs. 2 Satz 3 LPVGWO",
    verified: true,
  },
  {
    key: "auslage_beginn",
    verfahren: "regulaer",
    label: "Beginn der Auslage des Wählerverzeichnisses (spätestens)",
    anchor: "wahltag",
    direction: "vor",
    unit: "arbeitstage",
    amount: 12,
    legalBasis: "§ 6 Abs. 4 Satz 1 LPVGWO",
    verified: true,
  },
  {
    key: "bekanntmachung_vorschlaege",
    verfahren: "regulaer",
    label: "Bekanntmachung der zugelassenen Wahlvorschläge (spätestens)",
    anchor: "wahltag",
    direction: "vor",
    unit: "arbeitstage",
    amount: 5,
    legalBasis: "§ 18 Abs. 1 Satz 1 LPVGWO",
    verified: true,
  },
  {
    key: "auslage_ende",
    verfahren: "regulaer",
    label: "Ende der Auslage und der Einspruchsfrist",
    anchor: "wahltag",
    direction: "vor",
    unit: "arbeitstage",
    amount: 2,
    legalBasis: "§ 6 Abs. 4 Satz 1, Abs. 5 LPVGWO",
    verified: true,
  },
  {
    key: "einspruch_entscheidung",
    verfahren: "regulaer",
    label: "Entscheidungen über Einsprüche mitteilen (spätestens)",
    anchor: "wahltag",
    direction: "vor",
    unit: "arbeitstage",
    amount: 1,
    legalBasis: "§ 6 Abs. 6 Satz 2 LPVGWO",
    verified: true,
  },
  {
    key: "konstituierende_sitzung",
    verfahren: "regulaer",
    label:
      "Einladung zur konstituierenden Sitzung (Empfehlung, ab 3 Mitgliedern)",
    anchor: "wahltag",
    direction: "nach",
    unit: "arbeitstage",
    amount: 6,
    legalBasis: "für die JAV nicht geregelt; § 19 LPVG sinngemäß",
    verified: false,
  },
  // Wahlversammlung (höchstens 20 in der Regel Beschäftigte i. S. v. § 59 LPVG)
  {
    key: "wv_einladung",
    verfahren: "wahlversammlung",
    label: "Einberufung der Wahlversammlung (spätestens)",
    anchor: "amtszeitende",
    direction: "vor",
    unit: "wochen",
    amount: 4,
    legalBasis: "§ 62 Abs. 2 Satz 2 LPVG",
    verified: true,
  },
];

/** Regeln ohne gesetzliche Frist – nur Empfehlung, daher nicht „prüfbar“. */
export const EMPFEHLUNGEN: readonly string[] = ["konstituierende_sitzung"];

/** Früher mitgelieferte Standardregeln, die nicht mehr gelten (werden aus der Datenbank entfernt). */
export const ENTFALLENE_REGELN: readonly string[] = [
  // Bei einer Wahlversammlung besteht die JAV aus einer Person (§ 61 Abs. 1 LPVG) – keine Vorsitzwahl, keine konstituierende Sitzung.
  "wv_konstituierende_sitzung",
];

export function rulesFor(
  verfahren: Verfahren,
  rules: readonly DeadlineRule[] = DEFAULT_RULES,
): DeadlineRule[] {
  return rules.filter((r) => r.verfahren === verfahren);
}

export interface ScheduleEntry {
  key: string;
  label: string;
  date: IsoDate;
  legalBasis: string;
  verified: boolean;
}

export interface ScheduleOptions extends WorkdayOptions {
  /** Tatsächlicher Erlass des Wahlausschreibens, falls früher als spätestens nötig */
  wahlausschreibenAm?: IsoDate;
  /** Ende der Amtszeit der bisherigen JAV (fehlt bei der ersten Wahl) */
  amtszeitEnde?: IsoDate;
}

function applyRule(
  anchorDate: IsoDate,
  rule: DeadlineRule,
  opts?: WorkdayOptions,
): IsoDate {
  switch (rule.unit) {
    case "monate":
      if (rule.direction === "vor") {
        // „spätestens n Monate vor": liegt der Tag nicht auf einem Arbeitstag, früher handeln.
        return shiftToPreviousWorkday(
          subtractMonths(anchorDate, rule.amount),
          opts,
        );
      }
      throw new Error(
        `Regel ${rule.key}: Monatsfristen „nach" sind nicht vorgesehen`,
      );
    case "wochen":
      return rule.direction === "vor"
        ? shiftToPreviousWorkday(addDays(anchorDate, -7 * rule.amount), opts)
        : shiftToNextBusinessDay(addDays(anchorDate, 7 * rule.amount));
    case "arbeitstage":
      return rule.direction === "vor"
        ? subtractWorkdays(anchorDate, rule.amount, opts)
        : addWorkdays(anchorDate, rule.amount, opts);
  }
}

/**
 * Berechnet den Wahlkalender ausgehend vom ersten Wahltag.
 * Übergebene Regeln müssen bereits auf EIN Verfahren gefiltert sein (siehe rulesFor).
 * Regeln, deren Bezugspunkt fehlt (z. B. Amtszeitende bei einer ersten Wahl), werden ausgelassen.
 */
export function computeSchedule(
  wahltag: IsoDate,
  rules: readonly DeadlineRule[] = rulesFor("regulaer"),
  options: ScheduleOptions = {},
): ScheduleEntry[] {
  parseIso(wahltag);
  const ausschreibenRule = rules.find((r) => r.key === "wahlausschreiben");
  const latestAusschreiben = ausschreibenRule
    ? applyRule(wahltag, ausschreibenRule, options)
    : undefined;

  if (
    options.wahlausschreibenAm &&
    latestAusschreiben &&
    options.wahlausschreibenAm > latestAusschreiben
  ) {
    throw new Error(
      `Das Wahlausschreiben am ${options.wahlausschreibenAm} wäre zu spät (spätestens ${latestAusschreiben}).`,
    );
  }
  const ausschreiben = options.wahlausschreibenAm ?? latestAusschreiben;

  const entries: ScheduleEntry[] = [];
  for (const rule of rules) {
    let date: IsoDate | undefined;
    if (rule.key === "wahlausschreiben") {
      date = ausschreiben;
    } else if (rule.anchor === "wahlausschreiben") {
      date = ausschreiben ? applyRule(ausschreiben, rule, options) : undefined;
    } else if (rule.anchor === "amtszeitende") {
      date = options.amtszeitEnde
        ? applyRule(options.amtszeitEnde, rule, options)
        : undefined;
    } else {
      date = applyRule(wahltag, rule, options);
    }
    if (date) {
      entries.push({
        key: rule.key,
        label: rule.label,
        date,
        legalBasis: rule.legalBasis,
        verified: rule.verified,
      });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** Kurzbeschreibung einer Regel, z. B. „12 Arbeitstage nach Erlass des Wahlausschreibens". */
export function describeRule(
  rule: Pick<DeadlineRule, "anchor" | "direction" | "unit" | "amount">,
): string {
  const unit = {
    arbeitstage: "Arbeitstage",
    wochen: "Wochen",
    monate: "Monate",
  }[rule.unit];
  const anchor = {
    wahltag: "dem ersten Wahltag",
    wahlausschreiben: "Erlass des Wahlausschreibens",
    amtszeitende: "Ende der Amtszeit",
  }[rule.anchor];
  return `${rule.amount} ${unit} ${rule.direction} ${anchor}`;
}

/**
 * Fristen, die nicht aus dem Wahltag folgen, sondern durch ein Ereignis ausgelöst werden.
 * Nachfrist für Wahlvorschläge: 6 Arbeitstage nach ihrer Bekanntmachung (§ 16 Abs. 1 Satz 2 LPVGWO).
 */
export const NACHFRIST = {
  key: "nachfrist_ende",
  label: "Ende der Nachfrist für Wahlvorschläge",
  legalBasis: "§ 16 Abs. 1 LPVGWO",
  arbeitstage: 6,
} as const;

export function nachfristEnde(
  bekanntmachung: IsoDate,
  opts?: WorkdayOptions,
): IsoDate {
  return addWorkdays(bekanntmachung, NACHFRIST.arbeitstage, opts);
}

/**
 * Wahlanfechtung: binnen 12 Arbeitstagen ab Bekanntgabe des Wahlergebnisses (§ 21 Abs. 1 LPVG i. V. m. § 62 Abs. 1 LPVG).
 * „Arbeitstage“ ist im LPVG nicht eigens definiert; gerechnet wird wie in § 55 LPVGWO (Mo–Fr ohne Feiertage, 24.12., 31.12.).
 * Erst danach steht die Gültigkeit fest – Voraussetzung für die Löschung elektronischer Daten (§ 32 LPVGWO).
 */
export const ANFECHTUNGSFRIST = {
  key: "anfechtung_ende",
  label: "Ende der Anfechtungsfrist",
  legalBasis: "§ 21 Abs. 1 i. V. m. § 62 Abs. 1 LPVG",
  arbeitstage: 12,
} as const;

export function anfechtungsfristEnde(
  bekanntgabe: IsoDate,
  opts?: WorkdayOptions,
): IsoDate {
  return addWorkdays(bekanntgabe, ANFECHTUNGSFRIST.arbeitstage, opts);
}

/** Aushang des Wahlergebnisses für die Dauer von zwei Wochen (§ 31 Abs. 2 LPVGWO). Ergebnis = letzter Tag des Aushangs. */
export const AUSHANG_ERGEBNIS = {
  key: "aushang_ergebnis_ende",
  label: "Ende des Aushangs des Wahlergebnisses",
  legalBasis: "§ 31 Abs. 2 LPVGWO",
  tage: 14,
} as const;

export function aushangErgebnisEnde(bekanntgabe: IsoDate): IsoDate {
  return addDays(bekanntgabe, AUSHANG_ERGEBNIS.tage);
}

/** Bezeichnung + Rechtsgrundlage für ereignisbezogene Fristen (Ergänzung zu den Regeln aus der Datenbank). */
export const ZUSATZ_FRISTEN: Record<
  string,
  { label: string; legalBasis: string }
> = {
  [NACHFRIST.key]: { label: NACHFRIST.label, legalBasis: NACHFRIST.legalBasis },
  [ANFECHTUNGSFRIST.key]: {
    label: ANFECHTUNGSFRIST.label,
    legalBasis: ANFECHTUNGSFRIST.legalBasis,
  },
  [AUSHANG_ERGEBNIS.key]: {
    label: AUSHANG_ERGEBNIS.label,
    legalBasis: AUSHANG_ERGEBNIS.legalBasis,
  },
};

// ---------------------------------------------------------------------------
// Vorschlag für den frühesten Wahltag
// ---------------------------------------------------------------------------

/**
 * Jahr regelmäßiger Personalratswahlen: alle fünf Jahre vom 1. April bis 31. Juli (§ 22 Abs. 3 Satz 1 LPVG),
 * zuletzt 2024 (2014, 2019, 2024, 2029 …).
 */
export function istPersonalratswahljahr(year: number): boolean {
  return (((year - 2024) % 5) + 5) % 5 === 0;
}

export interface Wahlzeitraum {
  beginn: IsoDate;
  ende: IsoDate;
  /** zusammen mit den Personalratswahlen (Frühjahr) oder der Zwischentermin im Herbst/Winter */
  art: "personalratswahl" | "herbst";
}

/**
 * Regelmäßiger Wahlzeitraum für JAV-Wahlen, in dem ein Datum liegt (§ 62 Abs. 3 Satz 1 LPVG).
 * Die JAV wird im Wechsel gewählt: (1) zusammen mit den regelmäßigen Personalratswahlen (1.4.–31.7. eines
 * Personalratswahljahres) und (2) sonst vom 1.10. bis 31.1. – zweieinhalb Jahre später (2026/27, 2031/32 …).
 * null = außerhalb.
 */
export function regelWahlzeitraum(iso: IsoDate): Wahlzeitraum | null {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (m >= 4 && m <= 7)
    return istPersonalratswahljahr(y)
      ? { beginn: `${y}-04-01`, ende: `${y}-07-31`, art: "personalratswahl" }
      : null;
  if (m >= 10)
    return istPersonalratswahljahr(y - 2)
      ? { beginn: `${y}-10-01`, ende: `${y + 1}-01-31`, art: "herbst" }
      : null;
  if (m === 1)
    return istPersonalratswahljahr(y - 3)
      ? { beginn: `${y - 1}-10-01`, ende: `${y}-01-31`, art: "herbst" }
      : null;
  return null;
}

/** Nächster Arbeitstag ab einem Datum (das Datum selbst eingeschlossen). */
export function shiftToNextWorkday(
  iso: IsoDate,
  opts?: WorkdayOptions,
): IsoDate {
  let current = iso;
  while (!isWorkday(current, opts)) current = addDays(current, 1);
  return current;
}

export interface WahltagVorschlag {
  datum: IsoDate;
  /** Was den Termin bestimmt hat – für die Anzeige */
  gruende: string[];
  warnungen: string[];
}

/**
 * Frühester sinnvoller Wahltag aus dem Ende der Amtszeit der bisherigen JAV.
 * Regulär: Beginn des Wahlzeitraums, aber nicht früher, als das Wahlausschreiben ab heute noch rechtzeitig
 * (erlassMonate vor dem Wahltag) erlassen werden kann.
 */
export function fruehesterWahltag(args: {
  heute: IsoDate;
  amtszeitEnde: IsoDate;
  verfahren: Verfahren;
  /** Vorlauf des Wahlausschreibens in Monaten (Regel „wahlausschreiben“) */
  erlassMonate?: number;
  einladungWochen?: number;
}): WahltagVorschlag {
  const {
    heute,
    amtszeitEnde,
    verfahren,
    erlassMonate = 2,
    einladungWochen = 4,
  } = args;
  parseIso(heute);
  parseIso(amtszeitEnde);
  const gruende: string[] = [];
  const warnungen: string[] = [];

  const zeitraum = regelWahlzeitraum(amtszeitEnde);
  let datum: IsoDate;
  if (zeitraum) {
    datum = shiftToNextWorkday(zeitraum.beginn);
    gruende.push(
      `Die Amtszeit endet im regelmäßigen Wahlzeitraum ${formatKurz(zeitraum.beginn)}–${formatKurz(zeitraum.ende)}; frühester Arbeitstag darin: ${formatKurz(datum)}.`,
    );
  } else {
    datum = shiftToNextWorkday(addDays(heute, 1));
    warnungen.push(
      "Das Amtszeitende liegt außerhalb der regelmäßigen JAV-Wahlzeiträume (§ 62 Abs. 3 LPVG) – bei einer Wahl außerhalb des Turnus bitte die Rechtslage prüfen.",
    );
  }

  if (verfahren === "regulaer") {
    // Frühester Tag X, für den der späteste Erlass (X − erlassMonate, zurück auf Arbeitstag) nicht vor heute liegt
    let x = shiftToNextWorkday(addDays(heute, 1));
    for (
      let i = 0;
      i < 800 &&
      shiftToPreviousWorkday(subtractMonths(x, erlassMonate)) < heute;
      i++
    ) {
      x = shiftToNextWorkday(addDays(x, 1));
    }
    if (x > datum) {
      datum = x;
      gruende.push(
        `Das Wahlausschreiben muss spätestens ${erlassMonate} Monate vorher erlassen werden; bei Erlass ab heute ist ${formatKurz(x)} der früheste Wahltag.`,
      );
    } else {
      gruende.push(
        `Der Vorlauf von ${erlassMonate} Monaten für das Wahlausschreiben ist eingehalten, wenn es spätestens am ${formatKurz(shiftToPreviousWorkday(subtractMonths(datum, erlassMonate)))} erlassen wird.`,
      );
    }
  } else {
    const morgen = shiftToNextWorkday(addDays(heute, 1));
    if (morgen > datum) datum = morgen;
    const einladungBis = shiftToPreviousWorkday(
      addDays(amtszeitEnde, -7 * einladungWochen),
    );
    if (einladungBis < heute) {
      warnungen.push(
        `Die Einladung hätte spätestens am ${formatKurz(einladungBis)} erfolgen müssen (${einladungWochen} Wochen vor Amtszeitende).`,
      );
    } else {
      gruende.push(
        `Einladung zur Wahlversammlung spätestens am ${formatKurz(einladungBis)}.`,
      );
    }
  }

  if (datum > amtszeitEnde) {
    warnungen.push(
      `Der früheste mögliche Termin liegt nach dem Ende der Amtszeit (${formatKurz(amtszeitEnde)}). Bis zur Wahl gibt es keine JAV – bitte so früh wie möglich wählen.`,
    );
  }
  return { datum, gruende, warnungen };
}

function formatKurz(iso: IsoDate): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** Fristenden, für die der Wahlvorstand eine Uhrzeit festlegen kann (§ 55 Abs. 2 LPVGWO); nicht vor Dienstschluss der Mehrheit. */
export const FRISTENDEN_MIT_UHRZEIT: readonly string[] = [
  "wahlvorschlaege_ende",
  "berichtigung_ende",
  "auslage_ende",
  NACHFRIST.key,
];
