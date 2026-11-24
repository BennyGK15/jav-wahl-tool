import { describe, expect, it } from "vitest";
import {
  einspruchRechtzeitig,
  fristendeAus,
  hatFehler,
  pruefeWahlvorschlag,
  type PruefInput,
} from "./vorschlaege";

const base: PruefInput = {
  einreicherArt: "beschaeftigte",
  gewerkschaft: null,
  eingang: "2026-03-18 14:00",
  fristende: "2026-03-18 15:00",
  bewerber: [
    { name: "A", waehlbar: true, zustimmung: true, aufAnderenVorschlaegen: 0 },
  ],
  unterstuetzer: ["X", "Y", "Z"].map((name) => ({
    name,
    wahlberechtigt: true,
    aufAnderenVorschlaegen: 0,
  })),
  mindestUnterschriften: 3,
};

describe("Prüfprotokoll Wahlvorschlag", () => {
  it("akzeptiert einen vollständigen Vorschlag", () => {
    expect(hatFehler(pruefeWahlvorschlag(base))).toBe(false);
  });
  it("erkennt verspäteten Eingang", () => {
    expect(
      hatFehler(pruefeWahlvorschlag({ ...base, eingang: "2026-03-18 15:01" })),
    ).toBe(true);
  });
  it("prüft die Mindestzahl der Stützunterschriften", () => {
    expect(
      hatFehler(pruefeWahlvorschlag({ ...base, mindestUnterschriften: 4 })),
    ).toBe(true);
    const offen = pruefeWahlvorschlag({ ...base, mindestUnterschriften: null });
    expect(hatFehler(offen)).toBe(false);
    expect(offen.some((p) => p.status === "hinweis")).toBe(true);
  });
  it("zählt Unterschriften nicht Wahlberechtigter nicht", () => {
    const unterstuetzer = [
      ...base.unterstuetzer.slice(0, 2),
      { name: "Q", wahlberechtigt: false, aufAnderenVorschlaegen: 0 },
    ];
    expect(hatFehler(pruefeWahlvorschlag({ ...base, unterstuetzer }))).toBe(
      true,
    );
  });
  it("verlangt wählbare Bewerber mit Zustimmung", () => {
    expect(hatFehler(pruefeWahlvorschlag({ ...base, bewerber: [] }))).toBe(
      true,
    );
    expect(
      hatFehler(
        pruefeWahlvorschlag({
          ...base,
          bewerber: [
            {
              name: "A",
              waehlbar: false,
              zustimmung: true,
              aufAnderenVorschlaegen: 0,
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      hatFehler(
        pruefeWahlvorschlag({
          ...base,
          bewerber: [
            {
              name: "A",
              waehlbar: true,
              zustimmung: false,
              aufAnderenVorschlaegen: 0,
            },
          ],
        }),
      ),
    ).toBe(true);
  });
  it("braucht bei Gewerkschaften keine Unterschriften, aber den Namen", () => {
    expect(
      hatFehler(
        pruefeWahlvorschlag({
          ...base,
          einreicherArt: "gewerkschaft",
          gewerkschaft: "ver.di",
          unterstuetzer: [],
        }),
      ),
    ).toBe(false);
    expect(
      hatFehler(
        pruefeWahlvorschlag({
          ...base,
          einreicherArt: "gewerkschaft",
          gewerkschaft: " ",
          unterstuetzer: [],
        }),
      ),
    ).toBe(true);
  });
});

describe("Fristen für Einsprüche", () => {
  it("vergleicht Eingang und Fristende", () => {
    expect(fristendeAus("2026-04-09", null)).toBe("2026-04-09 23:59");
    expect(einspruchRechtzeitig("2026-05-18 16:00", "2026-05-18 15:00")).toBe(
      false,
    );
    expect(einspruchRechtzeitig("2026-05-18 16:00", null)).toBeNull();
  });
});
