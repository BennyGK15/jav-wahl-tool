/**
 * Ablauf der JAV-Wahl in Phasen: welche Seite gehört wozu, was ist jetzt zu tun, wie lange noch.
 * Reine Funktionen ohne Abhängigkeiten zur Datenbank.
 */
import { addDays, isWorkday, type IsoDate, type Verfahren } from "./fristen";
import { AUTO_HINWEIS } from "./auto-erledigt";
import { hasPermission, type Permission } from "./rbac";

export type PhaseKey =
  "vorbereiten" | "einleiten" | "vorschlaege" | "waehlen" | "abschliessen";

export interface Seite {
  /** relativ zur Wahl ("waehler") oder absolut ("/aufbewahrung") */
  pfad: string;
  label: string;
  /** mindestens eine dieser Berechtigungen nötig */
  rechte: readonly Permission[];
  /** Seite gibt es erst ab einem bestimmten Stand der Wahl */
  bedingung?: Bedingung;
}

export type Bedingung = "nachfrist" | "ergebnis";

/** Hinweis, wann eine Seite verfügbar wird (für ausgegraute Einträge). */
export const BEDINGUNG_HINWEIS: Record<Bedingung, string> = {
  nachfrist: "nur, wenn eine Nachfrist bekanntgemacht wurde",
  ergebnis: "ab Erfassung des Ergebnisses",
};

export type Verfuegbarkeit = Record<Bedingung, boolean>;

/** Hinweistext, wenn eine Seite noch nicht verfügbar ist, sonst undefined. */
export function gesperrtHinweis(
  seite: Seite,
  v: Verfuegbarkeit,
): string | undefined {
  return seite.bedingung && !v[seite.bedingung]
    ? BEDINGUNG_HINWEIS[seite.bedingung]
    : undefined;
}

export interface PhaseDef {
  key: PhaseKey;
  label: string;
  /** Was in dieser Phase passiert – ein Satz */
  kurz: string;
  seiten: readonly Seite[];
}

const ergebnisSeiten: Seite[] = [
  { pfad: "ergebnis", label: "Ergebnis", rechte: ["voters.edit"] },
  {
    pfad: "ergebnis/niederschrift",
    label: "Niederschrift",
    rechte: ["voters.edit"],
    bedingung: "ergebnis",
  },
  {
    pfad: "ergebnis/bekanntmachung",
    label: "Bekanntmachung",
    rechte: ["voters.edit"],
    bedingung: "ergebnis",
  },
  {
    pfad: "ergebnis/benachrichtigung",
    label: "Benachrichtigung",
    rechte: ["voters.edit"],
    bedingung: "ergebnis",
  },
  { pfad: "wahlakte", label: "Wahlakte", rechte: ["voters.edit"] },
  {
    pfad: "/aufbewahrung",
    label: "Abschluss & Löschung",
    rechte: ["retention.execute"],
  },
];

