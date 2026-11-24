import { describe, expect, it } from "vitest";
import { berechneAblauf, fristText, SCHRITTE } from "./ablauf";
import { computeSchedule, DEFAULT_RULES } from "./fristen";

const schedule = computeSchedule("2027-01-20", undefined, {
  wahlausschreibenAm: "2026-11-20",
});
const termine = (heute: string) =>
  schedule.map((e, i) => ({
    id: String(i),
    key: e.key,
    datum: e.date,
    uhrzeit: null,
    label: e.label,
    erledigt: e.date < heute,
  }));
const ablauf = (heute: string, festgestellt = false) =>
  berechneAblauf({
    verfahren: "regulaer",
    termine: termine(heute),
    wahltag: "2027-01-20",
    ergebnisFestgestellt: festgestellt,
    heute,
  });

describe("Ablauf in Phasen", () => {
  it("ordnet jeder Standardregel eine Aufgabe und Seite zu", () => {
    for (const r of DEFAULT_RULES) expect(SCHRITTE[r.key]?.pfad).toBeTruthy();
  });
  it("beginnt mit der Vorbereitung", () => {
    const a = ablauf("2026-11-04");
    expect(a.aktuell).toBe("vorbereiten");
    expect(a.jetzt?.key).toBe("stichtag_feststellung");
  });
  it("markiert eine Phase erst als erledigt, wenn alle ihre Schritte erledigt sind", () => {
    const a = ablauf("2026-12-15"); // Einreichung vorbei, Auslage steht noch aus
    expect(a.aktuell).toBe("einleiten");
    expect(a.phasen.find((p) => p.key === "vorschlaege")?.status).toBe("offen");
  });
  it("führt nach dem Wahltag zur Feststellung des Ergebnisses", () => {
    const a = ablauf("2027-01-21");
    expect(a.jetzt?.key).toBe("wahltag");
    expect(a.jetzt?.pfad).toBe("ergebnis");
  });
  it("ist fertig, wenn alles erledigt und das Ergebnis festgestellt ist", () => {
    const a = ablauf("2027-12-31", true);
    expect(a.jetzt).toBeNull();
    expect(a.phasen.every((p) => p.status === "erledigt")).toBe(true);
  });
});

describe("fristText", () => {
  it("formuliert Abstände", () => {
    expect(fristText("2026-11-04", "2026-11-04").text).toBe("heute");
    expect(fristText("2026-11-04", "2026-11-05").text).toBe("morgen");
    expect(fristText("2026-11-04", "2026-11-02").ton).toBe("ueberfaellig");
    expect(fristText("2026-11-04", "2026-11-20").text).toBe(
      "in 12 Arbeitstagen (16 Tage)",
    );
  });
});
