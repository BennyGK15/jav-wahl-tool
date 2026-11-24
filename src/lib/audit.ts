import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { pseudonymize } from "./crypto";

export interface AuditEvent {
  userId: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  /** Nur Feldnamen, niemals Werte. */
  fields?: string[];
}

export async function writeAudit(event: AuditEvent): Promise<void> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  await prisma.auditLog.create({
    data: {
      userId: event.userId,
      action: event.action,
      objectType: event.objectType,
      objectId: event.objectId ?? null,
      ...(event.fields ? { fields: event.fields } : {}),
      ipHash: ip ? pseudonymize(ip) : null,
    },
  });
}
