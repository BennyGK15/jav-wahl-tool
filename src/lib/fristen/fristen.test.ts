import { describe, expect, it } from "vitest";
import {
  addWorkdays,
  computeSchedule,
  describeRule,
  easterSunday,
  holidaysBW,
  isWorkday,
  rulesFor,
  shiftToNextBusinessDay,
  subtractMonths,
  subtractWorkdays,
} from "./index";

describe("Feiertage BW", () => {
  it("berechnet Ostersonntag", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2024)).toBe("2024-03-31");
  });

  it("enthält die beweglichen Feiertage 2026", () => {
    const dates = holidaysBW(2026).map((h) => h.date);
    expect(dates).toContain("2026-04-03"); // Karfreitag
    expect(dates).toContain("2026-04-06"); // Ostermontag
    expect(dates).toContain("2026-05-14"); // Christi Himmelfahrt
    expect(dates).toContain("2026-05-25"); // Pfingstmontag
    expect(dates).toContain("2026-06-04"); // Fronleichnam
    expect(dates).toHaveLength(12);
  });
});

describe("Arbeitstage", () => {
  it("schließt Wochenende, Feiertage, Heiligabend und Silvester aus", () => {
    expect(isWorkday("2026-03-02")).toBe(true); // Montag
    expect(isWorkday("2026-03-07")).toBe(false); // Samstag
    expect(isWorkday("2026-04-03")).toBe(false); // Karfreitag
    expect(isWorkday("2026-12-24")).toBe(false); // Donnerstag, Heiligabend
    expect(isWorkday("2026-12-31")).toBe(false); // Donnerstag, Silvester
    expect(isWorkday("2026-12-24", { excludeChristmasEveAndNewYearsEve: false })).toBe(true);
  });

  it("zählt 12 Arbeitstage ab Erlass ohne den Erlasstag (Beispiel der Arbeitsunterlage)", () => {
    expect(addWorkdays("2026-03-02", 12)).toBe("2026-03-18");
  });

  it("findet den 12. und 2. Arbeitstag vor dem Wahltag (Beispiel der Arbeitsunterlage)", () => {
    expect(subtractWorkdays("2026-03-30", 12)).toBe("2026-03-12");
    expect(subtractWorkdays("2026-03-30", 2)).toBe("2026-03-26");
  });

  it("überspringt Feiertage über Ostern", () => {
    // Mi 01.04. + 2 Arbeitstage: Do 02.04. (1), Karfreitag und Wochenende, Ostermontag frei, Di 07.04. (2)
    expect(addWorkdays("2026-04-01", 2)).toBe("2026-04-07");
  });

  it("überspringt den Jahreswechsel", () => {
    // Mi 23.12.2026 + 1: 24.12. frei, 25./26. Feiertag, 27. Sonntag → Mo 28.12.
    expect(addWorkdays("2026-12-23", 1)).toBe("2026-12-28");
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(() => addWorkdays("2026-02-30", 1)).toThrow();
    expect(() => addWorkdays("2026-03-02", 0)).toThrow();
  });
});

describe("Monatsfristen und § 193 BGB", () => {
  it("rechnet Monate zurück", () => {
    expect(subtractMonths("2026-05-20", 2)).toBe("2026-03-20");
    expect(subtractMonths("2026-04-30", 2)).toBe("2026-02-28");
    expect(subtractMonths("2026-01-15", 2)).toBe("2025-11-15");
  });

  it("verschiebt ein Fristende vom Wochenende auf den nächsten Werktag", () => {
    expect(shiftToNextBusinessDay("2026-03-07")).toBe("2026-03-09");
    expect(shiftToNextBusinessDay("2026-04-03")).toBe("2026-04-07");
  });
});

describe("Wahlkalender", () => {
  it("berechnet alle Fristen vom Wahltag aus", () => {
    const schedule = computeSchedule("2026-05-20");
    const byKey = Object.fromEntries(schedule.map((e) => [e.key, e.date]));
    expect(byKey.wahlausschreiben).toBe("2026-03-20");
    expect(byKey.wahlvorschlaege_ende).toBe("2026-04-09");
    expect(byKey.auslage_ende).toBe("2026-05-18");
    // alle Standardregeln sind abgeglichen – außer der Empfehlung zur konstituierenden Sitzung
    expect(schedule.filter((e) => !e.verified).map((e) => e.key)).toEqual(["konstituierende_sitzung"]);
    const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
    expect(schedule).toEqual(sorted);
  });

  it("rechnet ab einem früheren tatsächlichen Wahlausschreiben", () => {
    const schedule = computeSchedule("2026-05-20", undefined, { wahlausschreibenAm: "2026-03-02" });
    const ende = schedule.find((e) => e.key === "wahlvorschlaege_ende");
    expect(ende?.date).toBe("2026-03-18");
  });

  it("verweigert ein zu spätes Wahlausschreiben", () => {
    expect(() => computeSchedule("2026-05-20", undefined, { wahlausschreibenAm: "2026-04-01" })).toThrow(/zu spät/);
  });
});

