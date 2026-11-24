import { describe, expect, it } from "vitest";
import { loeschVorschlag } from "./aufbewahrung";

describe("Löschtermin nach § 32 LPVGWO", () => {
  it("ist ohne festgestelltes Ergebnis offen", () => {
    expect(
      loeschVorschlag({
        anfechtungsfristEnde: null,
        anfechtungAm: null,
        anfechtungErledigtAm: null,
      }).fruehestens,
    ).toBeNull();
  });
  it("liegt am Tag nach Ende der Anfechtungsfrist", () => {
    expect(
      loeschVorschlag({
        anfechtungsfristEnde: "2027-02-08",
        anfechtungAm: null,
        anfechtungErledigtAm: null,
      }).fruehestens,
    ).toBe("2027-02-09");
  });
  it("ist bei laufender Anfechtung gesperrt", () => {
    const v = loeschVorschlag({
      anfechtungsfristEnde: "2027-02-08",
      anfechtungAm: "2027-02-05",
      anfechtungErledigtAm: null,
    });
    expect(v.gesperrt).toBe(true);
    expect(v.fruehestens).toBeNull();
  });
  it("richtet sich nach dem Abschluss des Verfahrens", () => {
    expect(
      loeschVorschlag({
        anfechtungsfristEnde: "2027-02-08",
        anfechtungAm: "2027-02-05",
        anfechtungErledigtAm: "2027-06-30",
      }).fruehestens,
    ).toBe("2027-07-01");
  });
});
