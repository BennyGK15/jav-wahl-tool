import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { admin, twoFactor, username } from "better-auth/plugins";
import { bereinigeAbgelaufenes } from "./bereinigung";
import { prisma } from "./prisma";

const isProd = process.env.NODE_ENV === "production";

/** Kontosperre: nach so vielen Fehlversuchen innerhalb des Zeitfensters wird das Konto vorübergehend gesperrt. */
export const LOCKOUT = { maxVersuche: 5, fensterMinuten: 15, sperrMinuten: 15 } as const;
const SPERRGRUND = "Automatisch gesperrt nach wiederholten Fehlversuchen";

/** Zählt fehlgeschlagene Anmeldungen je Benutzername und sperrt bei Überschreitung (über das admin-Plugin). */
async function protokolliereAnmeldung(username: string, erfolgreich: boolean) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return; // unbekannte Namen werden nur durch das Rate-Limit gebremst
  if (erfolgreich) {
    if (user.failedLoginCount > 0) await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, failedLoginAt: null } });
    return;
  }
  const fensterBeginn = Date.now() - LOCKOUT.fensterMinuten * 60_000;
  const imFenster = user.failedLoginAt && user.failedLoginAt.getTime() >= fensterBeginn;
  const anzahl = (imFenster ? user.failedLoginCount : 0) + 1;
  const sperren = anzahl >= LOCKOUT.maxVersuche;
  await prisma.user.update({
    where: { id: user.id },
    data: sperren
      ? { failedLoginCount: 0, failedLoginAt: null, banned: true, banReason: SPERRGRUND, banExpires: new Date(Date.now() + LOCKOUT.sperrMinuten * 60_000) }
      : { failedLoginCount: anzahl, failedLoginAt: new Date() },
  });
  if (sperren) await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: sperren ? "auth.locked" : "auth.failed", objectType: "user", objectId: user.id },
  });
}

if (isProd && (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen)");
}

export const auth = betterAuth({
  appName: "JAV-Wahl-Tool",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : [],

  database: prismaAdapter(prisma, { provider: "mysql" }),

  // Anmeldung nur mit Benutzername + Passwort; keine Selbstregistrierung.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },

  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 8, // absolute Dauer: 8 Stunden
    updateAge: 60 * 15, // Verlängerung höchstens alle 15 Minuten
    freshAge: 60 * 10, // sensible Aktionen nur mit frischer Sitzung
    cookieCache: { enabled: false }, // Sperren und Abmelden wirken sofort
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/username": { window: 300, max: 5 },
      "/change-password": { window: 300, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: isProd,
    cookiePrefix: "jav",
    defaultCookieAttributes: { httpOnly: true, sameSite: "strict", secure: isProd },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/username") return;
      const name = (ctx.body as { username?: unknown } | undefined)?.username;
      if (typeof name !== "string" || !name) return;
      const returned = ctx.context.returned;
      const status = isAPIError(returned) ? returned.statusCode : returned instanceof Response ? returned.status : 200;
      try {
        // 401 = falsche Zugangsdaten; 403 (gesperrt) zählt nicht erneut
        if (status === 401) await protokolliereAnmeldung(name.trim().toLowerCase(), false);
        else if (status < 300) await protokolliereAnmeldung(name.trim().toLowerCase(), true);
      } catch (e) {
        console.error("[auth] Protokollierung der Anmeldung fehlgeschlagen", e);
      }
      await bereinigeAbgelaufenes();
    }),
  },

  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 64 }),
    admin({ defaultRole: "mitglied", adminRoles: ["admin"] }),
    twoFactor({ issuer: "JAV-Wahl-Tool" }),
    nextCookies(), // muss das letzte Plugin sein
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
