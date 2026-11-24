import { describe, expect, it } from "vitest";
import {
  bestimmeWahlverfahren,
  dHondt,
  mehrheitswahl,
  pruefeZahlen,
  verhaeltniswahl,
} from "./ergebnis";

const liste = (id: string, stimmen: number, n: number) => ({
  id,
  stimmen,
  bewerber: Array.from({ length: n }, (_, i) => `${id}${i + 1}`),
});

describe("d'Hondt", () => {
  it("verteilt 5 Sitze nach Höchstzahlen", () => {
    // A 100: 100, 50, 33.3 · B 60: 60, 30 · C 25: 25
    const r = dHondt(
      [liste("A", 100, 5), liste("B", 60, 5), liste("C", 25, 5)],
      5,
    );
    expect(r.sitzeJeListe).toEqual({ A: 3, B: 2, C: 0 });
    expect(r.gewaehlt).toEqual(["A1", "A2", "A3", "B1", "B2"]);
    expect(r.ersatzJeListe.C).toEqual(["C1", "C2", "C3", "C4", "C5"]);
    expect(r.los).toBeNull();
  });

  it("gibt Sitze weiter, wenn eine Liste zu wenige Bewerber hat", () => {
    const r = dHondt([liste("A", 100, 1), liste("B", 20, 5)], 3);
    expect(r.sitzeJeListe).toEqual({ A: 1, B: 2 });
  });

  it("verlangt bei Gleichstand an der Sitzgrenze ein Los", () => {
    const r = dHondt([liste("A", 10, 3), liste("B", 10, 3)], 3);
    expect(r.los).toEqual({ ids: ["A", "B"], plaetze: 1 });
  });

  it("übernimmt das Ergebnis des Losentscheids", () => {
    const r = dHondt([liste("A", 10, 3), liste("B", 10, 3)], 3, ["B", "A"]);
    expect(r.los).toBeNull();
    expect(r.sitzeJeListe).toEqual({ A: 1, B: 2 });
  });

  it("rechnet ohne Rundungsfehler (6/3 = 2/1)", () => {
    const r = dHondt([liste("A", 6, 3), liste("B", 2, 3)], 3);
    expect(r.los).toEqual({ ids: ["A", "B"], plaetze: 1 });
  });

  it("meldet unbesetzte Sitze", () => {
    expect(dHondt([liste("A", 10, 1)], 3).unbesetzt).toBe(2);
  });
});

describe("Mehrheitswahl", () => {
  const k = (id: string, stimmen: number) => ({ id, stimmen });
  it("wählt die meisten Stimmen, Rest wird Ersatz", () => {
    const r = mehrheitswahl([k("a", 5), k("b", 9), k("c", 7), k("d", 0)], 2);
    expect(r.gewaehlt).toEqual(["b", "c"]);
    expect(r.ersatz).toEqual(["a"]);
    expect(r.ohneStimmen).toEqual(["d"]);
    expect(r.los).toBeNull();
  });
  it("verlangt bei Gleichstand an der Grenze ein Los und übernimmt es", () => {
    const kandidaten = [k("a", 9), k("b", 7), k("c", 7)];
    expect(mehrheitswahl(kandidaten, 2).los).toEqual({
      ids: ["b", "c"],
      plaetze: 1,
    });
    const r = mehrheitswahl(kandidaten, 2, ["c", "b"]);
    expect(r.los).toBeNull();
    expect(r.gewaehlt).toEqual(["a", "c"]);
    expect(r.ersatz).toEqual(["b"]);
  });
  it("kein Los bei Gleichstand innerhalb der Gewählten", () => {
    expect(mehrheitswahl([k("a", 7), k("b", 7), k("c", 3)], 2).los).toBeNull();
  });
});

