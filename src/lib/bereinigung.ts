import { TAGE_NACH_ABSCHLUSS } from "./datenschutz";
import { prisma } from "./prisma";

/**
 * Datenminimierung (Art. 5 Abs. 1 lit. c und e DSGVO): Löscht abgelaufene Sitzungen (mit IP-Adresse und
 * Browserkennung), abgelaufene Bestätigungscodes und alte Einträge der Anmeldebremse.
 * Läuft höchstens einmal pro Stunde und Prozess; Fehler blockieren nie die eigentliche Anfrage.
 */
const INTERVALL_MS = 60 * 60 * 1000;
/** Einträge der Anmeldebremse werden nach einem Tag nicht mehr gebraucht */
const RATE_LIMIT_AUFBEWAHRUNG_MS = 24 * 60 * 60 * 1000;

let letzterLauf = 0;

/**
 * Audit-Log: 30 Tage nach Abschluss der Wahl löschen (Festlegung, keine gesetzliche Vorgabe).
 * Nicht, solange eine Wahl läuft oder eine Anfechtung anhängig ist – dann kann das Protokoll als Nachweis nötig sein.
 */
async function bereinigeAuditLog(jetzt: number): Promise<void> {
  const [laufend, anfechtung, letzte] = await Promise.all([
    prisma.election.count({ where: { status: { not: "abgeschlossen" } } }),
    prisma.election.count({ where: { anfechtungAm: { not: null }, anfechtungErledigtAm: null } }),
    prisma.election.findFirst({ where: { abgeschlossenAm: { not: null } }, orderBy: { abgeschlossenAm: "desc" }, select: { abgeschlossenAm: true } }),
  ]);
  if (laufend > 0 || anfechtung > 0 || !letzte?.abgeschlossenAm) return;
  const abschluss = letzte.abgeschlossenAm.getTime();
  if (jetzt < abschluss + TAGE_NACH_ABSCHLUSS * 24 * 60 * 60 * 1000) return;
  await prisma.auditLog.deleteMany({ where: { at: { lte: letzte.abgeschlossenAm } } });
}

export async function bereinigeAbgelaufenes(): Promise<void> {
  const jetzt = Date.now();
  if (jetzt - letzterLauf < INTERVALL_MS) return;
  letzterLauf = jetzt;
  try {
    const grenze = new Date(jetzt);
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { expiresAt: { lt: grenze } } }),
      prisma.verification.deleteMany({ where: { expiresAt: { lt: grenze } } }),
      prisma.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(jetzt - RATE_LIMIT_AUFBEWAHRUNG_MS) } } }),
    ]);
    await bereinigeAuditLog(jetzt);
  } catch (e) {
    letzterLauf = 0; // beim nächsten Aufruf erneut versuchen
    console.error("[bereinigung] Abgelaufene Daten konnten nicht gelöscht werden", e);
  }
}
