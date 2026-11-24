"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { createVoter, renumberAlphabetically, updateVoter } from "@/server/voters";

const empty = (v: unknown) => (v === "" || v == null ? undefined : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig");

const schema = z.object({
  electionId: z.string().uuid(),
  voterId: z.preprocess(empty, z.string().uuid().optional()),
  nachname: z.string().trim().min(1, "Nachname fehlt").max(120),
  vorname: z.string().trim().min(1, "Vorname fehlt").max(120),
  organisationseinheit: z.preprocess(empty, z.string().trim().max(120).optional()),
  funktion: z.preprocess(empty, z.string().trim().max(120).optional()),
  geburtsdatum: isoDate.refine((d) => d >= "1940-01-01" && d <= todayBerlin(), "Geburtsdatum ist nicht plausibel"),
  inAusbildung: z.preprocess((v) => v === "on", z.boolean()),
  ausbildungsende: z.preprocess(empty, isoDate.optional()),
  geschlecht: z.preprocess(empty, z.enum(["w", "m", "d"]).optional()),
});

export type VoterFormState = { error?: string; ok?: boolean; message?: string };

const SAVED_FIELDS = ["nachname", "vorname", "organisationseinheit", "funktion", "geburtsdatum", "inAusbildung", "ausbildungsende", "geschlecht"];

export async function saveVoterAction(_prev: VoterFormState, formData: FormData): Promise<VoterFormState> {
  let session;
  try {
    session = await requirePermission("voters.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig" };
  const { electionId, voterId, ...input } = parsed.data;
  if (input.ausbildungsende && !input.inAusbildung) {
    return { error: "Ein Ausbildungsende ist nur bei Personen in Ausbildung sinnvoll." };
  }

  if (voterId) {
    const existing = await prisma.voter.findUnique({ where: { id: voterId }, select: { electionId: true } });
    if (!existing || existing.electionId !== electionId) return { error: "Person nicht gefunden." };
    await updateVoter(voterId, input);
    await writeAudit({ userId: session.user.id, action: "voter.updated", objectType: "voter", objectId: voterId, fields: SAVED_FIELDS });
    revalidatePath(`/wahl/${electionId}/waehler`);
    redirect(`/wahl/${electionId}/waehler`);
  }

  const voter = await createVoter(electionId, input);
  await writeAudit({ userId: session.user.id, action: "voter.created", objectType: "voter", objectId: voter.id, fields: SAVED_FIELDS });
  revalidatePath(`/wahl/${electionId}/waehler`);
  return {
    ok: true,
    message: `${input.vorname} ${input.nachname} erfasst (Nr. ${voter.lfdNr}) – ${
      voter.wahlberechtigt ? "wahlberechtigt" : voter.waehlbar ? "nicht wahlberechtigt, aber wählbar" : "weder wahlberechtigt noch wählbar"
    }.`,
  };
}

export async function deleteVoterAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const voterId = z.string().uuid().parse(formData.get("voterId"));
  const voter = await prisma.voter.delete({ where: { id: voterId }, select: { electionId: true } });
  await writeAudit({ userId: session.user.id, action: "voter.deleted", objectType: "voter", objectId: voterId });
  revalidatePath(`/wahl/${voter.electionId}/waehler`);
}

export async function renumberAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const electionId = z.string().uuid().parse(formData.get("electionId"));
  await renumberAlphabetically(electionId);
  await writeAudit({ userId: session.user.id, action: "voters.renumbered", objectType: "election", objectId: electionId });
  revalidatePath(`/wahl/${electionId}/waehler`);
}
