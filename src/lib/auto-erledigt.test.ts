import { describe, expect, it } from "vitest";
import { autoErledigt, type AutoStand } from "./auto-erledigt";

const basis: AutoStand = {
  jetzt: "2026-12-09 10:00",
  fristende: {
    wahlvorschlaege_ende: "2026-12-08 16:00",
    berichtigung_ende: "2026-12-11 16:00",
    auslage_beginn: "2026-12-30 23:59",
    auslage_ende: "2027-01-18 16:00",
  },
  wahlausschreibenFreigegeben: true,
  ungepruefteVorschlaege: 0,
  offeneEinsprueche: 0,
  vorschlaegeBekanntmachungAm: null,
  auslageErzeugt: false,
};

describe("automatisch erledigt", () => {
  it("hakt Wahlausschreiben und Stichtag mit der Freigabe ab", () => {
    expect(autoErledigt("wahlausschreiben", basis)).toBe(true);
    expect(autoErledigt("stichtag_feststellung", { ...basis, wahlausschreibenFreigegeben: false })).toBe(false);
  });
  it("hakt Fristenden nach Ablauf ab – auf die Minute", () => {
    expect(autoErledigt("wahlvorschlaege_ende", basis)).toBe(true);
    expect(autoErledigt("berichtigung_ende", basis)).toBe(false);
    expect(autoErledigt("wahlvorschlaege_ende", { ...basis, jetzt: "2026-12-08 15:59" })).toBe(false);
  });
  it("Mängelmitteilung erst, wenn alle Vorschläge geprüft sind", () => {
    expect(autoErledigt("maengel_mitteilung", basis)).toBe(true);
    expect(autoErledigt("maengel_mitteilung", { ...basis, ungepruefteVorschlaege: 1 })).toBe(false);
  });
  it("Bekanntmachung zählt nur nach der letzten Vorschlagsfrist", () => {
    expect(autoErledigt("bekanntmachung_vorschlaege", { ...basis, vorschlaegeBekanntmachungAm: "2026-12-10 09:00" })).toBe(false);
    expect(autoErledigt("bekanntmachung_vorschlaege", { ...basis, vorschlaegeBekanntmachungAm: "2026-12-14 09:00" })).toBe(true);
  });
  it("Einsprüche erst nach Ende der Auslage und ohne offene Einsprüche", () => {
    const nach = { ...basis, jetzt: "2027-01-18 16:01" };
    expect(autoErledigt("einspruch_entscheidung", nach)).toBe(true);
    expect(autoErledigt("einspruch_entscheidung", { ...nach, offeneEinsprueche: 2 })).toBe(false);
  });
  it("Auslage: erzeugt und Termin erreicht", () => {
    expect(autoErledigt("auslage_beginn", { ...basis, auslageErzeugt: true })).toBe(false);
    expect(autoErledigt("auslage_beginn", { ...basis, auslageErzeugt: true, jetzt: "2026-12-30 08:00" })).toBe(true);
  });
  it("lässt Tätigkeiten außerhalb der App unberührt", () => {
    expect(autoErledigt("konstituierende_sitzung", basis)).toBeUndefined();
    expect(autoErledigt("wv_einladung", basis)).toBeUndefined();
  });
});