const PHASEN_REGULAER: readonly PhaseDef[] = [
  {
    key: "vorbereiten",
    label: "Vorbereiten",
    kurz: "Wahlvorstand bekanntmachen, Wählerverzeichnis aufstellen und die Zahl der Wahlberechtigten feststellen.",
    seiten: [
      {
        pfad: "wahlvorstand",
        label: "Wahlvorstand",
        rechte: ["deadlines.read"],
      },
      { pfad: "waehler", label: "Wählerverzeichnis", rechte: ["voters.edit"] },
      {
        pfad: "bearbeiten",
        label: "Wahl bearbeiten",
        rechte: ["election.manage"],
      },
    ],
  },
  {
    key: "einleiten",
    label: "Einleiten",
    kurz: "Wahlausschreiben erlassen und aushängen, Wählerverzeichnis auslegen, Einsprüche entscheiden.",
    seiten: [
      {
        pfad: "wahlausschreiben",
        label: "Wahlausschreiben",
        rechte: ["deadlines.read"],
      },
      { pfad: "waehler/auslage", label: "Auslage", rechte: ["voters.edit"] },
      { pfad: "einsprueche", label: "Einsprüche", rechte: ["voters.edit"] },
    ],
  },
  {
    key: "vorschlaege",
    label: "Wahlvorschläge",
    kurz: "Wahlvorschläge annehmen, prüfen, Mängel mitteilen, zulassen und bekanntmachen.",
    seiten: [
      {
        pfad: "vorschlaege",
        label: "Wahlvorschläge",
        rechte: ["nominations.edit"],
      },
      {
        pfad: "vorschlaege/vordruck",
        label: "Vordruck",
        rechte: ["deadlines.read"],
      },
      {
        pfad: "vorschlaege/nachfrist",
        label: "Nachfrist",
        rechte: ["nominations.edit"],
        bedingung: "nachfrist",
      },
      {
        pfad: "vorschlaege/bekanntmachung",
        label: "Bekanntmachung",
        rechte: ["nominations.edit"],
      },
    ],
  },
  {
    key: "waehlen",
    label: "Wählen",
    kurz: "Stimmzettel erstellen, Briefwahl abwickeln, am Wahltag die Stimmabgabe vermerken.",
    seiten: [
      { pfad: "wahltag", label: "Wahltag", rechte: ["voters.markVoted"] },
      {
        pfad: "wahltag/briefwahl",
        label: "Briefwahl",
        rechte: ["voters.edit"],
      },
      {
        pfad: "stimmzettel",
        label: "Stimmzettel",
        rechte: ["nominations.edit", "voters.edit"],
      },
    ],
  },
  {
    key: "abschliessen",
    label: "Abschließen",
    kurz: "Auszählen, Ergebnis feststellen und bekanntmachen, Gewählte benachrichtigen, Daten fristgerecht löschen.",
    seiten: ergebnisSeiten,
  },
];

const PHASEN_WAHLVERSAMMLUNG: readonly PhaseDef[] = [
  {
    key: "vorbereiten",
    label: "Vorbereiten",
    kurz: "Wahlvorstand bekanntmachen und Wählerverzeichnis aufstellen.",
    seiten: [
      {
        pfad: "wahlvorstand",
        label: "Wahlvorstand",
        rechte: ["deadlines.read"],
      },
      { pfad: "waehler", label: "Wählerverzeichnis", rechte: ["voters.edit"] },
      {
        pfad: "bearbeiten",
        label: "Wahl bearbeiten",
        rechte: ["election.manage"],
      },
    ],
  },
  {
    key: "einleiten",
    label: "Einladen",
    kurz: "Spätestens vier Wochen vor Ende der Amtszeit zur Wahlversammlung einladen.",
    seiten: [
      { pfad: "einladung", label: "Einladung", rechte: ["deadlines.read"] },
    ],
  },
  {
    key: "waehlen",
    label: "Wählen",
    kurz: "Wahlversammlung durchführen: Vorschläge aus der Versammlung, geheime Wahl mit Stimmzetteln.",
    seiten: [
      {
        pfad: "wahltag",
        label: "Wahlversammlung",
        rechte: ["voters.markVoted"],
      },
      {
        pfad: "stimmzettel",
        label: "Stimmzettel",
        rechte: ["nominations.edit", "voters.edit"],
      },
    ],
  },
  {
    key: "abschliessen",
    label: "Abschließen",
    kurz: "Ergebnis feststellen und bekanntmachen, Gewählte benachrichtigen, Daten fristgerecht löschen.",
    seiten: ergebnisSeiten,
  },
];

export function phasenFuer(verfahren: Verfahren): readonly PhaseDef[] {
  return verfahren === "wahlversammlung"
    ? PHASEN_WAHLVERSAMMLUNG
    : PHASEN_REGULAER;
}

export function seiteHref(base: string, pfad: string): string {
  return pfad.startsWith("/") ? pfad : `${base}/${pfad}`;
}

export function darfSeite(role: unknown, seite: Seite): boolean {
  return seite.rechte.some((r) => hasPermission(role, r));
}

/** Was bei einem Termin konkret zu tun ist und wo. */
export const SCHRITTE: Record<
  string,
  { phase: PhaseKey; aufgabe: string; pfad: string }
