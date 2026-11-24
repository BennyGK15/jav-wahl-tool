"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { importVoters } from "@/server/voters";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const zeile = z.object({
  nachname: z.string().trim().min(1).max(120),
  vorname: z.string().trim().min(1).max(120),
  organisationseinheit: z.string().trim().max(120).nullable(),
  funktion: z.string().trim().max(120).nullable(),
  geburtsdatum: isoDate.refine((d) => d >= "1940-01-01" && d <= todayBerlin()),
  inAusbildung: z.boolean(),
  ausbildungsende: isoDate.nullable(),
  geschlecht: z.enum(["w", "m", "d"]).nullable(),
});

export type ImportResult = {
  error?: string;
  importiert?: number;
  dubletten?: number;
};

/** Erhält nur bereits normalisierte Zeilen – die Datei selbst verlässt den Browser nicht. */
export async function importVotersAction(
  electionId: string,
  rows: unknown,
): Promise<ImportResult> {
  let session;
  try {
    session = await requirePermission("voters.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }
  const id = z.uuid().safeParse(electionId);
  const parsed = z
    .array(zeile)
    .min(1, "Keine Zeilen zum Import")
    .max(2000, "Höchstens 2000 Zeilen je Import")
    .safeParse(rows);
  if (!id.success || !parsed.success)
    return { error: parsed.error?.issues[0]?.message ?? "Ungültige Daten" };
  if (
    !(await prisma.election.findUnique({
      where: { id: id.data },
      select: { id: true },
    }))
  )
    return { error: "Wahl nicht gefunden" };

  const { importiert, dubletten } = await importVoters(id.data, parsed.data);
  await writeAudit({
    userId: session.user.id,
    action: "voters.imported",
    objectType: "election",
    objectId: id.data,
    fields: [`importiert:${importiert}`, `dubletten:${dubletten}`],
  });
  revalidatePath(`/wahl/${id.data}/waehler`);
  return { importiert, dubletten };
}
