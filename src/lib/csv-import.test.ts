import { describe, expect, it } from "vitest";
import * as c from "./csv-import";

function assertEqual(a: unknown, b: unknown) {
  expect(a).toEqual(b);
}
const assert = {
  equal: assertEqual,
  deepEqual: assertEqual,
  match: (a: string, re: RegExp) => expect(a).toMatch(re),
};

describe("CSV-Import", () => {
  it("liest, ordnet zu und prüft eine typische Excel-CSV", () => {

const t = '\uFEFFNachname;Vorname;Geburtsdatum;Azubi;Ausbildungsende;Abteilung;Geschlecht\r\nMüller;Lukas;22.01.2009;nein;;"Amt 1; Verwaltung";m\r\n"Schmidt ""Jr.""";Jonas;2008-09-22;ja;31.08.2027;IT;männlich\r\nWeber;Mia;31.02.2009;x;;;w\r\n;;;;;;\r\nKoch;Ben;16.3.07;;;;divers\r\n';
assert.equal(c.erkenneTrennzeichen(t), ";");
const rows = c.parseCsv(t);
assert.equal(rows.length, 5);
assert.equal(rows[1]![5], "Amt 1; Verwaltung");
assert.equal(rows[2]![0], 'Schmidt "Jr."');
const z = c.rateZuordnung(rows[0]!);
assert.deepEqual(z, { nachname:0, vorname:1, organisationseinheit:5, funktion:-1, geburtsdatum:2, inAusbildung:3, ausbildungsende:4, geschlecht:6 });
assert.deepEqual(c.rateZuordnung(["Name", "Vorname", "Ausbildungsberuf", "Azubi", "Amtsbezeichnung"]).funktion, 2);
assert.equal(c.rateZuordnung(["Name", "Vorname", "Ausbildungsberuf", "Azubi", "Amtsbezeichnung"]).organisationseinheit, -1);
assert.equal(c.rateZuordnung(["Familienname", "Vorname", "Geb.-Datum", "Tätigkeit", "Amt"]).geburtsdatum, 2);
assert.equal(c.rateZuordnung(["Familienname", "Vorname", "Geb.-Datum", "Tätigkeit", "Amt"]).funktion, 3);
assert.equal(c.rateZuordnung(["Familienname", "Vorname", "Geb.-Datum", "Tätigkeit", "Amt"]).organisationseinheit, 4);
const r = c.wandleZeilen(rows, z, true, new Date("2026-11-03T12:00:00Z"));
assert.equal(r.zeilen.length, 3);
assert.equal(r.fehler.length, 1); assert.equal(r.fehler[0]!.zeile, 4); assert.match(r.fehler[0]!.fehler, /Geburtsdatum/);
assert.deepEqual(r.zeilen[1], { nachname:'Schmidt "Jr."', vorname:"Jonas", organisationseinheit:"IT", funktion:null, geburtsdatum:"2008-09-22", inAusbildung:true, ausbildungsende:"2027-08-31", geschlecht:"m" });
assert.equal(r.zeilen[2]!.geburtsdatum, "2007-03-16"); assert.equal(r.zeilen[2]!.geschlecht, "d");
assert.equal(c.parseDatum("16.3.07", new Date("2026-01-01")), "2007-03-16");
assert.equal(c.parseDatum("16.3.45", new Date("2026-01-01")), "1945-03-16");
assert.equal(c.parseJaNein("vielleicht"), null);
assert.equal(c.parseGeschlecht("?"), undefined);
assert.equal(c.erkenneTrennzeichen("a,b,c\n1,2,3"), ",");
assert.equal(c.dublettenSchluessel({nachname:"Müller",vorname:"Lukas",geburtsdatum:"2009-01-22"}), c.dublettenSchluessel({nachname:"MÜLLER ",vorname:"lukas",geburtsdatum:"2009-01-22"}));
assert.equal(c.parseJaNein(""), false); assert.equal(c.parseJaNein("?"), null); assert.equal(c.parseGeschlecht(""), null);

  });
});
