import "server-only";
import {
  ANFECHTUNGSFRIST,
  anfechtungsfristEnde,
  AUSHANG_ERGEBNIS,
  aushangErgebnisEnde,
  computeSchedule,
  DEFAULT_RULES,
  ENTFALLENE_REGELN,
  FRISTENDEN_MIT_UHRZEIT,
  NACHFRIST,
  nachfristEnde,
  PRUEFER_LANDESRECHT,
  type DeadlineRule,
  type Verfahren,
} from "@/lib/fristen";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { fromDbDate, toBerlinLocal, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

let abgeglichen = false;

/**
 * Legt fehlende Standardregeln an und gleicht unveränderte, noch ungeprüfte Standardregeln mit dem
 * aktuellen Rechtsstand ab (Bezeichnung, Rechtsgrundlage, Prüfstatus). Vom Wahlvorstand angepasste
 * (andere Berechnung) oder selbst geprüfte Regeln bleiben unverändert. Entfallene Standardregeln werden entfernt.
 */
export async function ensureDefaultRules(): Promise<void> {
  if (!abgeglichen) {
    const jetzt = new Date();
    await prisma.$transaction([
      prisma.deadlineRule.deleteMany({ where: { key: { in: [...ENTFALLENE_REGELN] } } }),
      ...DEFAULT_RULES.map((r) =>
        prisma.deadlineRule.updateMany({
          where: { key: r.key, anchor: r.anchor, direction: r.direction, unit: r.unit, amount: r.amount, verifiedBy: null },
          data: {
            label: r.label,
            legalBasis: r.legalBasis,
            verified: r.verified,
            verifiedBy: r.verified ? PRUEFER_LANDESRECHT : null,
            verifiedAt: r.verified ? jetzt : null,
          },
        }),
      ),
    ]);
    abgeglichen = true;
  }
  await prisma.deadlineRule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      key: r.key,
      label: r.label,
      verfahren: r.verfahren,
      anchor: r.anchor,
      direction: r.direction,
      unit: r.unit,
      amount: r.amount,
      legalBasis: r.legalBasis,
      verified: r.verified,
      verifiedBy: r.verified ? PRUEFER_LANDESRECHT : null,
      verifiedAt: r.verified ? new Date() : null,
    })),
    skipDuplicates: true,
  });
}

export async function loadRules(verfahren?: Verfahren): Promise<DeadlineRule[]> {
  await ensureDefaultRules();
  const rows = await prisma.deadlineRule.findMany({
    where: verfahren ? { verfahren } : undefined,
    orderBy: [{ verfahren: "asc" }, { key: "asc" }],
  });
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    verfahren: r.verfahren,
    anchor: r.anchor,
    direction: r.direction,
    unit: r.unit,
    amount: r.amount,
    legalBasis: r.legalBasis,
    verified: r.verified,
  }));
}

/** Die laufende Wahl (eine Dienststelle → höchstens eine nicht abgeschlossene Wahl). */
export async function getActiveElection() {
  return prisma.election.findFirst({
    where: { status: { not: "abgeschlossen" } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Berechnet den Wahlkalender neu und speichert ihn.
 * Manuell überschriebene Termine bleiben unangetastet; erledigte behalten ihren Status.
 * Termine von Regeln, die nicht mehr gelten (z. B. nach Verfahrenswechsel), werden entfernt, sofern nicht erledigt.
 */
export async function recalculateDeadlines(electionId: string) {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
    include: { result: { select: { festgestelltAm: true } } },
  });
  const rules = await loadRules(election.verfahren);
  const schedule = computeSchedule(fromDbDate(election.wahltag), rules, {
    wahlausschreibenAm: election.wahlausschreibenAm ? fromDbDate(election.wahlausschreibenAm) : undefined,
    amtszeitEnde: election.amtszeitEnde ? fromDbDate(election.amtszeitEnde) : undefined,
  });

  // Ereignisbezogene Frist: Nachfrist für Wahlvorschläge (§ 16 LPVGWO)
  if (election.nachfristBekanntgemachtAm) {
    schedule.push({
      key: NACHFRIST.key,
      label: NACHFRIST.label,
      date: nachfristEnde(fromDbDate(election.nachfristBekanntgemachtAm)),
      legalBasis: NACHFRIST.legalBasis,
      verified: true,
    });
  }

  // Nach der Feststellung: Aushang des Ergebnisses (§ 31 Abs. 2 LPVGWO) und Anfechtungsfrist (§ 21 LPVG).
  // Annahme: Das Ergebnis wird am Tag der Feststellung bekanntgegeben.
  if (election.result?.festgestelltAm) {
    const bekanntgabe = toBerlinLocal(election.result.festgestelltAm).slice(0, 10);
    schedule.push(
      { key: AUSHANG_ERGEBNIS.key, label: AUSHANG_ERGEBNIS.label, date: aushangErgebnisEnde(bekanntgabe), legalBasis: AUSHANG_ERGEBNIS.legalBasis, verified: true },
      { key: ANFECHTUNGSFRIST.key, label: ANFECHTUNGSFRIST.label, date: anfechtungsfristEnde(bekanntgabe), legalBasis: ANFECHTUNGSFRIST.legalBasis, verified: true },
    );
  }

  const dienstschluss = parseAngaben(election.wahlausschreibenAngaben).dienstschluss;
  const existing = await prisma.deadline.findMany({ where: { electionId } });
  const byKey = new Map(existing.map((d) => [d.ruleKey, d]));
  const validKeys = new Set(schedule.map((s) => s.key));

  await prisma.$transaction([
    ...schedule
      .filter((s) => !byKey.get(s.key)?.manuellUeberschrieben)
      .map((s) =>
        prisma.deadline.upsert({
          where: { electionId_ruleKey: { electionId, ruleKey: s.key } },
          create: {
            electionId,
            ruleKey: s.key,
            datum: toDbDate(s.date),
            uhrzeit: FRISTENDEN_MIT_UHRZEIT.includes(s.key) ? (dienstschluss ?? null) : null,
          },
          update: { datum: toDbDate(s.date) },
        }),
      ),
    prisma.deadline.deleteMany({
      where: { electionId, ruleKey: { notIn: [...validKeys] }, erledigtAm: null },
    }),
  ]);

  return schedule;
}

/** Fristende einer gespeicherten Frist als Berliner Ortszeit "YYYY-MM-DD HH:MM" (ohne Uhrzeit: 23:59). */
export async function getDeadlineEnd(electionId: string, ruleKey: string): Promise<string | null> {
  const d = await prisma.deadline.findUnique({ where: { electionId_ruleKey: { electionId, ruleKey } } });
  return d ? `${fromDbDate(d.datum)} ${d.uhrzeit || "23:59"}` : null;
}
