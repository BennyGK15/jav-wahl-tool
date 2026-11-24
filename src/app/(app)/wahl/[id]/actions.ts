"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { FRISTENDEN_MIT_UHRZEIT } from "@/lib/fristen";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { recalculateDeadlines } from "@/server/elections";

const id = z.string().uuid();

export async function toggleDeadlineDone(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const deadlineId = id.parse(formData.get("deadlineId"));
  const deadline = await prisma.deadline.findUniqueOrThrow({ where: { id: deadlineId } });
  const done = deadline.erledigtAm == null;
  await prisma.deadline.update({
    where: { id: deadlineId },
    data: done ? { erledigtAm: new Date(), erledigtVon: session.user.id } : { erledigtAm: null, erledigtVon: null },
  });
  await writeAudit({
    userId: session.user.id,
    action: done ? "deadline.done" : "deadline.reopened",
    objectType: "deadline",
    objectId: deadlineId,
  });
  revalidatePath(`/wahl/${deadline.electionId}`);
  // Phasenstatus in der Navigation und „Jetzt zu tun“ auf der Übersicht aktualisieren
  revalidatePath("/", "layout");
}

const timeSchema = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]);

export async function setDeadlineTime(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const deadlineId = id.parse(formData.get("deadlineId"));
  const uhrzeit = timeSchema.parse(formData.get("uhrzeit") ?? "");
  const deadline = await prisma.deadline.update({
    where: { id: deadlineId },
    data: { uhrzeit: uhrzeit || null },
  });
  await writeAudit({ userId: session.user.id, action: "deadline.time", objectType: "deadline", objectId: deadlineId, fields: ["uhrzeit"] });
  revalidatePath(`/wahl/${deadline.electionId}`);
}

export async function recalculateAction(formData: FormData): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = id.parse(formData.get("electionId"));
  await recalculateDeadlines(electionId);
  await writeAudit({ userId: session.user.id, action: "deadlines.recalculated", objectType: "election", objectId: electionId });
  revalidatePath(`/wahl/${electionId}`);
}

/** Dienstschluss speichern und bei Fristenden ohne Uhrzeit eintragen. */
export async function setDienstschlussAction(formData: FormData): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = id.parse(formData.get("electionId"));
  const dienstschluss = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).parse(formData.get("dienstschluss"));
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId } });
  await prisma.$transaction([
    prisma.election.update({
      where: { id: electionId },
      data: { wahlausschreibenAngaben: { ...parseAngaben(election.wahlausschreibenAngaben), dienstschluss } },
    }),
    prisma.deadline.updateMany({
      where: { electionId, ruleKey: { in: [...FRISTENDEN_MIT_UHRZEIT] }, uhrzeit: null },
      data: { uhrzeit: dienstschluss },
    }),
  ]);
  await writeAudit({ userId: session.user.id, action: "election.dienstschluss", objectType: "election", objectId: electionId, fields: ["dienstschluss"] });
  revalidatePath(`/wahl/${electionId}`);
}

/** Dienstschluss bei ALLEN Fristenden mit Uhrzeit eintragen (überschreibt abweichende Uhrzeiten). */
export async function applyDienstschlussAllAction(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const electionId = id.parse(formData.get("electionId"));
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId } });
  const dienstschluss = parseAngaben(election.wahlausschreibenAngaben).dienstschluss;
  if (!dienstschluss) throw new Error("Kein Dienstschluss festgelegt");
  await prisma.deadline.updateMany({
    where: { electionId, ruleKey: { in: [...FRISTENDEN_MIT_UHRZEIT] } },
    data: { uhrzeit: dienstschluss },
  });
  await writeAudit({ userId: session.user.id, action: "deadline.time", objectType: "election", objectId: electionId, fields: ["uhrzeit"] });
  revalidatePath(`/wahl/${electionId}`);
}
