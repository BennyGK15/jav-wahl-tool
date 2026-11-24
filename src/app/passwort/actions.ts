"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort fehlt"),
    newPassword: z
      .string()
      .min(12, "Mindestens 12 Zeichen")
      .max(128, "Höchstens 128 Zeichen"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwörter stimmen nicht überein",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Das neue Passwort muss sich vom bisherigen unterscheiden",
  });

export type ChangePasswordState = { ok: boolean; message?: string };

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session || session.user.banned) return { ok: false, message: "Nicht angemeldet" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Eingabe ungültig" };
  }

  try {
    await auth.api.changePassword({
      headers: h,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
  } catch {
    return { ok: false, message: "Passwort konnte nicht geändert werden. Ist das aktuelle Passwort korrekt?" };
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { mustChangePassword: false } });
  await writeAudit({ userId: session.user.id, action: "password.changed", objectType: "user", objectId: session.user.id });
  return { ok: true };
}
