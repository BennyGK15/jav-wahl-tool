import { describe, expect, it } from "vitest";
import {
  angabenVollstaendig,
  aufgabenStatus,
  einreichungStatus,
} from "./datenschutz";

describe("Einreichung der Datenschutz-Unterlagen", () => {
  it("ohne Einreichung offen", () => {
    expect(einreichungStatus(null, new Date())).toEqual({ art: "offen" });
  });
  it("eingereicht, solange die Angaben danach nicht geändert wurden", () => {
    const s = einreichungStatus(
      { eingereichtAm: "2026-11-24T10:00:00.000Z", von: "u1", anmerkung: "" },
      new Date("2026-11-24T09:59:00.000Z"),
    );
    expect(s.art).toBe("eingereicht");
    if (s.art !== "offen") {
      expect(s.von).toBe("u1");
      expect(s.anmerkung).toBeNull();
    }
  });
  it("geändert, wenn die Angaben nach der Einreichung gespeichert wurden", () => {
    const s = einreichungStatus(
      { eingereichtAm: "2026-11-24T10:00:00.000Z", anmerkung: "passt" },
      new Date("2026-11-24T10:05:00.000Z"),
    );
    expect(s.art).toBe("geaendert");
    if (s.art !== "offen") expect(s.anmerkung).toBe("passt");
  });
  it("aktuelle Einreichung erledigt die Abstimmung der Folgenabschätzung", () => {
    const dsfa = (eingereicht: boolean, stand = {}) =>
      aufgabenStatus({}, stand, eingereicht).find((x) => x.key === "dsfa")!;
    expect(dsfa(false).erledigt).toBe(false);
    expect(dsfa(true)).toMatchObject({
      erledigt: true,
      durchEinreichung: true,
    });
    expect(
      dsfa(false, { dsfa: { erledigtAm: "2026-11-24T10:00:00.000Z" } }),
    ).toMatchObject({ erledigt: true, durchEinreichung: false });
    expect(
      aufgabenStatus({}, {}, true).find((x) => x.key === "personalrat")!
        .erledigt,
    ).toBe(false);
  });
  it("Pflichtangaben ohne Vorgabe müssen ausgefüllt sein", () => {
    expect(angabenVollstaendig({})).toBe(false);
    expect(
      angabenVollstaendig({
        verantwortlicheStelle: "a",
        anschrift: "b",
        leitung: "c",
        ansprechperson: "d",
        dsbName: "e",
        dsbKontakt: "f",
      }),
    ).toBe(true);
  });
});
