import { describe, expect, it } from "vitest";
import {
  ageOn,
  eligibility,
  imRegelWahlzeitraum,
  inAusbildungAm,
  javSize,
  schwellenHinweise,
  verfahrensauskunft,
  wahlversammlungZulaessig,
} from "./jav";

describe("Alter", () => {
  it("zählt vollendete Lebensjahre", () => {
    expect(ageOn("2008-11-03", "2026-11-02")).toBe(17);
    expect(ageOn("2008-11-03", "2026-11-03")).toBe(18);
  });
});

describe("Wahlberechtigung und Wählbarkeit (§ 60 LPVG BW)", () => {
  const electionDay = "2026-11-03";
  it("17-Jährige ohne Ausbildung: wahlberechtigt und wählbar", () => {
    expect(eligibility({ birthDate: "2009-06-01", inTraining: false, electionDay })).toMatchObject({ wahlberechtigt: true, waehlbar: true });
  });
  it("20-Jährige ohne Ausbildung: nicht wahlberechtigt, aber wählbar", () => {
    expect(eligibility({ birthDate: "2006-01-01", inTraining: false, electionDay })).toMatchObject({ wahlberechtigt: false, waehlbar: true });
  });
  it("30-jährige Auszubildende: wahlberechtigt und wählbar", () => {
    expect(eligibility({ birthDate: "1996-01-01", inTraining: true, electionDay })).toMatchObject({ wahlberechtigt: true, waehlbar: true });
  });
  it("30-Jährige ohne Ausbildung: weder noch", () => {
    expect(eligibility({ birthDate: "1996-01-01", inTraining: false, electionDay })).toMatchObject({ wahlberechtigt: false, waehlbar: false });
  });
});

describe("Größe der JAV (§ 61 LPVG BW)", () => {
  it.each([
    [4, 0], [5, 1], [20, 1], [21, 3], [50, 3], [51, 5], [200, 5], [201, 7],
  ])("%i Wahlberechtigte → %i Mitglieder", (n, size) => {
    expect(javSize(n)).toBe(size);
  });
  it("Wahlversammlung nur bis 20 Wahlberechtigte", () => {
    expect(wahlversammlungZulaessig(20)).toBe(true);
    expect(wahlversammlungZulaessig(21)).toBe(false);
  });
});

describe("Verfahren und Wahlzeitraum", () => {
  it("leitet Größe und Verfahren aus der Zahl ab", () => {
    expect(verfahrensauskunft(4)).toEqual({ javMoeglich: false, mitglieder: 0, wahlversammlungMoeglich: false });
    expect(verfahrensauskunft(12)).toEqual({ javMoeglich: true, mitglieder: 1, wahlversammlungMoeglich: true });
    expect(verfahrensauskunft(35)).toEqual({ javMoeglich: true, mitglieder: 3, wahlversammlungMoeglich: false });
  });
  it("erkennt den regelmäßigen Wahlzeitraum", () => {
    // Herbsttermin 1.10.2026–31.1.2027 (zweieinhalb Jahre nach den Personalratswahlen 2024)
    expect(imRegelWahlzeitraum("2026-11-10")).toBe(true);
    expect(imRegelWahlzeitraum("2027-01-20")).toBe(true);
    // 2027 finden keine Personalratswahlen statt → kein Frühjahrstermin
    expect(imRegelWahlzeitraum("2027-05-12")).toBe(false);
    // zusammen mit den Personalratswahlen 2029
    expect(imRegelWahlzeitraum("2029-05-12")).toBe(true);
    expect(imRegelWahlzeitraum("2028-11-10")).toBe(false);
    expect(imRegelWahlzeitraum("2027-02-15")).toBe(false);
    expect(imRegelWahlzeitraum("2027-09-01")).toBe(false);
  });
});

describe("Ausbildung am Wahltag", () => {
  it("zählt nur, wenn die Ausbildung am Wahltag noch läuft", () => {
    expect(inAusbildungAm(true, null, "2027-01-20")).toBe(true);
    expect(inAusbildungAm(true, "2027-01-20", "2027-01-20")).toBe(true);
    expect(inAusbildungAm(true, "2027-01-19", "2027-01-20")).toBe(false);
    expect(inAusbildungAm(false, null, "2027-01-20")).toBe(false);
  });
});

describe("Schwellen zwischen Schätzung und Verzeichnis", () => {
  it("meldet nichts, wenn sich nichts ändert", () => {
    expect(schwellenHinweise(30, 45, "regulaer")).toEqual([]);
  });
  it("meldet eine geänderte JAV-Größe", () => {
    expect(schwellenHinweise(18, 23, "regulaer")).toHaveLength(1);
  });
  it("meldet eine unzulässig gewordene Wahlversammlung", () => {
    const h = schwellenHinweise(18, 23, "wahlversammlung");
    expect(h).toHaveLength(2);
    expect(h[1]).toMatch(/keine Wahlversammlung/);
  });
  it("meldet, wenn keine JAV mehr gebildet wird", () => {
    expect(schwellenHinweise(6, 4, "regulaer")[0]).toMatch(/keine JAV/);
  });
});

describe("Mindestzahl Stützunterschriften (§ 62 Abs. 1 i. V. m. § 13 Abs. 6 LPVG BW)", () => {
  it.each([
    [5, 1], [20, 1], [21, 2], [40, 2], [41, 3], [200, 10], [980, 49], [981, 50], [5000, 50],
  ])("%i Wahlberechtigte → %i Unterschriften", async (n, min) => {
    const { mindestStuetzunterschriften } = await import("./jav");
    expect(mindestStuetzunterschriften(n)).toBe(min);
  });
});