> = {
  stichtag_feststellung: {
    phase: "vorbereiten",
    aufgabe: "Zahl der Beschäftigten und Wahlberechtigten feststellen",
    pfad: "waehler",
  },
  wahlausschreiben: {
    phase: "einleiten",
    aufgabe: "Wahlausschreiben erlassen und in der Dienststelle aushängen",
    pfad: "wahlausschreiben",
  },
  auslage_beginn: {
    phase: "einleiten",
    aufgabe: "Wählerverzeichnis zur Einsicht auslegen",
    pfad: "waehler/auslage",
  },
  wahlvorschlaege_ende: {
    phase: "vorschlaege",
    aufgabe: "Wahlvorschläge annehmen – die Einreichungsfrist endet",
    pfad: "vorschlaege",
  },
  maengel_mitteilung: {
    phase: "vorschlaege",
    aufgabe: "Wahlvorschläge vorprüfen und Mängel mitteilen",
    pfad: "vorschlaege",
  },
  berichtigung_ende: {
    phase: "vorschlaege",
    aufgabe:
      "Berichtigte Wahlvorschläge annehmen und über die Zulassung beschließen",
    pfad: "vorschlaege",
  },
  nachfrist_ende: {
    phase: "vorschlaege",
    aufgabe: "Wahlvorschläge aus der Nachfrist annehmen",
    pfad: "vorschlaege/nachfrist",
  },
  bekanntmachung_vorschlaege: {
    phase: "vorschlaege",
    aufgabe: "Zugelassene Wahlvorschläge bekanntmachen",
    pfad: "vorschlaege/bekanntmachung",
  },
  auslage_ende: {
    phase: "einleiten",
    aufgabe: "Einsprüche annehmen – Auslage und Einspruchsfrist enden",
    pfad: "einsprueche",
  },
  einspruch_entscheidung: {
    phase: "einleiten",
    aufgabe:
      "Über alle Einsprüche entscheiden und die Entscheidungen mitteilen",
    pfad: "einsprueche",
  },
  wv_einladung: {
    phase: "einleiten",
    aufgabe: "Zur Wahlversammlung einladen",
    pfad: "einladung",
  },
  konstituierende_sitzung: {
    phase: "abschliessen",
    aufgabe: "Gewählte zur konstituierenden Sitzung einladen",
    pfad: "ergebnis/benachrichtigung",
  },
  aushang_ergebnis_ende: {
    phase: "abschliessen",
    aufgabe: "Wahlergebnis zwei Wochen aushängen",
    pfad: "ergebnis/bekanntmachung",
  },
  anfechtung_ende: {
    phase: "abschliessen",
    aufgabe:
      "Anfechtungsfrist abwarten, danach Wahl abschließen und Daten löschen",
    pfad: "/aufbewahrung",
  },
};

export interface Termin {
  id: string;
  key: string;
  datum: IsoDate;
  uhrzeit: string | null;
  label: string;
  erledigt: boolean;
}

export interface Schritt {
  /** Deadline-Id; null beim Wahltag */
  id: string | null;
  key: string;
  phase: PhaseKey;
  aufgabe: string;
  /** Bezeichnung des Termins im Wahlkalender */
  termin: string;
  datum: IsoDate;
  uhrzeit: string | null;
  pfad: string;
  erledigt: boolean;
  /** Wird automatisch abgehakt – Hinweis, wann (sonst undefined) */
  automatisch?: string;
}

export type PhasenStatus = "erledigt" | "aktuell" | "offen";

export interface Ablauf {
  phasen: (PhaseDef & { status: PhasenStatus; offen: number })[];
  aktuell: PhaseKey;
  schritte: Schritt[];
  /** Erster nicht erledigter Schritt in zeitlicher Reihenfolge */
  jetzt: Schritt | null;
}

