"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { DATENSCHUTZ_FELDER, datenschutzAngabenSchema } from "@/lib/datenschutz";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { saveDatenschutzAngaben, toggleAufgabe } from "@/server/einstellungen";
import { z } from "zod";
import { DATENSCHUTZ_AUFGABEN } from "@/lib/datenschutz";

export type DatenschutzState = { error?: string; ok?: boolean };

export async function saveDatenschutzAction(_prev: DatenschutzState, formData: FormData): Promise<DatenschutzState> {
  try {
    const session = await requirePermission("privacy.manage");
    const roh = Object.fromEntries(
      DATENSCHUTZ_FELDER.map((f) => [f.key, String(formData.get(f.key) ?? "").trim()]).filter(([, v]) => v !== ""),
    );
    const r = datenschutzAngabenSchema.safeParse(roh);
    if (!r.success) return { error: r.error.issues[0]?.message ?? "Eingabe ungültig" };
    await saveDatenschutzAngaben(r.data, session.user.id);
    await writeAudit({ userId: session.user.id, action: "privacy.settings", objectType: "einstellung", objectId: "datenschutz", fields: Object.keys(r.data) });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    throw e;
  }
}

/** Von Hand zu erledigende Aufgabe abhaken bzw. wieder öffnen. */
export async function toggleAufgabeAction(formData: FormData): Promise<void> {
  const session = await requirePermission("privacy.manage");
  const key = z
    .enum(DATENSCHUTZ_AUFGABEN.filter((a) => !("automatisch" in a)).map((a) => a.key) as [string, ...string[]])
    .parse(formData.get("aufgabe"));
  const erledigt = await toggleAufgabe(key, session.user.id);
  await writeAudit({ userId: session.user.id, action: erledigt ? "privacy.task.done" : "privacy.task.reopened", objectType: "einstellung", objectId: key });
  revalidatePath("/datenschutz", "layout");
}
