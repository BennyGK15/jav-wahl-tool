"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

const uuid = z.string().uuid();

export async function toggleItemAction(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const itemId = uuid.parse(formData.get("itemId"));
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const done = item.erledigtAm == null;
  await prisma.checklistItem.update({
    where: { id: itemId },
    data: done ? { erledigtAm: new Date(), erledigtVon: session.user.id } : { erledigtAm: null, erledigtVon: null },
  });
  await writeAudit({ userId: session.user.id, action: done ? "checklist.done" : "checklist.reopened", objectType: "checklist_item", objectId: itemId });
  revalidatePath(`/wahl/${item.electionId}/checklisten`);
}

export async function addItemAction(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const electionId = uuid.parse(formData.get("electionId"));
  const phase = z.enum(["vorbereitung", "wahltag", "abschluss"]).parse(formData.get("phase"));
  const text = z.string().trim().min(3).max(500).parse(formData.get("text"));
  const max = await prisma.checklistItem.aggregate({ where: { electionId, phase }, _max: { sortierung: true } });
  const item = await prisma.checklistItem.create({ data: { electionId, phase, text, sortierung: (max._max.sortierung ?? 0) + 1 } });
  await writeAudit({ userId: session.user.id, action: "checklist.added", objectType: "checklist_item", objectId: item.id });
  revalidatePath(`/wahl/${electionId}/checklisten`);
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const session = await requirePermission("deadlines.edit");
  const itemId = uuid.parse(formData.get("itemId"));
  const item = await prisma.checklistItem.delete({ where: { id: itemId } });
  await writeAudit({ userId: session.user.id, action: "checklist.deleted", objectType: "checklist_item", objectId: itemId });
  revalidatePath(`/wahl/${item.electionId}/checklisten`);
}