export function berechneAblauf(args: {
  verfahren: Verfahren;
  termine: readonly Termin[];
  wahltag: IsoDate;
  ergebnisFestgestellt: boolean;
  heute: IsoDate;
}): Ablauf {
  const { verfahren, termine, wahltag, ergebnisFestgestellt, heute } = args;
  const phasen = phasenFuer(verfahren);
  const versammlung = verfahren === "wahlversammlung";

  const schritte: Schritt[] = termine.map((t) => {
    const s = SCHRITTE[t.key];
    return {
      id: t.id,
      key: t.key,
      phase: s?.phase ?? (t.datum <= wahltag ? "einleiten" : "abschliessen"),
      aufgabe: s?.aufgabe ?? t.label,
      termin: t.label,
      datum: t.datum,
      uhrzeit: t.uhrzeit,
      pfad: s?.pfad ?? "",
      erledigt: t.erledigt,
      automatisch: AUTO_HINWEIS[t.key],
    };
  });
  const vorWahl = heute <= wahltag;
  schritte.push({
    id: null,
    key: "wahltag",
    phase: "waehlen",
    aufgabe: vorWahl
      ? versammlung
        ? "Wahlversammlung durchführen"
        : "Wahl durchführen und Stimmabgabe vermerken"
      : "Stimmen auszählen und das Wahlergebnis feststellen",
    termin: versammlung ? "Wahlversammlung" : "Erster Wahltag",
    datum: wahltag,
    uhrzeit: null,
    pfad: vorWahl ? "wahltag" : "ergebnis",
    erledigt: ergebnisFestgestellt,
  });
  // Bei gleichem Datum: Wahltag nach den Terminen „vor“ dem Wahltag
  schritte.sort(
    (a, b) =>
      a.datum.localeCompare(b.datum) ||
      (a.key === "wahltag" ? 1 : b.key === "wahltag" ? -1 : 0),
  );

  const jetzt = schritte.find((s) => !s.erledigt) ?? null;
  const aktuell: PhaseKey = jetzt?.phase ?? "abschliessen";
  const reihenfolge = phasen.map((p) => p.key);
  const idxAktuell = reihenfolge.indexOf(aktuell);

  // Phasen überschneiden sich zeitlich (z. B. Auslage nach der Einreichungsfrist). Daher:
  // aktuell = Phase des nächsten Schritts; erledigt = alle Schritte der Phase erledigt;
  // Phasen ohne Termine gelten als erledigt, sobald eine spätere Phase aktuell ist.
  return {
    phasen: phasen.map((p, i) => {
      const eigene = schritte.filter((s) => s.phase === p.key);
      const offen = eigene.filter((s) => !s.erledigt).length;
      const status: PhasenStatus =
        jetzt && p.key === aktuell
          ? "aktuell"
          : eigene.length === 0
            ? i < idxAktuell || !jetzt
              ? "erledigt"
              : "offen"
            : offen === 0
              ? "erledigt"
              : "offen";
      return { ...p, offen, status };
    }),
    aktuell,
    schritte,
    jetzt,
  };
}

/** Arbeitstage nach heute bis einschließlich zum Datum (§ 55 LPVGWO). */
export function arbeitstageBis(heute: IsoDate, datum: IsoDate): number {
  let n = 0;
  for (let d = addDays(heute, 1); d <= datum; d = addDays(d, 1))
    if (isWorkday(d)) n++;
  return n;
}

function tageZwischen(von: IsoDate, bis: IsoDate): number {
  return Math.round(
    (Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Lesbarer Abstand zum Termin, z. B. „heute“, „morgen“, „in 5 Arbeitstagen“, „seit 3 Tagen überfällig“. */
export function fristText(
  heute: IsoDate,
  datum: IsoDate,
): { text: string; ton: "ueberfaellig" | "heute" | "bald" | "normal" } {
  const tage = tageZwischen(heute, datum);
  if (tage < 0)
    return {
      text:
        tage === -1
          ? "seit gestern überfällig"
          : `seit ${-tage} Tagen überfällig`,
      ton: "ueberfaellig",
    };
  if (tage === 0) return { text: "heute", ton: "heute" };
  if (tage === 1) return { text: "morgen", ton: "bald" };
  const at = arbeitstageBis(heute, datum);
  return {
    text: `in ${at} ${at === 1 ? "Arbeitstag" : "Arbeitstagen"} (${tage} Tage)`,
    ton: at <= 3 ? "bald" : "normal",
  };
}
