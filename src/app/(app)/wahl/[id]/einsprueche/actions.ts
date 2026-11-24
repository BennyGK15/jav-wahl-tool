"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { encrypt, encryptNullable } from "@/lib/crypto";
import { berlinLocalToDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";

const empty = (v: unknown) => (v === "" || v == null ? undefined : v);

const createSchema = z.object({
  electionId: z.string().uuid(),
  voterId: z.preprocess(empty, z.string().uuid().optional()),
  eingangAm: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Eingang (Datum und Uhrzeit) fehlt"),
  begruendung: z.string().trim().min(5, "Bitte Einspruchsführer/in und Inhalt kurz beschreiben").max(4000),
});

export type ObjectionFormState = { error?: string; ok?: boolean };

export async function createObjectionAction(_prev: ObjectionFormState, formData: FormData): Promise<ObjectionFormState> {
  let session;
  try {
    session = await requirePermission("voters.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig" };
  const { electionId, voterId, eingangAm, begruendung } = parsed.data;

  if (voterId) {
    const voter = await prisma.voter.findUnique({ where: { id: voterId }, select: { electionId: true } });
    if (!voter || voter.electionId !== electionId) return { error: "Person nicht gefunden." };
  }

  const id = crypto.randomUUID();
  await prisma.objection.create({
    data: {
      id,
      electionId,
      voterId: voterId ?? null,
      eingangAm: berlinLocalToDate(eingangAm),
      begruendungEnc: encrypt(begruendung, `objection:${id}`),
    },
  });
  await writeAudit({ userId: session.user.id, action: "objection.created", objectType: "objection", objectId: id, fields: ["voterId", "eingangAm", "begruendung"] });
  revalidatePath(`/wahl/${electionId}/einsprueche`);
  return { ok: true };
}

const decideSchema = z.object({
  objectionId: z.string().uuid(),
  entscheidung: z.enum(["offen", "stattgegeben", "zurueckgewiesen"]),
  grund: z.preprocess(empty, z.string().trim().max(4000).optional()),
});

export async function decideObjectionAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const { objectionId, entscheidung, grund } = decideSchema.parse(Object.fromEntries(formData));
  const offen = entscheidung === "offen";
  const objection = await prisma.objection.update({
    where: { id: objectionId },
    data: {
      entscheidung,
      entschiedenAm: offen ? null : new Date(),
      entschiedenVon: offen ? null : session.user.id,
      entscheidungsgrundEnc: offen ? null : encryptNullable(grund, `objection:${objectionId}:grund`),
    },
  });
  await writeAudit({ userId: session.user.id, action: `objection.${entscheidung}`, objectType: "objection", objectId: objectionId, fields: ["entscheidung", "entscheidungsgrund"] });
  revalidatePath(`/wahl/${objection.electionId}/einsprueche`);
}

export async function deleteObjectionAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const objectionId = z.string().uuid().parse(formData.get("objectionId"));
  const objection = await prisma.objection.delete({ where: { id: objectionId }, select: { electionId: true } });
  await writeAudit({ userId: session.user.id, action: "objection.deleted", objectType: "objection", objectId: objectionId });
  revalidatePath(`/wahl/${objection.electionId}/einsprueche`);
}
