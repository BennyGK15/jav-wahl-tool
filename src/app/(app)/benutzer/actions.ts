"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/rbac";
import { ForbiddenError, requirePermission } from "@/lib/session";

export type UserFormState = { error?: string; ok?: boolean; message?: string; password?: string };

const uuidish = z.string().min(1).max(64);
const neuesPasswort = () => randomBytes(18).toString("base64url"); // 24 Zeichen

async function guard(fn: (adminId: string) => Promise<UserFormState>): Promise<UserFormState> {
  try {
    const session = await requirePermission("users.manage");
    return await fn(session.user.id);
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Eingabe ungültig" };
    if (e instanceof Error) return { error: e.message };
    throw e;
  } finally {
    revalidatePath("/benutzer");
  }
}

/** Verhindert, dass sich die Administration selbst aussperrt. */
async function pruefeNichtLetzterAdmin(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== "admin") return;
  const admins = await prisma.user.count({ where: { role: "admin", OR: [{ banned: false }, { banned: null }] } });
  if (admins <= 1) throw new Error("Das letzte aktive Administrationskonto kann nicht geändert oder gesperrt werden.");
}

const createSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,64}$/, "Benutzername: 3–64 Zeichen (Buchstaben, Ziffern, . _ -)"),
  name: z.string().trim().min(2, "Bitte den Namen angeben").max(255),
  role: z.enum(ROLES),
});

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const { username, name, role } = createSchema.parse(Object.fromEntries(formData));
    const lower = username.toLowerCase();
    if (await prisma.user.findUnique({ where: { username: lower } })) throw new Error("Dieser Benutzername ist bereits vergeben.");
    const password = neuesPasswort();
    const created = await auth.api.createUser({
      headers: await headers(),
      body: { email: `${lower}@users.invalid`, password, name, data: { username: lower, displayUsername: username } },
    });
    await prisma.user.update({ where: { id: created.user.id }, data: { role, username: lower, displayUsername: username, mustChangePassword: true } });
    await writeAudit({ userId: adminId, action: "user.created", objectType: "user", objectId: created.user.id, fields: ["role"] });
    return { ok: true, message: `Konto „${lower}“ angelegt.`, password };
  });
}

export async function resetPasswordAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const userId = uuidish.parse(formData.get("userId"));
    if (userId === adminId) throw new Error("Das eigene Passwort bitte unter „Konto“ ändern.");
    const password = neuesPasswort();
    const h = await headers();
    await auth.api.setUserPassword({ headers: h, body: { userId, newPassword: password } });
    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true, failedLoginCount: 0, failedLoginAt: null } });
    await auth.api.revokeUserSessions({ headers: h, body: { userId } });
    await writeAudit({ userId: adminId, action: "user.password.reset", objectType: "user", objectId: userId });
    return { ok: true, message: "Neues Startpasswort vergeben, alle Sitzungen beendet.", password };
  });
}

export async function setRoleAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const userId = uuidish.parse(formData.get("userId"));
    const role = z.enum(ROLES).parse(formData.get("role"));
    if (userId === adminId) throw new Error("Die eigene Rolle kann nicht geändert werden.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === role) return { ok: true, message: "Keine Änderung." };
    if (role !== "admin") await pruefeNichtLetzterAdmin(userId);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    // Rechte ändern sich – bestehende Sitzungen beenden
    await auth.api.revokeUserSessions({ headers: await headers(), body: { userId } });
    await writeAudit({ userId: adminId, action: "user.role.changed", objectType: "user", objectId: userId, fields: [`role:${role}`] });
    return { ok: true, message: "Rolle geändert." };
  });
}

export async function banAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const userId = uuidish.parse(formData.get("userId"));
    if (userId === adminId) throw new Error("Das eigene Konto kann nicht gesperrt werden.");
    await pruefeNichtLetzterAdmin(userId);
    await auth.api.banUser({ headers: await headers(), body: { userId, banReason: "Durch die Administration gesperrt" } });
    await writeAudit({ userId: adminId, action: "user.banned", objectType: "user", objectId: userId });
    return { ok: true, message: "Konto gesperrt, Sitzungen beendet." };
  });
}

export async function unbanAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const userId = uuidish.parse(formData.get("userId"));
    await auth.api.unbanUser({ headers: await headers(), body: { userId } });
    await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, failedLoginAt: null } });
    await writeAudit({ userId: adminId, action: "user.unbanned", objectType: "user", objectId: userId });
    return { ok: true, message: "Konto entsperrt." };
  });
}

export async function revokeSessionsAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  return guard(async (adminId) => {
    const userId = uuidish.parse(formData.get("userId"));
    await auth.api.revokeUserSessions({ headers: await headers(), body: { userId } });
    await writeAudit({ userId: adminId, action: "user.sessions.revoked", objectType: "user", objectId: userId });
    return { ok: true, message: "Alle Sitzungen beendet." };
  });
}
