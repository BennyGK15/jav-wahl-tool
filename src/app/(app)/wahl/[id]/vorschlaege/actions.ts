"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { berlinLocalToDate, fromDbDate, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { recalculateDeadlines } from "@/server/elections";
import {
  assertNominationEditable,
  renumberCandidates,
} from "@/server/nominations";

const uuid = z.uuid();
const empty = (v: unknown) => (v === "" || v == null ? undefined : v);

function refresh(electionId: string, nominationId?: string) {
  revalidatePath(`/wahl/${electionId}/vorschlaege`);
  if (nominationId)
    revalidatePath(`/wahl/${electionId}/vorschlaege/${nominationId}`);
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

export async function setMinSupportersAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = uuid.parse(formData.get("electionId"));
  const min = z
    .preprocess(empty, z.coerce.number().int().min(0).max(1000).optional())
    .parse(formData.get("min"));
  await prisma.election.update({
    where: { id: electionId },
    data: { stuetzunterschriftenMin: min ?? null },
  });
  await writeAudit({
    userId: session.user.id,
    action: "election.minSupporters",
    objectType: "election",
    objectId: electionId,
    fields: ["stuetzunterschriftenMin"],
  });
  refresh(electionId);
}

// ---------------------------------------------------------------------------
// Wahlvorschlag anlegen / Stammdaten
// ---------------------------------------------------------------------------

const metaSchema = z
  .object({
    kennwort: z.preprocess(empty, z.string().trim().max(120).optional()),
    einreicherArt: z.enum(["beschaeftigte", "gewerkschaft"]),
    gewerkschaft: z.preprocess(empty, z.string().trim().max(120).optional()),
    eingangAm: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
        "Eingang (Datum und Uhrzeit) fehlt",
      ),
  })
  .refine(
    (d) => d.einreicherArt !== "gewerkschaft" || Boolean(d.gewerkschaft),
    {
      message: "Bitte die einreichende Gewerkschaft angeben",
    },
  );

export type NominationFormState = { error?: string };

export async function createNominationAction(
  _prev: NominationFormState,
  formData: FormData,
): Promise<NominationFormState> {
  let session;
  try {
    session = await requirePermission("nominations.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }
  const electionId = uuid.safeParse(formData.get("electionId"));
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!electionId.success || !parsed.success)
    return { error: parsed.error?.issues[0]?.message ?? "Eingabe ungültig" };

  const d = parsed.data;
  const nomination = await prisma.nomination.create({
    data: {
      electionId: electionId.data,
      kennwort: d.kennwort ?? null,
      einreicherArt: d.einreicherArt,
      gewerkschaft:
        d.einreicherArt === "gewerkschaft" ? (d.gewerkschaft ?? null) : null,
      eingangAm: berlinLocalToDate(d.eingangAm),
    },
  });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.created",
    objectType: "nomination",
    objectId: nomination.id,
    fields: ["kennwort", "einreicherArt", "gewerkschaft", "eingangAm"],
  });
  refresh(electionId.data);
  redirect(`/wahl/${electionId.data}/vorschlaege/${nomination.id}`);
}

export async function updateNominationMetaAction(
  _prev: NominationFormState,
  formData: FormData,
): Promise<NominationFormState> {
  let session;
  try {
    session = await requirePermission("nominations.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }
  const nominationId = uuid.safeParse(formData.get("nominationId"));
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!nominationId.success || !parsed.success)
    return { error: parsed.error?.issues[0]?.message ?? "Eingabe ungültig" };
  try {
    await assertNominationEditable(nominationId.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nicht änderbar" };
  }
  const d = parsed.data;
  const n = await prisma.nomination.update({
    where: { id: nominationId.data },
    data: {
      kennwort: d.kennwort ?? null,
      einreicherArt: d.einreicherArt,
      gewerkschaft:
        d.einreicherArt === "gewerkschaft" ? (d.gewerkschaft ?? null) : null,
      eingangAm: berlinLocalToDate(d.eingangAm),
    },
  });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.updated",
    objectType: "nomination",
    objectId: n.id,
    fields: ["kennwort", "einreicherArt", "gewerkschaft", "eingangAm"],
  });
  refresh(n.electionId, n.id);
  return {};
}

