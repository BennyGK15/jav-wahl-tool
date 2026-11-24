"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CreateElectionState } from "@/app/(app)/wahl/neu/actions";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { recalculateDeadlines } from "@/server/elections";
import { VERSAMMLUNG_KENNWORT } from "@/server/ergebnis";
import { recomputeEligibility } from "@/server/voters";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt oder ist ungültig");
const schema = z.object({
  electionId: z.uuid(),
  dienststelle: z
    .string()
    .trim()
    .min(2, "Bitte die Dienststelle angeben")
    .max(255),
  wahlberechtigte: z.coerce.number().int().min(0).max(100_000),
  verfahren: z.enum(["regulaer", "wahlversammlung"]),
  wahltag: isoDate,
  amtszeitEnde: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    isoDate.optional(),
  ),
});

export async function updateElectionAction(
  _prev: CreateElectionState,
  formData: FormData,
): Promise<CreateElectionState> {
  let session;
  try {
    session = await requirePermission("election.manage");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { error: "Nur der Vorsitz kann die Wahl bearbeiten." };
    throw e;
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig" };
  const d = parsed.data;

  const election = await prisma.election.findUnique({
    where: { id: d.electionId },
    include: { result: true },
  });
  if (!election) return { error: "Wahl nicht gefunden." };
  if (election.status === "abgeschlossen" || election.result?.festgestelltAm) {
    return {
      error:
        "Nach Feststellung des Ergebnisses kann die Wahl nicht mehr geändert werden.",
    };
  }

  const auskunft = verfahrensauskunft(d.wahlberechtigte);
  if (!auskunft.javMoeglich)
    return {
      error:
        "Mit weniger als 5 Wahlberechtigten wird keine JAV gebildet (§ 59 LPVG BW).",
    };
  if (d.verfahren === "wahlversammlung" && !auskunft.wahlversammlungMoeglich) {
    return {
      error:
        "Eine Wahlversammlung ist nur bei höchstens 20 Wahlberechtigten möglich (§ 62 Abs. 2 LPVG BW).",
    };
  }
  if (d.verfahren !== election.verfahren) {
    const [vorschlaege, freigaben] = await Promise.all([
      prisma.nomination.count({
        where: {
          electionId: election.id,
          NOT: { kennwort: VERSAMMLUNG_KENNWORT },
        },
      }),
      prisma.document.count({
        where: { electionId: election.id, typ: "wahlausschreiben" },
      }),
    ]);
    if (vorschlaege > 0 || freigaben > 0) {
      return {
        error:
          "Das Verfahren kann nicht mehr gewechselt werden: Es gibt bereits Wahlvorschläge oder ein freigegebenes Wahlausschreiben.",
      };
    }
  }

  const wahltagGeaendert = fromDbDate(election.wahltag) !== d.wahltag;
  await prisma.election.update({
    where: { id: election.id },
    data: {
      dienststelle: d.dienststelle,
      verfahren: d.verfahren,
      wahltag: toDbDate(d.wahltag),
      amtszeitEnde: d.amtszeitEnde ? toDbDate(d.amtszeitEnde) : null,
      wahlberechtigteSchaetzung: d.wahlberechtigte,
      // Ein festgelegtes Erlassdatum könnte zum neuen Wahltag zu spät sein – dann neu festlegen
      ...(wahltagGeaendert ? { wahlausschreibenAm: null } : {}),
    },
  });

  try {
    await recalculateDeadlines(election.id);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Wahlkalender konnte nicht berechnet werden",
    };
  }
  // Alter und Ausbildung werden zum Wahltag geprüft
  const neuGeprueft = wahltagGeaendert
    ? await recomputeEligibility(election.id)
    : 0;

  await writeAudit({
    userId: session.user.id,
    action: "election.updated",
    objectType: "election",
    objectId: election.id,
    fields: [
      "dienststelle",
      "verfahren",
      "wahltag",
      "amtszeitEnde",
      "wahlberechtigteSchaetzung",
      ...(neuGeprueft ? [`neu_geprueft:${neuGeprueft}`] : []),
    ],
  });
  redirect(`/wahl/${election.id}?gespeichert=1`);
}
