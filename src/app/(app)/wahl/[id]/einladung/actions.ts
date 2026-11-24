"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseAngaben } from "@/lib/wahlausschreiben";

const zeit = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit im Format HH:MM");

/** Speichert Ort, Uhrzeit und Ausstellungsort der Wahlversammlung (ergänzt die übrigen Angaben). */
export async function saveEinladungAction(formData: FormData): Promise<void> {
  const session = await requirePermission("election.manage");
  const electionId = z.string().uuid().parse(formData.get("electionId"));
  const data = z
    .object({ wahlraum: z.string().trim().min(2).max(255), wahlzeitVon: zeit, ausstellungsort: z.string().trim().min(2).max(120) })
    .parse(Object.fromEntries(formData));
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId } });
  await prisma.election.update({
    where: { id: electionId },
    data: { wahlausschreibenAngaben: { ...parseAngaben(election.wahlausschreibenAngaben), ...data } },
  });
  await writeAudit({ userId: session.user.id, action: "assembly.invitation.saved", objectType: "election", objectId: electionId, fields: Object.keys(data) });
  revalidatePath(`/wahl/${electionId}/einladung`);
}