// ---------------------------------------------------------------------------
// Bewerberinnen und Bewerber
// ---------------------------------------------------------------------------

export async function addCandidateAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const nominationId = uuid.parse(formData.get("nominationId"));
  const voterId = uuid.parse(formData.get("voterId"));
  const zustimmung = formData.get("zustimmung") === "on";
  const n = await assertNominationEditable(nominationId);

  const voter = await prisma.voter.findUniqueOrThrow({
    where: { id: voterId },
  });
  if (voter.electionId !== n.electionId)
    throw new Error("Person gehört nicht zu dieser Wahl");
  const exists = await prisma.nominationCandidate.findFirst({
    where: { nominationId, voterId },
  });
  if (!exists) {
    const max = await prisma.nominationCandidate.aggregate({
      where: { nominationId },
      _max: { listenplatz: true },
    });
    await prisma.nominationCandidate.create({
      data: {
        nominationId,
        voterId,
        listenplatz: (max._max.listenplatz ?? 0) + 1,
        zustimmungLiegtVor: zustimmung,
      },
    });
    await writeAudit({
      userId: session.user.id,
      action: "nomination.candidate.added",
      objectType: "nomination",
      objectId: nominationId,
    });
  }
  refresh(n.electionId, nominationId);
}

export async function toggleConsentAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const candidateId = uuid.parse(formData.get("candidateId"));
  const c = await prisma.nominationCandidate.findUniqueOrThrow({
    where: { id: candidateId },
  });
  const n = await assertNominationEditable(c.nominationId);
  await prisma.nominationCandidate.update({
    where: { id: candidateId },
    data: { zustimmungLiegtVor: !c.zustimmungLiegtVor },
  });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.candidate.consent",
    objectType: "nomination",
    objectId: n.id,
    fields: ["zustimmungLiegtVor"],
  });
  refresh(n.electionId, n.id);
}

export async function moveCandidateAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const candidateId = uuid.parse(formData.get("candidateId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const c = await prisma.nominationCandidate.findUniqueOrThrow({
    where: { id: candidateId },
  });
  const n = await assertNominationEditable(c.nominationId);
  const ids = (
    await prisma.nominationCandidate.findMany({
      where: { nominationId: n.id },
      orderBy: { listenplatz: "asc" },
      select: { id: true },
    })
  ).map((x) => x.id);
  const i = ids.indexOf(candidateId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i >= 0 && j >= 0 && j < ids.length) {
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await renumberCandidates(n.id, ids);
    await writeAudit({
      userId: session.user.id,
      action: "nomination.candidate.moved",
      objectType: "nomination",
      objectId: n.id,
      fields: ["listenplatz"],
    });
  }
  refresh(n.electionId, n.id);
}

export async function removeCandidateAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const candidateId = uuid.parse(formData.get("candidateId"));
  const c = await prisma.nominationCandidate.findUniqueOrThrow({
    where: { id: candidateId },
  });
  const n = await assertNominationEditable(c.nominationId);
  await prisma.nominationCandidate.delete({ where: { id: candidateId } });
  await renumberCandidates(n.id);
  await writeAudit({
    userId: session.user.id,
    action: "nomination.candidate.removed",
    objectType: "nomination",
    objectId: n.id,
  });
  refresh(n.electionId, n.id);
}

// ---------------------------------------------------------------------------
// Stützunterschriften
// ---------------------------------------------------------------------------

export async function addSupporterAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const nominationId = uuid.parse(formData.get("nominationId"));
  const voterId = uuid.parse(formData.get("voterId"));
  const n = await assertNominationEditable(nominationId);
  const voter = await prisma.voter.findUniqueOrThrow({
    where: { id: voterId },
  });
  if (voter.electionId !== n.electionId)
    throw new Error("Person gehört nicht zu dieser Wahl");
  await prisma.nominationSupporter.upsert({
    where: { nominationId_voterId: { nominationId, voterId } },
    create: { nominationId, voterId },
    update: {},
  });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.supporter.added",
    objectType: "nomination",
    objectId: nominationId,
  });
  refresh(n.electionId, nominationId);
}

