import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { hasPermission, type Permission } from "./rbac";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Für Seiten: leitet ohne gültige Sitzung zum Login um. */
export async function requireSession({
  allowPasswordChangePending = false,
} = {}) {
  const s = await getSession();
  if (!s || s.user.banned) redirect("/login");
  if (s.user.mustChangePassword && !allowPasswordChangePending)
    redirect("/passwort");
  return s;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Keine Berechtigung");
  }
}

/** Für Server Actions: wirft, statt umzuleiten. Immer als ERSTE Zeile jeder Action aufrufen. */
export async function requirePermission(permission: Permission) {
  const s = await getSession();
  if (!s || s.user.banned || s.user.mustChangePassword)
    throw new ForbiddenError();
  if (!hasPermission(s.user.role, permission)) throw new ForbiddenError();
  return s;
}
