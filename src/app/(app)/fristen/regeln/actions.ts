"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

/** Markiert eine Fristregel als gegen den amtlichen Gesetzestext geprüft – oder nimmt das zurück. */
export async function toggleRuleVerified(formData: FormData): Promise<void> {
  const session = await requirePermission("rules.verify");
  const key = z.string().min(1).max(64).parse(formData.get("key"));
  const rule = await prisma.deadlineRule.findUniqueOrThrow({ where: { key } });
  const verify = !rule.verified;
  await prisma.deadlineRule.update({
    where: { key },
    data: verify
      ? { verified: true, verifiedBy: session.user.id, verifiedAt: new Date() }
      : { verified: false, verifiedBy: null, verifiedAt: null },
  });
  await writeAudit({
    userId: session.user.id,
    action: verify ? "rule.verified" : "rule.unverified",
    objectType: "deadline_rule",
    objectId: key,
  });
  revalidatePath("/fristen/regeln");
}
