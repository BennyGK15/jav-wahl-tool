import { describe, expect, it } from "vitest";
import { hasPermission } from "./rbac";

describe("Berechtigungen", () => {
  it("IT-Admin sieht keine Wahldaten", () => {
    expect(hasPermission("admin", "voters.sensitive.read")).toBe(false);
    expect(hasPermission("admin", "users.manage")).toBe(true);
  });
  it("Wahlhelfer darf nur die Stimmabgabe vermerken", () => {
    expect(hasPermission("wahlhelfer", "voters.markVoted")).toBe(true);
    expect(hasPermission("wahlhelfer", "voters.edit")).toBe(false);
  });
  it("Datenschutzbeauftragte/r pflegt nur die Datenschutz-Unterlagen", () => {
    expect(hasPermission("datenschutz", "privacy.manage")).toBe(true);
    expect(hasPermission("datenschutz", "privacy.submit")).toBe(true);
    expect(hasPermission("datenschutz", "deadlines.read")).toBe(false);
    expect(hasPermission("datenschutz", "voters.sensitive.read")).toBe(false);
    expect(hasPermission("datenschutz", "audit.read")).toBe(false);
    expect(hasPermission("vorsitz", "privacy.submit")).toBe(false);
  });
  it("unbekannte Rollen haben keine Rechte", () => {
    expect(hasPermission("user", "deadlines.read")).toBe(false);
    expect(hasPermission(undefined, "deadlines.read")).toBe(false);
  });
});
