import { describe, expect, it } from "vitest";
import { feiertageImZeitraum, monatsRaster } from "./kalender";

describe("Monatsraster", () => {
  it("beginnt die Woche am Montag und füllt Lücken mit null", () => {
    const [nov] = monatsRaster("2026-11-10", "2026-11-20");
    expect(nov!.titel).toBe("November 2026");
    // 1.11.2026 ist ein Sonntag
    expect(nov!.wochen[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-11-01",
    ]);
    expect(nov!.wochen.every((w) => w.length === 7)).toBe(true);
    expect(nov!.wochen.flat().filter(Boolean)).toHaveLength(30);
  });
  it("umfasst alle Monate über den Jahreswechsel", () => {
    expect(monatsRaster("2026-11-16", "2027-02-04").map((m) => m.key)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("Feiertage im Zeitraum", () => {
  it("findet Feiertage über den Jahreswechsel", () => {
    const f = feiertageImZeitraum("2026-12-01", "2027-01-31");
    expect([...f.keys()]).toEqual([
      "2026-12-25",
      "2026-12-26",
      "2027-01-01",
      "2027-01-06",
    ]);
  });
});
