"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { BESTAETIGUNG, DEV_RESET_ERLAUBT, devReset } from "@/lib/dev-reset";
import { ForbiddenError, requirePermission } from "@/lib/session";

export type ResetState = { error?: string };

export async function devResetAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  if (!DEV_RESET_ERLAUBT)
    return { error: "Der Neustart ist in Produktion nicht verfügbar." };
  let session;
  try {
    session = await requirePermission("users.manage");
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { error: "Nur die Administration kann die Umgebung neu starten." };
    throw e;
  }
  if (String(formData.get("bestaetigung") ?? "").trim() !== BESTAETIGUNG)
    return { error: `Bitte zur Bestätigung „${BESTAETIGUNG}“ eingeben.` };
  const r = await devReset({
    datenschutz: formData.get("datenschutz") === "on",
  });
  // Erster Eintrag im neuen Audit-Log
  await writeAudit({
    userId: session.user.id,
    action: "dev.reset",
    objectType: "system",
    fields: [`wahlen:${r.wahlen}`, `personen:${r.personen}`],
  });
  revalidatePath("/", "layout");
  redirect("/");
}
