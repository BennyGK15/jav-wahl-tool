import { describe, expect, it } from "vitest";
import {
  aushangStatus,
  berechneAushaenge,
  zeitleistenBereich,
  type AushangEingabe,
} from "./aushaenge";

const basis: AushangEingabe = {
  verfahren: "regulaer",
  heute: "2026-11-24",
  wahltag: "2027-01-20",
  wahlvorstandBestelltAm: "2026-10-01",
  wahlausschreibenAm: "2026-11-16",
  wahlausschreibenErlassen: true,
  wahlausschreibenFreigegeben: true,
  auslageBeginn: "2026-12-30",
  auslageEnde: "2027-01-18",
  bekanntmachungVorschlaege: "2027-01-13",
  nachfristBekanntgemachtAm: null,
  nachfristEnde: null,
  wvEinladung: null,
  ergebnisBekanntgabe: null,
  aushangErgebnisEnde: null,
  bekanntmachungsort: "Schwarzes Brett",
  auslageOrt: "Raum 0.04",
};

const nachKey = (e: AushangEingabe) =>
  Object.fromEntries(berechneAushaenge(e).map((a) => [a.key, a]));

describe("Status eines Aushangs", () => {
  it("unterscheidet vor, während und nach dem Zeitraum (Ende einschließlich)", () => {
    expect(
      aushangStatus("2026-12-01", "2026-12-02", "2026-12-10", "kommt"),
    ).toBe("kommt");
    expect(
      aushangStatus("2026-12-02", "2026-12-02", "2026-12-10", "kommt"),
    ).toBe("haengt");
    expect(
      aushangStatus("2026-12-10", "2026-12-02", "2026-12-10", "kommt"),
    ).toBe("haengt");
    expect(
      aushangStatus("2026-12-11", "2026-12-02", "2026-12-10", "kommt"),
    ).toBe("beendet");
  });
  it("nutzt ohne Beginn den Vorgabewert", () => {
    expect(aushangStatus("2026-12-01", null, null, "haengt")).toBe("haengt");
    expect(aushangStatus("2026-12-01", null, null, "kommt")).toBe("kommt");
  });
});

describe("Aushänge im regulären Verfahren", () => {
  it("listet alle Pflichtdokumente, die Nachfrist nur wenn bekanntgemacht", () => {
    expect(Object.keys(nachKey(basis))).toEqual([
      "wahlvorstand",
      "wahlausschreiben",
      "waehlerverzeichnis",
      "gesetzestexte",
      "wahlvorschlaege",
      "ergebnis",
    ]);
    const mitNachfrist = nachKey({
      ...basis,
      nachfristBekanntgemachtAm: "2026-12-10",
      nachfristEnde: "2026-12-18",
    });
    expect(mitNachfrist.nachfrist).toMatchObject({
      von: "2026-12-10",
      bis: "2026-12-18",
    });
  });
  it("leitet Zeiträume aus dem Wahlkalender ab", () => {
    const a = nachKey(basis);
    expect(a.wahlausschreiben).toMatchObject({
      von: "2026-11-16",
      bis: "2027-01-20",
      status: "haengt",
      ort: "Schwarzes Brett",
    });
    expect(a.waehlerverzeichnis).toMatchObject({
      von: "2026-12-30",
      bis: "2027-01-18",
      status: "kommt",
      ort: "Raum 0.04",
    });
    expect(a.wahlvorstand).toMatchObject({ status: "haengt", bis: null });
    expect(a.ergebnis).toMatchObject({ von: null, bis: null, status: "kommt" });
  });
  it("Wahlvorstand hängt bis zur Bekanntmachung des Ergebnisses, das Ergebnis zwei Wochen", () => {
    const a = nachKey({
      ...basis,
      heute: "2027-01-25",
      ergebnisBekanntgabe: "2027-01-21",
      aushangErgebnisEnde: "2027-02-04",
    });
    expect(a.wahlvorstand).toMatchObject({
      bis: "2027-01-21",
      status: "beendet",
    });
    expect(a.ergebnis).toMatchObject({
      von: "2027-01-21",
      bis: "2027-02-04",
      status: "haengt",
    });
    expect(a.wahlausschreiben!.status).toBe("beendet");
  });
  it("berechnet das Aushangende des Ergebnisses, wenn der Termin noch fehlt", () => {
    expect(
      nachKey({ ...basis, ergebnisBekanntgabe: "2027-01-21" }).ergebnis!.bis,
    ).toBe("2027-02-04");
  });
  it("weist auf ein nicht freigegebenes Wahlausschreiben hin", () => {
    expect(
      nachKey({ ...basis, wahlausschreibenFreigegeben: false })
        .wahlausschreiben!.hinweis,
    ).toMatch(/nicht freigegeben/);
  });
});

describe("Aushänge bei der Wahlversammlung", () => {
  it("enthält Einladung statt Wahlausschreiben und Wählerverzeichnis", () => {
    const a = nachKey({
      ...basis,
      verfahren: "wahlversammlung",
      wvEinladung: "2026-12-01",
    });
    expect(Object.keys(a)).toEqual(["wahlvorstand", "einladung", "ergebnis"]);
    expect(a.einladung).toMatchObject({
      von: "2026-12-01",
      bis: "2027-01-20",
      status: "kommt",
    });
  });
});

describe("Bereich der Zeitleiste", () => {
  it("reicht vom frühesten Beginn bis zum spätesten Ende", () => {
    const liste = berechneAushaenge({
      ...basis,
      ergebnisBekanntgabe: "2027-01-21",
      aushangErgebnisEnde: "2027-02-04",
    });
    expect(zeitleistenBereich(liste, basis.heute, basis.wahltag)).toEqual({
      von: "2026-10-01",
      bis: "2027-02-04",
    });
  });
});
