/**
 * Ermittlung der Gewählten. Reine Funktionen ohne Abhängigkeiten.
 *
 * - Verhältniswahl (mehrere gültige Wahlvorschläge, mindestens 3 Sitze) nach §§ 33, 37, 38 LPVGWO:
 *   Gewählt werden Personen. Jede wählende Person hat so viele Stimmen, wie Sitze zu vergeben sind,
 *   und darf panaschieren und einem Bewerber bis zu drei Stimmen geben (kumulieren).
 *   Die Stimmen aller Bewerber eines Vorschlags ergeben dessen Gesamtstimmenzahl; die Sitze werden
 *   nach d'Hondt auf die Vorschläge verteilt und innerhalb eines Vorschlags nach den persönlichen
 *   Stimmen vergeben (bei Gleichstand nach der Reihenfolge im Vorschlag, § 37 Abs. 2).
 *   Die JAV wird in gemeinsamer Wahl ohne Gruppen gewählt (§ 54 Abs. 1 Nr. 1, 2 LPVGWO).
 * - Mehrheitswahl (ein gültiger Vorschlag, eine zu wählende Person oder Wahlversammlung;
 *   § 13 Abs. 3 LPVG, § 43 LPVGWO): die meisten Stimmen gewinnen.
 * Bei Gleichstand an der Sitzgrenze entscheidet das Los; das Ergebnis des Losentscheids wird als
 * Reihenfolge der Ids übergeben (`losReihenfolge`, vorne = gewinnt).
 */

export type Wahlverfahren = "verhaeltnis" | "mehrheit";

export interface LosBedarf {
  /** Beteiligte (Listen-Ids bei Verhältniswahl, Bewerber-Ids bei Mehrheitswahl) */
  ids: string[];
  /** Wie viele Sitze innerhalb dieser Gruppe zu vergeben sind */
  plaetze: number;
}

export interface Liste {
  id: string;
  stimmen: number;
  /** Bewerber-Ids in der Reihenfolge des Wahlvorschlags */
  bewerber: string[];
  /**
   * Persönliche Stimmen je Bewerber. Wenn angegeben, werden die Sitze innerhalb der Liste nach diesen
   * Stimmen vergeben, bei Gleichstand nach der Reihenfolge im Vorschlag (§ 37 Abs. 2 LPVGWO).
   */
  bewerberStimmen?: Readonly<Record<string, number>>;
}

export interface Hoechstzahl {
  listeId: string;
  teiler: number;
  stimmen: number;
  /** Laufende Sitznummer (1 …) oder null, wenn kein Sitz */
  sitz: number | null;
}

export interface VerhaeltnisErgebnis {
  sitzeJeListe: Record<string, number>;
  gewaehlt: string[];
  /** Ersatzmitglieder je Liste in Reihenfolge */
  ersatzJeListe: Record<string, string[]>;
  hoechstzahlen: Hoechstzahl[];
  los: LosBedarf | null;
  unbesetzt: number;
}

/** Vergleich a/ta mit b/tb exakt (ohne Gleitkomma): positiv, wenn a/ta größer. */
function vergleicheQuotient(a: number, ta: number, b: number, tb: number): number {
  return a * tb - b * ta;
}