describe("Verfahren und Plausibilität", () => {
  it("bestimmt das Wahlverfahren", () => {
    expect(bestimmeWahlverfahren("regulaer", 0)).toBeNull();
    expect(bestimmeWahlverfahren("regulaer", 1)).toBe("mehrheit");
    expect(bestimmeWahlverfahren("regulaer", 2)).toBe("verhaeltnis");
    // JAV aus einer Person: einfache Stimmenmehrheit, auch bei mehreren Vorschlägen (§ 13 Abs. 3 Satz 3 LPVG)
    expect(bestimmeWahlverfahren("regulaer", 2, 1)).toBe("mehrheit");
    expect(bestimmeWahlverfahren("regulaer", 2, 3)).toBe("verhaeltnis");
    expect(bestimmeWahlverfahren("wahlversammlung", 0)).toBe("mehrheit");
  });
  it("prüft die Zahlen", () => {
    const base = {
      wahlverfahren: "verhaeltnis" as const,
      sitze: 3,
      stimmzettelGesamt: 20,
      stimmzettelUngueltig: 2,
      vermerkteStimmabgaben: 20,
      summeStimmen: 18,
    };
    expect(pruefeZahlen(base)).toEqual({ fehler: [], hinweise: [] });
    // 18 gültige Stimmzettel × 3 Stimmen = höchstens 54
    expect(pruefeZahlen({ ...base, summeStimmen: 54 }).fehler).toEqual([]);
    expect(pruefeZahlen({ ...base, summeStimmen: 55 }).fehler).toHaveLength(1);
    // kumulieren: höchstens 3 Stimmen je Stimmzettel für eine Person
    expect(pruefeZahlen({ ...base, maxBewerberStimmen: 54 }).fehler).toEqual(
      [],
    );
    expect(
      pruefeZahlen({ ...base, maxBewerberStimmen: 55 }).fehler,
    ).toHaveLength(1);
    // Mehrheitswahl: höchstens 1 Stimme je Stimmzettel für eine Person
    expect(
      pruefeZahlen({
        ...base,
        wahlverfahren: "mehrheit",
        maxBewerberStimmen: 19,
      }).fehler,
    ).toHaveLength(1);
    expect(
      pruefeZahlen({ ...base, vermerkteStimmabgaben: 19 }).hinweise,
    ).toHaveLength(1);
    expect(
      pruefeZahlen({ ...base, wahlverfahren: "mehrheit", summeStimmen: 55 })
        .fehler,
    ).toHaveLength(1);
    expect(
      pruefeZahlen({ ...base, stimmzettelUngueltig: 21 }).fehler.length,
    ).toBeGreaterThan(0);
  });
});

describe("Verhältniswahl nach BW-Recht (§§ 33, 37, 38 LPVGWO)", () => {
  const v = (id: string, ...stimmen: number[]) => ({
    id,
    bewerber: stimmen.map((s, i) => ({ id: `${id}${i + 1}`, stimmen: s })),
  });

  it("summiert die Personenstimmen je Vorschlag und vergibt Sitze nach persönlichen Stimmen", () => {
    // A: 10 + 25 + 4 = 39 · B: 20 + 3 = 23 → Höchstzahlen 39 (A), 23 (B), 19,5 (A)
    const r = verhaeltniswahl([v("A", 10, 25, 4), v("B", 20, 3)], 3);
    expect(r.sitzeJeListe).toEqual({ A: 2, B: 1 });
    expect(r.gewaehlt).toEqual(["A2", "A1", "B1"]);
    expect(r.ersatzJeListe).toEqual({ A: ["A3"], B: ["B2"] });
  });
  it("entscheidet Gleichstand innerhalb eines Vorschlags nach der Reihenfolge im Vorschlag", () => {
    const r = verhaeltniswahl([v("A", 5, 5), v("B", 4)], 3);
    expect(r.gewaehlt.slice(0, 2)).toEqual(["A1", "A2"]);
    const s = verhaeltniswahl([v("A", 2, 7, 7), v("B", 30, 1)], 3);
    // A 16, B 31 → Höchstzahlen 31 (B), 16 (A), 15,5 (B); in A Gleichstand 7:7 → Platz 2 vor Platz 3
    expect(s.sitzeJeListe).toEqual({ A: 1, B: 2 });
    expect(s.gewaehlt).toEqual(["A2", "B1", "B2"]);
  });
  it("gibt überzählige Sitze an die nächsten Höchstzahlen weiter (§ 37 Abs. 3)", () => {
    const r = verhaeltniswahl([v("A", 50), v("B", 6, 4)], 3);
    expect(r.sitzeJeListe).toEqual({ A: 1, B: 2 });
    expect(r.unbesetzt).toBe(0);
  });
});
