/**
 * Legt erfundene Testpersonen im Wählerverzeichnis der laufenden Wahl an.
 *
 *   pnpm seed:dummy             # nur, wenn die Wahl noch keine Personen hat
 *   pnpm seed:dummy --replace   # löscht vorher ALLE Personen dieser Wahl (inkl. Bewerbungen, Unterschriften, Einsprüche)
 *
 * Nur für Entwicklung und Tests – verweigert den Betrieb mit NODE_ENV=production.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Testdaten werden in Produktion nicht angelegt.");
  const replace = process.argv.includes("--replace");

  const { prisma } = await import("../src/lib/prisma");
  const { encrypt, encryptNullable } = await import("../src/lib/crypto");
  const { eligibility, inAusbildungAm, ageOn } = await import("../src/lib/jav");
  const { buildDummyPersons } = await import("./dummy-data");

  try {
    const election = await prisma.election.findFirst({
      where: { status: { not: "abgeschlossen" } },
      orderBy: { createdAt: "desc" },
    });
    if (!election) throw new Error("Keine laufende Wahl gefunden. Bitte zuerst in der App eine Wahl anlegen.");
    const wahltag = election.wahltag.toISOString().slice(0, 10);

    const vorhanden = await prisma.voter.count({ where: { electionId: election.id } });
    if (vorhanden > 0 && !replace) {
      throw new Error(`Die Wahl hat bereits ${vorhanden} Personen. Mit --replace werden sie gelöscht und ersetzt.`);
    }
    if (vorhanden > 0) {
      await prisma.voter.deleteMany({ where: { electionId: election.id } });
      console.log(`${vorhanden} vorhandene Personen gelöscht.`);
    }

    const persons = buildDummyPersons(wahltag).sort(
      (a, b) => a.nachname.localeCompare(b.nachname, "de") || a.vorname.localeCompare(b.vorname, "de"),
    );

    const data = persons.map((p, i) => {
      const id = crypto.randomUUID();
      const e = eligibility({
        birthDate: p.geburtsdatum,
        inTraining: inAusbildungAm(p.inAusbildung, p.ausbildungsende, wahltag),
        electionDay: wahltag,
      });
      return {
        id,
        electionId: election.id,
        lfdNr: i + 1,
        nachname: p.nachname,
        vorname: p.vorname,
        organisationseinheit: p.organisationseinheit,
        funktion: p.funktion,
        geschlecht: p.geschlecht,
        inAusbildung: p.inAusbildung,
        geburtsdatumEnc: encrypt(p.geburtsdatum, `voter:${id}`),
        ausbildungsendeEnc: encryptNullable(p.ausbildungsende, `voter:${id}`),
        wahlberechtigt: e.wahlberechtigt,
        waehlbar: e.waehlbar,
      };
    });
    await prisma.voter.createMany({ data });

    console.log(`\n${data.length} Testpersonen für „${election.dienststelle}“ (Wahltag ${wahltag}) angelegt:\n`);
    console.table(
      persons.map((p, i) => ({
        Nr: i + 1,
        Name: `${p.nachname}, ${p.vorname}`,
        G: p.geschlecht,
        Alter: ageOn(p.geburtsdatum, wahltag),
        Azubi: p.inAusbildung ? "ja" : "–",
        wahlberechtigt: data[i]!.wahlberechtigt ? "ja" : "NEIN",
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