function losIndex(losReihenfolge: readonly string[], id: string): number {
  const i = losReihenfolge.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Gleichstand an der Sitzgrenze ermitteln, sofern er nicht durch das Los entschieden ist. */
function grenzGleichstand<T>(
  sortiert: T[],
  sitze: number,
  gleich: (a: T, b: T) => boolean,
  id: (x: T) => string,
  losReihenfolge: readonly string[],
): LosBedarf | null {
  if (sitze <= 0 || sortiert.length <= sitze) return null;
  const letzter = sortiert[sitze - 1]!;
  const erster = sortiert[sitze]!;
  if (!gleich(letzter, erster)) return null;
  const gruppe = sortiert.filter((x) => gleich(x, letzter));
  const ids = [...new Set(gruppe.map(id))].sort();
  if (ids.every((x) => losReihenfolge.includes(x))) return null;
  const plaetze = sortiert.slice(0, sitze).filter((x) => gleich(x, letzter)).length;
  return { ids, plaetze };
}

export function dHondt(listen: readonly Liste[], sitze: number, losReihenfolge: readonly string[] = []): VerhaeltnisErgebnis {
  const quotienten: Hoechstzahl[] = [];
  for (const l of listen) {
    if (l.stimmen <= 0) continue;
    // Eine Liste kann höchstens so viele Sitze erhalten, wie sie Bewerber hat.
    for (let t = 1; t <= Math.min(sitze, l.bewerber.length); t++) {
      quotienten.push({ listeId: l.id, teiler: t, stimmen: l.stimmen, sitz: null });
    }
  }
  quotienten.sort(
    (a, b) =>
      -vergleicheQuotient(a.stimmen, a.teiler, b.stimmen, b.teiler) ||
      losIndex(losReihenfolge, a.listeId) - losIndex(losReihenfolge, b.listeId) ||
      a.teiler - b.teiler,
  );

  const los = grenzGleichstand(
    quotienten,
    sitze,
    (a, b) => vergleicheQuotient(a.stimmen, a.teiler, b.stimmen, b.teiler) === 0,
    (q) => q.listeId,
    losReihenfolge,
  );

  const sitzeJeListe: Record<string, number> = Object.fromEntries(listen.map((l) => [l.id, 0]));
  quotienten.slice(0, sitze).forEach((q, i) => {
    q.sitz = i + 1;
    sitzeJeListe[q.listeId] = (sitzeJeListe[q.listeId] ?? 0) + 1;
  });

  const gewaehlt: string[] = [];
  const ersatzJeListe: Record<string, string[]> = {};
  for (const l of listen) {
    const n = sitzeJeListe[l.id] ?? 0;
    const bs = l.bewerberStimmen;
    const reihenfolge = bs
      ? [...l.bewerber].sort((a, b) => (bs[b] ?? 0) - (bs[a] ?? 0) || l.bewerber.indexOf(a) - l.bewerber.indexOf(b))
      : l.bewerber;
    gewaehlt.push(...reihenfolge.slice(0, n));
    ersatzJeListe[l.id] = reihenfolge.slice(n);
  }

  return {
    sitzeJeListe,
    gewaehlt,
    ersatzJeListe,
    hoechstzahlen: quotienten,
    los,
    unbesetzt: Math.max(0, sitze - Math.min(sitze, quotienten.length)),
  };
}

export interface Vorschlag {
  id: string;
  /** Bewerber in der Reihenfolge des Wahlvorschlags mit ihren persönlichen Stimmen */
  bewerber: { id: string; stimmen: number }[];
}

/**
 * Verhältniswahl nach BW-Recht (§§ 37, 38 LPVGWO): Gesamtstimmen je Vorschlag = Summe der Bewerberstimmen,
 * Sitzverteilung nach d'Hondt, Vergabe innerhalb des Vorschlags nach persönlichen Stimmen.
 * Überzählige Sitze eines Vorschlags mit zu wenigen Bewerbern gehen an die nächsten Höchstzahlen (§ 37 Abs. 3).
 */
export function verhaeltniswahl(vorschlaege: readonly Vorschlag[], sitze: number, losReihenfolge: readonly string[] = []): VerhaeltnisErgebnis {
  return dHondt(
    vorschlaege.map((v) => ({
      id: v.id,
      stimmen: v.bewerber.reduce((s, b) => s + b.stimmen, 0),
      bewerber: v.bewerber.map((b) => b.id),
      bewerberStimmen: Object.fromEntries(v.bewerber.map((b) => [b.id, b.stimmen])),
    })),
    sitze,
    losReihenfolge,
  );
}

export interface Kandidat {
  id: string;
  stimmen: number;
}

export interface MehrheitErgebnis {
  gewaehlt: string[];
  ersatz: string[];
  /** Bewerber ohne Stimme – weder gewählt noch Ersatz */
  ohneStimmen: string[];
  los: LosBedarf | null;
  unbesetzt: number;
}

export function mehrheitswahl(kandidaten: readonly Kandidat[], sitze: number, losReihenfolge: readonly string[] = []): MehrheitErgebnis {
  const mitStimmen = kandidaten
    .filter((k) => k.stimmen > 0)
    .sort((a, b) => b.stimmen - a.stimmen || losIndex(losReihenfolge, a.id) - losIndex(losReihenfolge, b.id));
  const los = grenzGleichstand(mitStimmen, sitze, (a, b) => a.stimmen === b.stimmen, (k) => k.id, losReihenfolge);
  return {
    gewaehlt: mitStimmen.slice(0, sitze).map((k) => k.id),
    ersatz: mitStimmen.slice(sitze).map((k) => k.id),
    ohneStimmen: kandidaten.filter((k) => k.stimmen <= 0).map((k) => k.id),
    los,
    unbesetzt: Math.max(0, sitze - mitStimmen.length),
  };
}

/**
 * Welches Verfahren gilt? null = keine Wahl möglich (kein gültiger Vorschlag).
 * § 13 Abs. 3 LPVG i. V. m. § 62 Abs. 1: Verhältniswahl; bei nur einem Wahlvorschlag Mehrheitswahl;
 * besteht die JAV aus einer Person, wird sie mit einfacher Stimmenmehrheit gewählt. Wahlversammlung: Mehrheitswahl.
 */
export function bestimmeWahlverfahren(
  verfahren: "regulaer" | "wahlversammlung",
  gueltigeVorschlaege: number,
  sitze = 3,
): Wahlverfahren | null {
  if (verfahren === "wahlversammlung") return "mehrheit";
  if (gueltigeVorschlaege === 0) return null;
  return gueltigeVorschlaege === 1 || sitze <= 1 ? "mehrheit" : "verhaeltnis";
}

/** Höchstzahl der Stimmen für eine Person: Verhältniswahl bis zu 3 (kumulieren, § 33), Mehrheitswahl 1 (§ 40). */
export function maxStimmenJeBewerber(wahlverfahren: Wahlverfahren): number {
  return wahlverfahren === "verhaeltnis" ? 3 : 1;
}

export interface ZahlenInput {
  wahlverfahren: Wahlverfahren;
  sitze: number;
  stimmzettelGesamt: number;
  stimmzettelUngueltig: number;
  /** Laut Wählerverzeichnis vermerkte Stimmabgaben */
  vermerkteStimmabgaben: number;
  /** Summe der gültigen Bewerberstimmen */
  summeStimmen: number;
  /** Höchste Stimmenzahl einer einzelnen Person */
  maxBewerberStimmen?: number;
}

export interface ZahlenPruefung {
  fehler: string[];
  hinweise: string[];
}

export function pruefeZahlen(i: ZahlenInput): ZahlenPruefung {
  const fehler: string[] = [];
  const hinweise: string[] = [];
  const gueltig = i.stimmzettelGesamt - i.stimmzettelUngueltig;
  if (i.stimmzettelGesamt < 0 || i.stimmzettelUngueltig < 0) fehler.push("Zahlen dürfen nicht negativ sein.");
  if (gueltig < 0) fehler.push("Es gibt mehr ungültige Stimmzettel als Stimmzettel insgesamt.");
  if (i.stimmzettelGesamt !== i.vermerkteStimmabgaben) {
    hinweise.push(
      `Stimmzettel in der Urne (${i.stimmzettelGesamt}) und Vermerke im Wählerverzeichnis (${i.vermerkteStimmabgaben}) weichen voneinander ab – in der Niederschrift erläutern.`,
    );
  }
  // Jede wählende Person hat so viele Stimmen, wie Sitze zu vergeben sind (§ 20 Abs. 4 LPVGWO)
  if (gueltig >= 0 && i.summeStimmen > gueltig * i.sitze) {
    fehler.push(`Mehr Stimmen (${i.summeStimmen}) als möglich (${gueltig} gültige Stimmzettel × ${i.sitze} ${i.sitze === 1 ? "Stimme" : "Stimmen"}).`);
  }
  const proPerson = maxStimmenJeBewerber(i.wahlverfahren);
  if (gueltig >= 0 && i.maxBewerberStimmen != null && i.maxBewerberStimmen > gueltig * proPerson) {
    fehler.push(
      `Eine Person hat ${i.maxBewerberStimmen} Stimmen – höchstens möglich sind ${gueltig * proPerson} (${gueltig} gültige Stimmzettel × ${proPerson}).`,
    );
  }
  if (gueltig > 0 && i.summeStimmen === 0) hinweise.push("Es sind noch keine Stimmen eingetragen.");
  return { fehler, hinweise };
}
