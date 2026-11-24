import { describe, expect, it } from "vitest";
import {
  berlinLocalToDate,
  formatBerlinDateTime,
  toBerlinLocal,
} from "./dates";

describe("Berliner Ortszeit", () => {
  it("rechnet Winter- und Sommerzeit korrekt um", () => {
    expect(berlinLocalToDate("2026-03-18T14:05").toISOString()).toBe(
      "2026-03-18T13:05:00.000Z",
    );
    expect(berlinLocalToDate("2026-07-01T09:30").toISOString()).toBe(
      "2026-07-01T07:30:00.000Z",
    );
  });
  it("funktioniert an den Tagen der Zeitumstellung", () => {
    expect(berlinLocalToDate("2026-03-29T12:00").toISOString()).toBe(
      "2026-03-29T10:00:00.000Z",
    );
    expect(berlinLocalToDate("2026-10-25T00:30").toISOString()).toBe(
      "2026-10-24T22:30:00.000Z",
    );
  });
  it("wandelt hin und zurück", () => {
    for (const s of [
      "2026-01-05T08:00",
      "2026-06-15T23:59",
      "2026-11-03T22:06",
    ]) {
      expect(toBerlinLocal(berlinLocalToDate(s))).toBe(s.replace("T", " "));
    }
    expect(toBerlinLocal(new Date("2026-12-31T23:30:00Z"))).toBe(
      "2027-01-01 00:30",
    );
  });
  it("lehnt andere Formate ab und formatiert deutsch", () => {
    expect(() => berlinLocalToDate("18.03.2026 14:05")).toThrow();
    expect(formatBerlinDateTime(new Date("2026-03-18T13:05:00Z"))).toMatch(
      /18\.03\.2026.*14:05/,
    );
  });
});
