/**
 * Setzt die Entwicklungsumgebung auf eine leere Instanz zurück – Benutzerkonten bleiben erhalten.
 *
 *   pnpm dev:reset --ja                    # alle Wahldaten, Fristregel-Anpassungen, Audit-Log und Datenschutz-Angaben
 *   pnpm dev:reset --ja --datenschutz-behalten
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
  if (process.env.NODE_ENV === "production")
    throw new Error("Der Neustart ist in Produktion nicht verfügbar.");
  if (!process.argv.includes("--ja")) {
    console.log(
      "Löscht ALLE Wahldaten (Benutzer bleiben erhalten). Zum Ausführen: pnpm dev:reset --ja [--datenschutz-behalten]",
    );
    return;
  }
  const { prisma } = await import("../src/lib/prisma");
  const { devReset } = await import("../src/lib/dev-reset");
  try {
    const r = await devReset({
      datenschutz: !process.argv.includes("--datenschutz-behalten"),
    });
    console.log(
      `Neustart erledigt: ${r.wahlen} Wahl(en) mit ${r.personen} Person(en), ${r.fristregeln} Fristregeln, ${r.auditEintraege} Audit-Einträge und ${r.einstellungen} Einstellung(en) gelöscht. Benutzer sind unverändert.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

export {};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
