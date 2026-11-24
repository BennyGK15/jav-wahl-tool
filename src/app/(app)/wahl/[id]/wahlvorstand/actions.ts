"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import {
  parseAngaben,
  wahlvorstandSchema,
  type WahlvorstandMitglied,
} from "@/lib/wahlausschreiben";

export type WahlvorstandState = { error?: string; ok?: boolean };

const ZEILEN = 7;

/** Wahlvorstand mit Ersatzmitgliedern speichern (§ 62 Abs. 1 LPVG, § 1 Abs. 3 LPVGWO). */
export async function saveWahlvorstandAction(
  _prev: WahlvorstandState,
  formData: FormData,
): Promise<WahlvorstandState> {
  const session = await requirePermission("election.manage");
  const electionId = z.uuid().parse(formData.get("electionId"));
  const bestelltRoh = String(formData.get("bestelltAm") ?? "").trim();
  if (bestelltRoh && !/^\d{4}-\d{2}-\d{2}$/.test(bestelltRoh))
    return { error: "Datum der Bestimmung ungültig" };

  const liste: WahlvorstandMitglied[] = [];
  for (let i = 0; i < ZEILEN; i++) {
    const name = String(formData.get(`name_${i}`) ?? "").trim();
    if (!name) continue;
    liste.push({
      name,
      funktion: z
        .enum(["vorsitz", "stellvertretung", "mitglied"])
        .catch("mitglied")
        .parse(formData.get(`funktion_${i}`)),
      ersatz: String(formData.get(`ersatz_${i}`) ?? "").trim() || undefined,
      prWaehlbar: formData.get(`pr_${i}`) === "on",
    });
  }
  const geprueft = wahlvorstandSchema.safeParse(liste);
  if (!geprueft.success)
    return { error: geprueft.error.issues[0]?.message ?? "Eingabe ungültig" };
  if (liste.filter((m) => m.funktion === "vorsitz").length > 1)
    return { error: "Es kann nur einen Vorsitz geben." };

  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });
  const angaben = { ...parseAngaben(election.wahlausschreibenAngaben) };
  if (liste.length) angaben.wahlvorstand = geprueft.data;
  else delete angaben.wahlvorstand;
  if (bestelltRoh) angaben.wahlvorstandBestelltAm = bestelltRoh;
  else delete angaben.wahlvorstandBestelltAm;
  await prisma.election.update({
    where: { id: electionId },
    data: { wahlausschreibenAngaben: angaben },
  });
  await writeAudit({
    userId: session.user.id,
    action: "election.wahlvorstand",
    objectType: "election",
    objectId: electionId,
    fields: ["wahlvorstand"],
  });
  revalidatePath(`/wahl/${electionId}`, "layout");
  return { ok: true };
}
