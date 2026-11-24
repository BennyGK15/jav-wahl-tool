"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { loeschVorschlag } from "@/lib/aufbewahrung";
import { fromDbDate, todayBerlin, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";

const uuid = z.uuid();
export type FormState = { error?: string; ok?: boolean; message?: string };

function refresh() {
  revalidatePath("/aufbewahrung");
  revalidatePath("/");
}

/** Löschstand einer Wahl (§ 32 LPVGWO) aus Anfechtungsfrist und erfasster Anfechtung. */
async function loeschStand(electionId: string) {
  const [e, frist] = await Promise.all([
    prisma.election.findUniqueOrThrow({
      where: { id: electionId },
      select: { anfechtungAm: true, anfechtungErledigtAm: true },
    }),
    prisma.deadline.findUnique({
      where: { electionId_ruleKey: { electionId, ruleKey: "anfechtung_ende" } },
    }),
  ]);
  return loeschVorschlag({
    anfechtungsfristEnde: frist ? fromDbDate(frist.datum) : null,
    anfechtungAm: e.anfechtungAm ? fromDbDate(e.anfechtungAm) : null,
    anfechtungErledigtAm: e.anfechtungErledigtAm
      ? fromDbDate(e.anfechtungErledigtAm)
      : null,
  });
}

async function guard(
  fn: (userId: string) => Promise<FormState>,
): Promise<FormState> {
  try {
    const session = await requirePermission("retention.execute");
    return await fn(session.user.id);
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    if (e instanceof z.ZodError)
      return { error: e.issues[0]?.message ?? "Eingabe ungültig" };
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
}

export async function setRetentionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guard(async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    const datum = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt")
      .parse(formData.get("retentionUntil"));
    const election = await prisma.election.findUniqueOrThrow({
      where: { id: electionId },
    });
    if (datum <= fromDbDate(election.wahltag))
      throw new Error("Die Aufbewahrungsfrist muss nach dem Wahltag enden.");
    const v = await loeschStand(electionId);
    if (v.gesperrt) throw new Error(v.grund);
    if (v.fruehestens && datum < v.fruehestens) {
      throw new Error(
        `Die Gültigkeit der Wahl steht erst danach fest – frühestens ${v.fruehestens.split("-").reverse().join(".")} (§ 32 LPVGWO).`,
      );
    }
    await prisma.election.update({
      where: { id: electionId },
      data: { retentionUntil: toDbDate(datum) },
    });
    await writeAudit({
      userId,
      action: "retention.set",
      objectType: "election",
      objectId: electionId,
      fields: ["retentionUntil"],
    });
    refresh();
    return { ok: true, message: "Aufbewahrungsfrist gespeichert." };
  });
}

export async function closeElectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guard(async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    const election = await prisma.election.findUniqueOrThrow({
      where: { id: electionId },
      include: { result: true },
    });
    if (!election.retentionUntil)
      throw new Error("Bitte zuerst die Aufbewahrungsfrist festlegen.");
    if (!election.result?.festgestelltAm)
      throw new Error("Das Wahlergebnis ist noch nicht festgestellt.");
    await prisma.election.update({
      where: { id: electionId },
      data: { status: "abgeschlossen", abgeschlossenAm: new Date() },
    });
    await writeAudit({
      userId,
      action: "election.closed",
      objectType: "election",
      objectId: electionId,
    });
    refresh();
    return { ok: true, message: "Wahl abgeschlossen." };
  });
}

/**
 * Löscht eine Wahl mit ALLEN personenbezogenen Daten (Kaskade): Wählerverzeichnis, Einsprüche,
 * Wahlvorschläge, Ergebnis, Dokumente, Fristen, Checklisten. Das Audit-Log enthält keine Inhalte und bleibt.
 */
export async function deleteElectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guard(async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    const bestaetigung = String(formData.get("bestaetigung") ?? "").trim();
    const election = await prisma.election.findUniqueOrThrow({
      where: { id: electionId },
    });
    if (election.status !== "abgeschlossen")
      throw new Error("Nur abgeschlossene Wahlen können gelöscht werden.");
    if (
      !election.retentionUntil ||
      fromDbDate(election.retentionUntil) > todayBerlin()
    ) {
      throw new Error("Die Aufbewahrungsfrist ist noch nicht abgelaufen.");
    }
    if (bestaetigung !== election.dienststelle)
      throw new Error(
        "Zur Bestätigung bitte den Namen der Dienststelle exakt eingeben.",
      );
    const v = await loeschStand(electionId);
    if (v.gesperrt) throw new Error(v.grund);

    const personen = await prisma.voter.count({ where: { electionId } });
    await prisma.election.delete({ where: { id: electionId } });
    await writeAudit({
      userId,
      action: "election.deleted",
      objectType: "election",
      objectId: electionId,
      fields: [`personen:${personen}`],
    });
    refresh();
    return {
      ok: true,
      message: `Wahl und ${personen} Personendatensätze endgültig gelöscht.`,
    };
  });
}

/** Wahlanfechtung erfassen bzw. ihren Abschluss eintragen (§ 21 LPVG) – sperrt bzw. gibt die Löschung frei. */
export async function setAnfechtungAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guard(async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    const datum = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      return v === ""
        ? null
        : z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig")
            .parse(v);
    };
    const am = datum("anfechtungAm");
    const erledigt = datum("anfechtungErledigtAm");
    if (erledigt && !am)
      throw new Error("Bitte zuerst den Tag der Anfechtung eintragen.");
    if (am && erledigt && erledigt < am)
      throw new Error("Der Abschluss kann nicht vor der Anfechtung liegen.");
    await prisma.election.update({
      where: { id: electionId },
      data: {
        anfechtungAm: am ? toDbDate(am) : null,
        anfechtungErledigtAm: erledigt ? toDbDate(erledigt) : null,
        // Laufende Anfechtung: eine schon gesetzte Löschfrist aufheben
        ...(am && !erledigt ? { retentionUntil: null } : {}),
      },
    });
    await writeAudit({
      userId,
      action: "election.contest",
      objectType: "election",
      objectId: electionId,
      fields: ["anfechtungAm", "anfechtungErledigtAm"],
    });
    refresh();
    return {
      ok: true,
      message:
        am && !erledigt
          ? "Anfechtung erfasst – Löschung gesperrt."
          : "Gespeichert.",
    };
  });
}
