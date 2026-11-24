"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { toDbDate } from "@/lib/dates";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { getActiveElection, recalculateDeadlines } from "@/server/elections";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt oder ist ungültig");
const optionalIsoDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), isoDate.optional());

const schema = z.object({
  dienststelle: z.string().trim().min(2, "Bitte die Dienststelle angeben").max(255),
  wahlberechtigte: z.coerce.number().int("Ganze Zahl angeben").min(0).max(100_000),
  verfahren: z.enum(["regulaer", "wahlversammlung"]),
  wahltag: isoDate,
  amtszeitEnde: optionalIsoDate,
});

export type CreateElectionState = { error?: string };

export async function createElectionAction(
  _prev: CreateElectionState,
  formData: FormData,
): Promise<CreateElectionState> {
  let session;
  try {
    session = await requirePermission("election.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Nur der Vorsitz des Wahlvorstands kann eine Wahl anlegen." };
    throw e;
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig" };
  const data = parsed.data;

  const auskunft = verfahrensauskunft(data.wahlberechtigte);
  if (!auskunft.javMoeglich) {
    return { error: "Mit weniger als 5 Wahlberechtigten wird keine JAV gebildet (§ 59 LPVG BW)." };
  }
  if (data.verfahren === "wahlversammlung" && !auskunft.wahlversammlungMoeglich) {
    return { error: "Eine Wahlversammlung ist nur bei höchstens 20 Wahlberechtigten möglich (§ 62 Abs. 2 LPVG BW)." };
  }
  if (await getActiveElection()) {
    return { error: "Es gibt bereits eine laufende Wahl. Bitte diese zuerst abschließen." };
  }

  const election = await prisma.election.create({
    data: {
      dienststelle: data.dienststelle,
      verfahren: data.verfahren,
      wahltag: toDbDate(data.wahltag),
      amtszeitEnde: data.amtszeitEnde ? toDbDate(data.amtszeitEnde) : null,
      wahlberechtigteSchaetzung: data.wahlberechtigte,
      createdBy: session.user.id,
      einrichtungOffen: true,
    },
  });

  try {
    await recalculateDeadlines(election.id);
  } catch (e) {
    await prisma.election.delete({ where: { id: election.id } });
    return { error: e instanceof Error ? e.message : "Wahlkalender konnte nicht berechnet werden" };
  }

  await writeAudit({
    userId: session.user.id,
    action: "election.created",
    objectType: "election",
    objectId: election.id,
    fields: ["dienststelle", "verfahren", "wahltag", "amtszeitEnde", "wahlberechtigteSchaetzung"],
  });

  redirect(`/wahl/${election.id}/einrichtung`);
}
