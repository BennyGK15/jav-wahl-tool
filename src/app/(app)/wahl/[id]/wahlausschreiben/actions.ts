"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { computeSchedule } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { angabenSchema, parseAngaben } from "@/lib/wahlausschreiben";
import { loadRules, recalculateDeadlines } from "@/server/elections";
import { buildWahlausschreiben } from "@/server/wahlausschreiben";

export type FormState = { error?: string; ok?: boolean; message?: string };

const ANGABEN_KEYS = Object.keys(
  angabenSchema.shape,
) as (keyof typeof angabenSchema.shape)[];

function refresh(electionId: string) {
  revalidatePath(`/wahl/${electionId}`);
  revalidatePath(`/wahl/${electionId}/wahlausschreiben`);
}

export async function saveAngabenAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let session;
  try {
    session = await requirePermission("election.manage");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { error: "Nur der Vorsitz kann das Wahlausschreiben bearbeiten." };
    throw e;
  }
  const electionId = z.uuid().safeParse(formData.get("electionId"));
  if (!electionId.success) return { error: "Wahl nicht gefunden" };

  // Vorhandene Angaben übernehmen; nur Felder aus diesem Formular setzen bzw. (leer) entfernen
  const vorher = await prisma.election.findUnique({
    where: { id: electionId.data },
    select: { wahlausschreibenAngaben: true },
  });
  // Alle vorhandenen Angaben behalten – auch strukturierte wie die Liste des Wahlvorstands
  const raw: Record<string, unknown> = {
    ...parseAngaben(vorher?.wahlausschreibenAngaben),
  };
  for (const k of ANGABEN_KEYS) {
    if (!formData.has(k)) continue;
    const v = String(formData.get(k) ?? "").trim();
    if (v) raw[k] = v;
    else delete raw[k];
  }
  const angaben = angabenSchema.safeParse(raw);
  if (!angaben.success)
    return { error: angaben.error.issues[0]?.message ?? "Eingabe ungültig" };

  const erlassRaw = String(formData.get("wahlausschreibenAm") ?? "");
  const erlass =
    erlassRaw === ""
      ? null
      : z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .safeParse(erlassRaw);
  if (erlass && !erlass.success)
    return { error: "Datum des Erlasses ungültig" };

  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId.data },
  });
  if (erlass?.success) {
    // Zu spätes Erlassdatum vor dem Speichern abfangen
    try {
      computeSchedule(
        fromDbDate(election.wahltag),
        await loadRules(election.verfahren),
        {
          wahlausschreibenAm: erlass.data,
          amtszeitEnde: election.amtszeitEnde
            ? fromDbDate(election.amtszeitEnde)
            : undefined,
        },
      );
    } catch (e) {
      return {
        error:
          e instanceof Error ? e.message : "Datum des Erlasses nicht zulässig",
      };
    }
  }

  await prisma.election.update({
    where: { id: election.id },
    data: {
      wahlausschreibenAngaben: angaben.data,
      wahlausschreibenAm: erlass?.success ? toDbDate(erlass.data) : null,
    },
  });
  await recalculateDeadlines(election.id);
  await writeAudit({
    userId: session.user.id,
    action: "wahlausschreiben.saved",
    objectType: "election",
    objectId: election.id,
    fields: [...ANGABEN_KEYS, "wahlausschreibenAm"],
  });
  refresh(election.id);
  return {
    ok: true,
    message: "Gespeichert. Der Wahlkalender wurde neu berechnet.",
  };
}

export async function releaseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let session;
  try {
    session = await requirePermission("documents.release");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { error: "Nur der Vorsitz kann das Wahlausschreiben freigeben." };
    throw e;
  }
  const electionId = z.uuid().parse(formData.get("electionId"));
  const { fehlend, sha256 } = await buildWahlausschreiben(electionId);
  if (fehlend.length)
    return {
      error: `Es fehlen noch Angaben: ${fehlend.map((f) => f.label).join(", ")}.`,
    };

  const latest = await prisma.document.findFirst({
    where: { electionId, typ: "wahlausschreiben" },
    orderBy: { version: "desc" },
  });
  if (latest?.sha256 === sha256)
    return {
      error: `Dieser Stand ist bereits als Version ${latest.version} freigegeben.`,
    };

  const version = (latest?.version ?? 0) + 1;
  await prisma.$transaction([
    prisma.document.create({
      data: {
        electionId,
        typ: "wahlausschreiben",
        version,
        sha256,
        freigegebenAm: new Date(),
        freigegebenVon: session.user.id,
      },
    }),
    prisma.deadline.updateMany({
      where: { electionId, ruleKey: "wahlausschreiben", erledigtAm: null },
      data: { erledigtAm: new Date(), erledigtVon: session.user.id },
    }),
    prisma.election.updateMany({
      where: { id: electionId, status: "vorbereitung" },
      data: { status: "eingeleitet" },
    }),
  ]);
  await writeAudit({
    userId: session.user.id,
    action: "wahlausschreiben.released",
    objectType: "election",
    objectId: electionId,
    fields: ["version", "sha256"],
  });
  refresh(electionId);
  return {
    ok: true,
    message: `Version ${version} freigegeben. Jetzt drucken, unterschreiben und aushängen.`,
  };
}

/** Ergebnis des Losentscheids bei der Verteilung der Sitze auf Frauen und Männer festhalten. */
export async function setGeschlechterLosAction(
  formData: FormData,
): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = z.uuid().parse(formData.get("electionId"));
  const gewinner = z.enum(["w", "m", ""]).parse(formData.get("gewinner") ?? "");
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });
  const angaben = { ...parseAngaben(election.wahlausschreibenAngaben) };
  if (gewinner) angaben.geschlechterLos = gewinner;
  else delete angaben.geschlechterLos;
  await prisma.election.update({
    where: { id: electionId },
    data: { wahlausschreibenAngaben: angaben },
  });
  await writeAudit({
    userId: session.user.id,
    action: "election.gender_lot",
    objectType: "election",
    objectId: electionId,
    fields: ["geschlechterLos"],
  });
  revalidatePath(`/wahl/${electionId}`, "layout");
}
