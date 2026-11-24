import { describe, expect, it } from "vitest";
import { berechneWahlakte, nummeriere, type AkteEingabe } from "./wahlakte";

const basis: AkteEingabe = {
  verfahren: "regulaer",
  ergebnisFestgestellt: true,
  wahlausschreibenFreigegeben: true,
  nachfristBekanntgemacht: false,
  einsprueche: 0,
  einspruecheOffen: 0,
  wahlvorschlaege: 2,
  vorschlaegeBeanstandet: 0,
  briefwahlAntraege: 0,
  gewaehlte: 3,
};

const keys = (e: AkteEingabe) => berechneWahlakte(e).flatMap((a) => a.eintraege.map((x) => x.key));
const eintrag = (e: AkteEingabe, key: string) => berechneWahlakte(e).flatMap((a) => a.eintraege).find((x) => x.key === key);

describe("Wahlakte im regulären Verfahren", () => {
  it("enthält die Kernunterlagen", () => {
    const k = keys(basis);
    for (const key of ["wahlausschreiben", "auslage", "vorschlaege", "vorschlaege_bekanntmachung", "vermerke", "stimmzettel", "niederschrift", "ergebnis_bekanntmachung", "benachrichtigung"]) {
      expect(k).toContain(key);
    }
    expect(k).not.toContain("einladung");
  });
  it("nimmt Einsprüche, Beanstandungen, Nachfrist und Briefwahl nur auf, wenn es sie gab", () => {
    const ohne = keys(basis);
    for (const key of ["einsprueche", "vorschlaege_schreiben", "nachfrist", "briefwahl"]) expect(ohne).not.toContain(key);
    const mit = keys({ ...basis, einsprueche: 1, vorschlaegeBeanstandet: 1, nachfristBekanntgemacht: true, briefwahlAntraege: 4 });
    for (const key of ["einsprueche", "vorschlaege_schreiben", "nachfrist", "briefwahl"]) expect(mit).toContain(key);
    expect(eintrag({ ...basis, briefwahlAntraege: 4 }, "briefwahl")?.anzahl).toBe(4);
  });
  it("markiert Unvollständiges als offen", () => {
    const e = { ...basis, ergebnisFestgestellt: false, wahlausschreibenFreigegeben: false, einspruecheOffen: 2 };
    expect(eintrag(e, "niederschrift")?.offen).toBeTruthy();
    expect(eintrag(e, "wahlausschreiben")?.offen).toBeTruthy();
    expect(eintrag(e, "einsprueche")?.offen).toContain("2");
    expect(eintrag(basis, "niederschrift")?.offen).toBeUndefined();
  });
});

describe("Wahlakte bei der Wahlversammlung", () => {
  it("enthält die Einladung statt Wahlausschreiben und keine Bekanntmachung der Vorschläge", () => {
    const k = keys({ ...basis, verfahren: "wahlversammlung", wahlvorschlaege: 0 });
    expect(k).toContain("einladung");
    expect(k).not.toContain("wahlausschreiben");
    expect(k).not.toContain("vorschlaege");
    expect(k).not.toContain("vorschlaege_bekanntmachung");
  });
});

describe("Nummerierung", () => {
  it("zählt fortlaufend über alle Abschnitte", () => {
    const a = berechneWahlakte(basis);
    const nr = nummeriere(a);
    expect(nr.get("bestellung")).toBe(1);
    expect(nr.size).toBe(a.flatMap((x) => x.eintraege).length);
    expect(Math.max(...nr.values())).toBe(nr.size);
  });
});
