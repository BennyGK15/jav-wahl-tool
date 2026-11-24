/**
 * Erzeugt erfundene Testpersonen relativ zum Wahltag. Reine Funktion ohne Datenbank.
 * 21 Personen: 14 männlich, 7 weiblich, alle wahlberechtigt.
 *  - 6 „gerade noch so“: am Wahltag 17, ohne Ausbildung, werden 2–30 Tage danach 18
 *  - 15 Auszubildende zwischen 17 und 23 Jahren (Ø ca. 19,8), Ausbildung läuft über den Wahltag hinaus
 */
import { addDays } from "../src/lib/fristen";

export interface DummyPerson {
  nachname: string;
  vorname: string;
  geschlecht: "w" | "m";
  geburtsdatum: string;
  inAusbildung: boolean;
  ausbildungsende: string | null;
  organisationseinheit: string;
  funktion: string;
}

function addYears(iso: string, years: number): string {
  const y = Number(iso.slice(0, 4)) + years;
  let md = iso.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (md === "02-29" && !leap) md = "02-28";
  return `${y}-${md}`;
}

const NACHNAMEN = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch",
  "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger",
];
const MAENNLICH = ["Lukas", "Jonas", "Leon", "Finn", "Noah", "Elias", "Paul", "Ben", "Felix", "Luis", "Tim", "Jan", "Moritz", "Niklas"];
const WEIBLICH = ["Lena", "Mia", "Emma", "Sophie", "Hannah", "Lea", "Marie"];
const BEREICHE = ["Verwaltung", "IT", "Bauhof", "Kita"];

export function buildDummyPersons(wahltag: string): DummyPerson[] {
  let m = 0;
  let w = 0;
  let n = 0;
  const next = (g: "m" | "w") => ({
    nachname: NACHNAMEN[n++]!,
    vorname: g === "m" ? MAENNLICH[m++]! : WEIBLICH[w++]!,
    geschlecht: g,
  });

  // 6 knapp unter 18 – Tage bis zum 18. Geburtstag nach dem Wahltag
  const knapp = (["m", "m", "w", "m", "w", "m"] as const).map((g, i) => {
    const tageBis18 = [2, 5, 9, 14, 21, 30][i]!;
    return {
      ...next(g),
      geburtsdatum: addDays(addYears(wahltag, -18), tageBis18),
      inAusbildung: false,
      ausbildungsende: null,
      organisationseinheit: `${BEREICHE[i % BEREICHE.length]} (Testdaten)`,
      funktion: g === "w" ? "Praktikantin" : "Praktikant",
    };
  });

  // 15 Auszubildende mit durchschnittlichem Alter
  const alter = [17, 18, 18, 19, 19, 19, 20, 20, 20, 21, 21, 22, 18, 22, 23];
  const tageNachGeburtstag = [40, 120, 200, 15, 310, 90, 180, 260, 30, 150, 70, 330, 100, 220, 45];
  const geschlechter = ["m", "m", "w", "m", "m", "w", "m", "m", "w", "m", "m", "w", "m", "m", "w"] as const;
  const azubis = geschlechter.map((g, i) => ({
    ...next(g),
    geburtsdatum: addDays(addYears(wahltag, -alter[i]!), -tageNachGeburtstag[i]!),
    inAusbildung: true,
    ausbildungsende: addDays(wahltag, 200 + i * 37),
    organisationseinheit: `Ausbildung ${BEREICHE[i % BEREICHE.length]} (Testdaten)`,
    funktion: ["Auszubildende/r Verwaltungsfachangestellte/r", "Auszubildende/r Fachinformatiker/in", "Beamtenanwärter/in mittlerer Dienst"][i % 3]!,
  }));

  return [...knapp, ...azubis];
}
