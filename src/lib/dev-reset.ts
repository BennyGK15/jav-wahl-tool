/**
 * Neustart der Entwicklungsumgebung: entfernt alle Wahldaten, behält Benutzerkonten.
 *
 * Gelöscht: alle Wahlen samt Wählerverzeichnis, Wahlvorschlägen, Einsprüchen, Fristen, Checklisten, Ergebnissen und
 * Dokumenten (Kaskade), angepasste Fristregeln (werden beim nächsten Aufruf aus den Vorgaben neu angelegt),
 * Audit-Log, Verifizierungs- und Rate-Limit-Einträge; auf Wunsch auch die Datenschutz-Angaben und -Aufgaben.
 * Erhalten: Benutzer, Passwörter, 2FA, laufende Anmeldungen und die Feiertage.
 *
 * Verweigert den Betrieb mit NODE_ENV=production.
 */
import { prisma } from "./prisma";

export const DEV_RESET_ERLAUBT = process.env.NODE_ENV !== "production";
export const BESTAETIGUNG = "NEU STARTEN";

export interface ResetErgebnis {
  wahlen: number;
  personen: number;
  fristregeln: number;
  auditEintraege: number;
  einstellungen: number;
}

export async function devReset({
  datenschutz,
}: {
  datenschutz: boolean;
}): Promise<ResetErgebnis> {
  if (!DEV_RESET_ERLAUBT)
    throw new Error("Der Neustart ist in Produktion nicht verfügbar.");
  const personen = await prisma.voter.count();
  const [wahlen, fristregeln, audit, einstellungen] = await prisma.$transaction(
    [
      prisma.election.deleteMany({}),
      prisma.deadlineRule.deleteMany({}),
      prisma.auditLog.deleteMany({}),
      prisma.einstellung.deleteMany({
        where: datenschutz
          ? {}
          : {
              schluessel: {
                notIn: [
                  "datenschutz",
                  "datenschutz-aufgaben",
                  "datenschutz-einreichung",
                ],
              },
            },
      }),
      prisma.verification.deleteMany({}),
      prisma.rateLimit.deleteMany({}),
    ],
  );
  return {
    wahlen: wahlen.count,
    personen,
    fristregeln: fristregeln.count,
    auditEintraege: audit.count,
    einstellungen: einstellungen.count,
  };
}
