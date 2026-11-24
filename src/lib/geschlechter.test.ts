import { describe, expect, it } from "vitest";
import { anteileText, geschlechterSitze, pruefeGeschlechter, sitzeText } from "./geschlechter";

describe("Sitze für Frauen und Männer (§ 8 LPVGWO)", () => {
  it("gilt erst ab drei Mitgliedern", () => {
    expect(geschlechterSitze({ frauen: 5, maenner: 10 }, 1)).toBeNull();
  });
  it("verteilt nach d'Hondt", () => {
    // 10 Frauen, 25 Männer, 3 Sitze: Höchstzahlen 25 (M), 12,5 (M), 10 (F)
    expect(geschlechterSitze({ frauen: 10, maenner: 25 }, 3)).toMatchObject({ sitzeFrauen: 1, sitzeMaenner: 2, losOffen: false });
    // 7 Frauen, 23 Männer: 23, 11,5, 7,67 (M) → 0 Frauen
    expect(geschlechterSitze({ frauen: 7, maenner: 23 }, 3)).toMatchObject({ sitzeFrauen: 0, sitzeMaenner: 3 });
  });
  it("verlangt bei Gleichstand um den letzten Sitz das Los", () => {
    // 15:15 und 3 Sitze: 15 (F), 15 (M), 7,5 (F) = 7,5 (M) → Los
    expect(geschlechterSitze({ frauen: 15, maenner: 15 }, 3)?.losOffen).toBe(true);
    expect(geschlechterSitze({ frauen: 15, maenner: 15 }, 3, "m")).toMatchObject({ sitzeFrauen: 1, sitzeMaenner: 2, losOffen: false });
  });
  it("formuliert Anteile und Sitze", () => {
    expect(anteileText({ frauen: 12, maenner: 18, divers: 0, ohneAngabe: 0 })).toBe("12 Frauen (40 %) und 18 Männer (60 %)");
    expect(sitzeText({ sitzeFrauen: 1, sitzeMaenner: 2 })).toBe("1 Frau und 2 Männer");
  });
});

describe("Prüfung der Wahlvorschläge", () => {
  const v = { sitzeFrauen: 1, sitzeMaenner: 2 };
  it("akzeptiert ausreichende Benennung", () => {
    expect(pruefeGeschlechter({ verteilung: v, bewerber: [{ geschlecht: "w" }, { geschlecht: "m" }, { geschlecht: "m" }], begruendung: null }).status).toBe("ok");
  });
  it("verlangt sonst eine schriftliche Begründung", () => {
    const nurMaenner = [{ geschlecht: "m" as const }, { geschlecht: "m" as const }];
    expect(pruefeGeschlechter({ verteilung: v, bewerber: nurMaenner, begruendung: null }).status).toBe("fehler");
    expect(pruefeGeschlechter({ verteilung: v, bewerber: nurMaenner, begruendung: "Keine Kandidatin gefunden" }).status).toBe("ok");
  });
  it("weist auf fehlende Angaben hin", () => {
    expect(pruefeGeschlechter({ verteilung: v, bewerber: [{ geschlecht: null }, { geschlecht: "m" }], begruendung: null }).status).toBe("hinweis");
  });
});
