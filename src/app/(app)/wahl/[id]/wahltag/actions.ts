"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

const uuid = z.string().uuid();

function refresh(electionId: string) {
  revalidatePath(`/wahl/${electionId}/wahltag`);
  revalidatePath(`/wahl/${electionId}`);
  revalidatePath(`/urne/${electionId}`);
}

export type VoteResult = { ok: boolean; message?: string };

/**
 * Vermerkt die Stimmabgabe im Wählerverzeichnis.
 * Bedingtes Update (nur wenn noch nicht vermerkt) verhindert doppelte Vermerke, auch bei gleichzeitigen Klicks.
 */
export async function markVotedAction(voterId: string, art: "urne" | "brief"): Promise<VoteResult> {
  const session = await requirePermission("voters.markVoted");
  const id = uuid.parse(voterId);
  const kind = z.enum(["urne", "brief"]).parse(art);

  const voter = await prisma.voter.findUnique({ where: { id }, select: { electionId: true, wahlberechtigt: true, nachname: true, vorname: true } });
  if (!voter) return { ok: false, message: "Person nicht gefunden." };
  if (!voter.wahlberechtigt) return { ok: false, message: "Diese Person ist nicht im Wählerverzeichnis (nicht wahlberechtigt)." };

  const { count } = await prisma.voter.updateMany({
    where: { id, votedAt: null },
    data: { votedAt: new Date(), votedMarkedBy: session.user.id, stimmabgabeArt: kind },
  });
  if (count === 0) return { ok: false, message: `${voter.vorname} ${voter.nachname} hat bereits gewählt.` };

  await writeAudit({ userId: session.user.id, action: `vote.marked.${kind}`, objectType: "voter", objectId: id, fields: ["votedAt", "stimmabgabeArt"] });
  refresh(voter.electionId);
  return { ok: true };
}

/** Korrektur eines versehentlichen Vermerks – nur Wahlvorstand, nicht Wahlhelfer. */
export async function undoVotedAction(voterId: string): Promise<VoteResult> {
  const session = await requirePermission("voters.edit");
  const id = uuid.parse(voterId);
  const voter = await prisma.voter.update({
    where: { id },
    data: { votedAt: null, votedMarkedBy: null, stimmabgabeArt: null },
    select: { electionId: true },
  });
  await writeAudit({ userId: session.user.id, action: "vote.unmarked", objectType: "voter", objectId: id, fields: ["votedAt", "stimmabgabeArt"] });
  refresh(voter.electionId);
  return { ok: true };
}

const STEP_FIELD = {
  beantragt: "briefwahlBeantragtAm",
  versandt: "briefwahlVersandtAm",
  eingegangen: "briefwahlEingangAm",
} as const;

/** Briefwahl: Antrag, Versand der Unterlagen, Eingang des Wahlbriefs (setzen oder zurücknehmen). */
export async function briefwahlStepAction(voterId: string, step: keyof typeof STEP_FIELD): Promise<VoteResult> {
  const session = await requirePermission("voters.edit");
  const id = uuid.parse(voterId);
  const field = STEP_FIELD[z.enum(["beantragt", "versandt", "eingegangen"]).parse(step)];
  const voter = await prisma.voter.findUnique({ where: { id } });
  if (!voter) return { ok: false, message: "Person nicht gefunden." };
  if (!voter.wahlberechtigt) return { ok: false, message: "Nur Wahlberechtigte können Briefwahl beantragen." };

  const setzen = voter[field] == null;
  if (setzen && field === "briefwahlVersandtAm" && !voter.briefwahlBeantragtAm) {
    return { ok: false, message: "Bitte zuerst den Antrag erfassen." };
  }
  if (setzen && field === "briefwahlEingangAm" && !voter.briefwahlVersandtAm) {
    return { ok: false, message: "Bitte zuerst den Versand der Unterlagen erfassen." };
  }
  await prisma.voter.update({ where: { id }, data: { [field]: setzen ? new Date() : null } });
  await writeAudit({ userId: session.user.id, action: `briefwahl.${step}.${setzen ? "set" : "unset"}`, objectType: "voter", objectId: id, fields: [field] });
  refresh(voter.electionId);
  return { ok: true };
}