describe("Wahlversammlung", () => {
  const rules = rulesFor("wahlversammlung");

  it("lädt spätestens 4 Wochen vor Amtszeitende ein, zurück auf den letzten Arbeitstag", () => {
    // 31.01.2027 (So) − 4 Wochen = 03.01.2027 (So) → Sa, Neujahr, Silvester übersprungen → Mi 30.12.2026
    const schedule = computeSchedule("2027-01-20", rules, { amtszeitEnde: "2027-01-31" });
    expect(schedule.find((e) => e.key === "wv_einladung")?.date).toBe("2026-12-30");
    expect(schedule.some((e) => e.key === "wahlausschreiben")).toBe(false);
  });

  it("lässt die Einladung aus, wenn kein Amtszeitende bekannt ist (erste Wahl)", () => {
    const schedule = computeSchedule("2027-01-20", rules);
    expect(schedule).toEqual([]);
  });
});

describe("Regelbeschreibung", () => {
  it("formuliert Regeln lesbar", () => {
    expect(describeRule({ anchor: "wahlausschreiben", direction: "nach", unit: "arbeitstage", amount: 12 })).toBe(
      "12 Arbeitstage nach Erlass des Wahlausschreibens",
    );
  });
});

describe("Nachfrist (§ 16 LPVGWO)", () => {
  it("endet sechs Arbeitstage nach der Bekanntmachung", async () => {
    const { nachfristEnde } = await import("./index");
    expect(nachfristEnde("2026-04-10")).toBe("2026-04-20");
    // über Christi Himmelfahrt (14.05.2026)
    expect(nachfristEnde("2026-05-11")).toBe("2026-05-20");
  });
});

describe("Vorschlag frühester Wahltag", () => {
  it("nimmt den Beginn des Wahlzeitraums, wenn genug Vorlauf bleibt", async () => {
    const { fruehesterWahltag } = await import("./index");
    // Amtszeit endet mit dem Wahlzeitraum der Personalratswahlen 2029; 01.04.2029 ist Ostersonntag, 02.04. Ostermontag
    const v = fruehesterWahltag({ heute: "2026-11-03", amtszeitEnde: "2029-07-31", verfahren: "regulaer" });
    expect(v.datum).toBe("2029-04-03");
    expect(v.warnungen).toEqual([]);
  });
  it("warnt bei einem Amtszeitende außerhalb des Turnus", async () => {
    const { fruehesterWahltag } = await import("./index");
    expect(fruehesterWahltag({ heute: "2026-11-03", amtszeitEnde: "2027-07-31", verfahren: "regulaer" }).warnungen[0]).toMatch(/außerhalb/);
  });
  it("berücksichtigt den Vorlauf des Wahlausschreibens und Feiertage", async () => {
    const { fruehesterWahltag } = await import("./index");
    expect(fruehesterWahltag({ heute: "2026-11-03", amtszeitEnde: "2027-01-31", verfahren: "regulaer" }).datum).toBe("2027-01-04");
  });
  it("warnt, wenn das Amtszeitende nicht mehr erreichbar ist", async () => {
    const { fruehesterWahltag } = await import("./index");
    const v = fruehesterWahltag({ heute: "2026-12-20", amtszeitEnde: "2027-01-31", verfahren: "regulaer" });
    expect(v.datum > "2027-01-31").toBe(true);
    expect(v.warnungen).toHaveLength(1);
  });
  it("Wahlversammlung: ab morgen möglich, warnt bei verpasster Einladung", async () => {
    const { fruehesterWahltag } = await import("./index");
    expect(fruehesterWahltag({ heute: "2026-11-03", amtszeitEnde: "2027-01-31", verfahren: "wahlversammlung" }).datum).toBe("2026-11-04");
    expect(fruehesterWahltag({ heute: "2027-01-20", amtszeitEnde: "2027-01-31", verfahren: "wahlversammlung" }).warnungen[0]).toMatch(/Einladung/);
  });
});

describe("Abgleich mit LPVGWO (Stand 25.07.2023)", () => {
  it("berechnet Stichtag, Mängelmitteilung, Berichtigung und Einspruchsentscheidung", async () => {
    const { computeSchedule } = await import("./index");
    // Wahltag Mi 20.01.2027, Erlass am Fr 20.11.2026
    const s = computeSchedule("2027-01-20", undefined, { wahlausschreibenAm: "2026-11-20" });
    const d = (k: string) => s.find((e) => e.key === k)?.date;
    expect(d("stichtag_feststellung")).toBe("2026-11-06"); // 10. Arbeitstag vor Erlass
    expect(d("wahlvorschlaege_ende")).toBe("2026-12-08"); // 12 Arbeitstage nach Erlass
    expect(d("maengel_mitteilung")).toBe("2026-12-09"); // Arbeitstag nach Fristablauf
    expect(d("berichtigung_ende")).toBe("2026-12-11"); // 3. Arbeitstag nach Fristablauf
    expect(d("einspruch_entscheidung")).toBe("2027-01-19"); // Arbeitstag vor dem Wahltag
  });
  it("Anfechtungsfrist 12 Arbeitstage, Aushang 2 Wochen", async () => {
    const { anfechtungsfristEnde, aushangErgebnisEnde } = await import("./index");
    expect(anfechtungsfristEnde("2027-01-21")).toBe("2027-02-08");
    expect(aushangErgebnisEnde("2027-01-21")).toBe("2027-02-04");
  });
});
