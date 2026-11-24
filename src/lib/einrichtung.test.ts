import { describe, expect, it } from "vitest";
import { bereitZumAbschluss, einrichtungsSchritte } from "./einrichtung";

const vollstaendig = {
  ausstellungsort: "Musterstadt",
  dienstschluss: "16:00",
  einreichungsstelle: "Raum 2.14",
  bekanntmachungsort: "Foyer",
  auslageOrt: "Raum 2.14",
  auslageZeiten: "Mo–Fr 8–15 Uhr",
  wahlraum: "Raum 1.01",
  wahlzeitVon: "08:00",
  wahlzeitBis: "15:00",
  auszaehlungZeit: "15:30",
  auszaehlungOrt: "Raum 1.01",
  wahlvorstand: [
    { name: "A", funktion: "vorsitz" as const, prWaehlbar: true },
    { name: "B", funktion: "stellvertretung" as const },
    { name: "C", funktion: "mitglied" as const },
  ],
};

describe("Einrichtungsassistent", () => {
  it("verlangt alle Pflichtangaben", () => {
    const s = einrichtungsSchritte({
      verfahren: "regulaer",
      angaben: {},
      stuetzunterschriftenMin: null,
      datenschutzVollstaendig: false,
    });
    expect(s.map((x) => x.key)).toEqual([
      "grunddaten",
      "wahlvorstand",
      "orte",
      "unterschriften",
      "datenschutz",
      "abschluss",
    ]);
    expect(bereitZumAbschluss(s)).toBe(false);
    expect(s.find((x) => x.key === "wahlvorstand")?.fehlt).toHaveLength(3);
  });
  it("ist bereit, wenn alles vorliegt", () => {
    const s = einrichtungsSchritte({
      verfahren: "regulaer",
      angaben: vollstaendig,
      stuetzunterschriftenMin: 2,
      datenschutzVollstaendig: true,
    });
    expect(bereitZumAbschluss(s)).toBe(true);
  });
  it("braucht bei der Wahlversammlung keine Stützunterschriften und weniger Angaben", () => {
    const s = einrichtungsSchritte({
      verfahren: "wahlversammlung",
      angaben: {
        ausstellungsort: "X",
        wahlraum: "Y",
        wahlzeitVon: "10:00",
        bekanntmachungsort: "Z",
        einreichungsstelle: "W",
        wahlvorstand: vollstaendig.wahlvorstand,
      },
      stuetzunterschriftenMin: null,
      datenschutzVollstaendig: true,
    });
    expect(s.some((x) => x.key === "unterschriften")).toBe(false);
    expect(bereitZumAbschluss(s)).toBe(true);
  });
});
