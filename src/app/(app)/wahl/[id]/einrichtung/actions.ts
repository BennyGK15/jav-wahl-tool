"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { bereitZumAbschluss, ortFelder } from "@/lib/einrichtung";
import { FRISTENDEN_MIT_UHRZEIT } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { angabenSchema, parseAngaben } from "@/lib/wahlausschreiben";
import { recalculateDeadlines } from "@/server/elections";
import { loadEinrichtung } from "@/server/einrichtung";

export type EinrichtungState = { error?: string; ok?: boolean };

const uuid = z.uuid();

async function berechtigt() {
  try {
    return { session: await requirePermission("election.manage") };
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { error: "Nur der Vorsitz kann die Wahl einrichten." };
    throw e;
  }
}

/** Orte und Zeiten: nur die Felder dieses Schritts setzen, alle übrigen Angaben behalten. */
export async function saveOrteAction(
  _prev: EinrichtungState,
  formData: FormData,
): Promise<EinrichtungState> {
  const b = await berechtigt();
  if (!b.session) return { error: b.error };
  const electionId = uuid.safeParse(formData.get("electionId"));
  if (!electionId.success) return { error: "Wahl nicht gefunden" };
  const election = await prisma.election.findUnique({
    where: { id: electionId.data },
  });
  if (!election) return { error: "Wahl nicht gefunden" };

  const felder = ortFelder(election.verfahren);
  const raw: Record<string, unknown> = {
    ...parseAngaben(election.wahlausschreibenAngaben),
  };
  const leer: string[] = [];
  for (const f of felder) {
    const v = String(formData.get(f.key) ?? "").trim();
    if (v) raw[f.key] = v;
    else {
      delete raw[f.key];
      if (f.pflicht) leer.push(f.label);
    }
  }
  const angaben = angabenSchema.safeParse(raw);
  if (!angaben.success)
    return { error: angaben.error.issues[0]?.message ?? "Eingabe ungültig" };
  const a = angaben.data;
  if (a.wahlzeitVon && a.wahlzeitBis && a.wahlzeitBis <= a.wahlzeitVon)
    return { error: "Das Ende der Wahlzeit muss nach dem Beginn liegen." };
  if (a.wahlzeitBis && a.auszaehlungZeit && a.auszaehlungZeit < a.wahlzeitBis)
    return {
      error: "Die Auszählung kann erst nach dem Ende der Wahlzeit beginnen.",
    };

  await prisma.$transaction([
    prisma.election.update({
      where: { id: election.id },
      data: { wahlausschreibenAngaben: a },
    }),
    ...(a.dienstschluss
      ? [
          prisma.deadline.updateMany({
            where: {
              electionId: election.id,
              ruleKey: { in: [...FRISTENDEN_MIT_UHRZEIT] },
              uhrzeit: null,
            },
            data: { uhrzeit: a.dienstschluss },
          }),
        ]
      : []),
  ]);
  await writeAudit({
    userId: b.session.user.id,
    action: "election.einrichtung",
    objectType: "election",
    objectId: election.id,
    fields: felder.map((f) => f.key),
  });
  revalidatePath(`/wahl/${election.id}`, "layout");
  if (leer.length)
    return { error: `Gespeichert. Es fehlen noch: ${leer.join(", ")}.` };
  return { ok: true };
}

export async function saveStuetzAction(
  _prev: EinrichtungState,
  formData: FormData,
): Promise<EinrichtungState> {
  const b = await berechtigt();
  if (!b.session) return { error: b.error };
  const electionId = uuid.safeParse(formData.get("electionId"));
  if (!electionId.success) return { error: "Wahl nicht gefunden" };
  const min = z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .safeParse(formData.get("min"));
  if (!min.success || String(formData.get("min") ?? "").trim() === "")
    return { error: "Bitte eine ganze Zahl zwischen 0 und 50 angeben." };
  await prisma.election.update({
    where: { id: electionId.data },
    data: { stuetzunterschriftenMin: min.data },
  });
  await writeAudit({
    userId: b.session.user.id,
    action: "election.minSupporters",
    objectType: "election",
    objectId: electionId.data,
    fields: ["stuetzunterschriftenMin"],
  });
  revalidatePath(`/wahl/${electionId.data}`, "layout");
  return { ok: true };
}

/** Prüft alles, berechnet den Wahlkalender mit Dienstschluss und schaltet die Wahl frei. */
export async function abschliessenAction(
  _prev: EinrichtungState,
  formData: FormData,
): Promise<EinrichtungState> {
  const b = await berechtigt();
  if (!b.session) return { error: b.error };
  const electionId = uuid.safeParse(formData.get("electionId"));
  if (!electionId.success) return { error: "Wahl nicht gefunden" };
  const election = await prisma.election.findUnique({
    where: { id: electionId.data },
  });
  if (!election) return { error: "Wahl nicht gefunden" };
  const { schritte } = await loadEinrichtung(election);
  if (!bereitZumAbschluss(schritte)) {
    const offen = schritte
      .filter((s) => s.key !== "abschluss" && !s.erledigt)
      .map((s) => s.titel);
    return { error: `Noch nicht vollständig: ${offen.join(", ")}.` };
  }
  await recalculateDeadlines(election.id);
  const dienstschluss = parseAngaben(
    election.wahlausschreibenAngaben,
  ).dienstschluss;
  if (dienstschluss) {
    await prisma.deadline.updateMany({
      where: {
        electionId: election.id,
        ruleKey: { in: [...FRISTENDEN_MIT_UHRZEIT] },
        uhrzeit: null,
      },
      data: { uhrzeit: dienstschluss },
    });
  }
  await prisma.election.update({
    where: { id: election.id },
    data: { einrichtungOffen: false },
  });
  await writeAudit({
    userId: b.session.user.id,
    action: "election.einrichtungAbgeschlossen",
    objectType: "election",
    objectId: election.id,
  });
  revalidatePath("/", "layout");
  redirect("/");
}
