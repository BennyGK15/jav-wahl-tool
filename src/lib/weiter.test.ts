import { describe, expect, it } from "vitest";
import { sicheresZiel } from "./weiter";

describe("Rücksprungziel nach der Anmeldung", () => {
  it("lässt Pfade der Anwendung durch", () => {
    expect(sicheresZiel("/wahl/abc/waehler?filter=offen")).toBe("/wahl/abc/waehler?filter=offen");
  });
  it("verhindert Weiterleitungen nach außen und zum Login", () => {
    for (const x of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/login?weiter=/", "/api/auth/x", "", null, "/a\nb"]) {
      expect(sicheresZiel(x)).toBe("/");
    }
  });
});