export async function removeSupporterAction(formData: FormData): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const supporterId = uuid.parse(formData.get("supporterId"));
  const s = await prisma.nominationSupporter.findUniqueOrThrow({
    where: { id: supporterId },
  });
  const n = await assertNominationEditable(s.nominationId);
  await prisma.nominationSupporter.delete({ where: { id: supporterId } });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.supporter.removed",
    objectType: "nomination",
    objectId: n.id,
  });
  refresh(n.electionId, n.id);
}

// ---------------------------------------------------------------------------
// Entscheidung, Löschen
// ---------------------------------------------------------------------------

export async function decideNominationAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const data = z
    .object({
      nominationId: uuid,
      status: z.enum(["eingegangen", "gueltig", "ungueltig", "zurueckgegeben"]),
      pruefnotiz: z.preprocess(empty, z.string().trim().max(4000).optional()),
      ordnungsnummer: z.preprocess(
        empty,
        z.coerce.number().int().min(1).max(99).optional(),
      ),
    })
    .parse(Object.fromEntries(formData));
  const n = await prisma.nomination.update({
    where: { id: data.nominationId },
    data: {
      status: data.status,
      pruefnotiz: data.pruefnotiz ?? null,
      ordnungsnummer: data.ordnungsnummer ?? null,
    },
  });
  await writeAudit({
    userId: session.user.id,
    action: `nomination.${data.status}`,
    objectType: "nomination",
    objectId: n.id,
    fields: ["status", "pruefnotiz", "ordnungsnummer"],
  });
  refresh(n.electionId, n.id);
}

export async function deleteNominationAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const nominationId = uuid.parse(formData.get("nominationId"));
  const n = await prisma.nomination.delete({ where: { id: nominationId } });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.deleted",
    objectType: "nomination",
    objectId: nominationId,
  });
  refresh(n.electionId);
  redirect(`/wahl/${n.electionId}/vorschlaege`);
}

// ---------------------------------------------------------------------------
// Nachfrist (§ 16 LPVGWO)
// ---------------------------------------------------------------------------

export async function setNachfristAction(formData: FormData): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = uuid.parse(formData.get("electionId"));
  const aufheben = formData.get("aufheben") === "1";
  const datum = aufheben
    ? null
    : z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .parse(formData.get("datum"));

  if (datum) {
    const ende = await prisma.deadline.findUnique({
      where: {
        electionId_ruleKey: { electionId, ruleKey: "wahlvorschlaege_ende" },
      },
    });
    if (ende && datum < fromDbDate(ende.datum))
      throw new Error(
        "Die Nachfrist kann erst nach Ablauf der regulären Einreichungsfrist bekannt gemacht werden.",
      );
  }
  await prisma.election.update({
    where: { id: electionId },
    data: { nachfristBekanntgemachtAm: datum ? toDbDate(datum) : null },
  });
  if (!datum)
    await prisma.deadline.deleteMany({
      where: { electionId, ruleKey: "nachfrist_ende", erledigtAm: null },
    });
  await recalculateDeadlines(electionId);
  await writeAudit({
    userId: session.user.id,
    action: "election.nachfrist",
    objectType: "election",
    objectId: electionId,
    fields: ["nachfristBekanntgemachtAm"],
  });
  refresh(electionId);
  revalidatePath(`/wahl/${electionId}`);
}

/** Schriftliche Begründung für eine abweichende Verteilung von Frauen und Männern (§ 12 Abs. 2 Satz 2 LPVGWO). */
export async function setGeschlechterBegruendungAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission("nominations.edit");
  const nominationId = uuid.parse(formData.get("nominationId"));
  const text = z
    .string()
    .trim()
    .max(4000)
    .parse(formData.get("begruendung") ?? "");
  const n = await assertNominationEditable(nominationId);
  await prisma.nomination.update({
    where: { id: nominationId },
    data: { geschlechterBegruendung: text || null },
  });
  await writeAudit({
    userId: session.user.id,
    action: "nomination.updated",
    objectType: "nomination",
    objectId: nominationId,
    fields: ["geschlechterBegruendung"],
  });
  refresh(n.electionId, nominationId);
}
