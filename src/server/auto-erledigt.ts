import "server-only";
import { writeAudit } from "@/lib/audit";
import {
  AUTO_ERLEDIGT,
  autoErledigt,
  type AutoStand,
} from "@/lib/auto-erledigt";
import { fromDbDate, toBerlinLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/**
 * Setzt bzw. entfernt automatische Haken im Wahlkalender anhand des aktuellen Stands der Wahl.
 * Von Hand gesetzte Haken bleiben unangetastet. Idempotent und nebenläufig sicher (bedingte Updates).
 */
export async function syncErledigt(electionId: string): Promise<void> {
  const [deadlines, freigabe, ungeprueft, offeneEinsprueche, protokoll] =
    await Promise.all([
      prisma.deadline.findMany({ where: { electionId } }),
      prisma.document.findFirst({
        where: {
          electionId,
          typ: "wahlausschreiben",
          freigegebenAm: { not: null },
        },
        select: { id: true },
      }),
      prisma.nomination.count({ where: { electionId, status: "eingegangen" } }),
      prisma.objection.count({ where: { electionId, entscheidung: "offen" } }),
      prisma.auditLog.findMany({
        where: {
          objectType: "election",
          objectId: electionId,
          action: {
            in: ["nominations.notice.generated", "voters.auslage.generated"],
          },
        },
        select: { action: true, at: true },
        orderBy: { at: "desc" },
      }),
    ]);
  if (deadlines.length === 0) return;

  const bekanntmachung = protokoll.find(
    (p) => p.action === "nominations.notice.generated",
  );
  const stand: AutoStand = {
    jetzt: toBerlinLocal(new Date()),
    fristende: Object.fromEntries(
      deadlines.map((d) => [
        d.ruleKey,
        `${fromDbDate(d.datum)} ${d.uhrzeit || "23:59"}`,
      ]),
    ),
    wahlausschreibenFreigegeben: Boolean(freigabe),
    ungepruefteVorschlaege: ungeprueft,
    offeneEinsprueche,
    vorschlaegeBekanntmachungAm: bekanntmachung
      ? toBerlinLocal(bekanntmachung.at)
      : null,
    auslageErzeugt: protokoll.some(
      (p) => p.action === "voters.auslage.generated",
    ),
  };

  for (const d of deadlines) {
    const soll = autoErledigt(d.ruleKey, stand);
    if (soll === undefined) continue;
    if (soll && !d.erledigtAm) {
      const r = await prisma.deadline.updateMany({
        where: { id: d.id, erledigtAm: null },
        data: { erledigtAm: new Date(), erledigtVon: AUTO_ERLEDIGT },
      });
      if (r.count)
        await writeAudit({
          userId: null,
          action: "deadline.auto_done",
          objectType: "deadline",
          objectId: d.id,
          fields: [d.ruleKey],
        });
    } else if (!soll && d.erledigtVon === AUTO_ERLEDIGT) {
      const r = await prisma.deadline.updateMany({
        where: { id: d.id, erledigtVon: AUTO_ERLEDIGT },
        data: { erledigtAm: null, erledigtVon: null },
      });
      if (r.count)
        await writeAudit({
          userId: null,
          action: "deadline.auto_reopened",
          objectType: "deadline",
          objectId: d.id,
          fields: [d.ruleKey],
        });
    }
  }
}
