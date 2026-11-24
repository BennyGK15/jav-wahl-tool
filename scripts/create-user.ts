/**
 * Legt ein Benutzerkonto an (es gibt keine Selbstregistrierung).
 *
 *   pnpm user:create <benutzername> <rolle> "<Anzeigename>"
 *   Rollen: admin | vorsitz | mitglied | wahlhelfer
 *
 * Es wird ein zufälliges Startpasswort ausgegeben. Beim ersten Login muss es geändert werden.
 */
import { randomBytes } from "node:crypto";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file); // bereits gesetzte Variablen werden nicht überschrieben
  } catch {
    // Datei optional
  }
}

const [, , rawUsername, rawRole = "mitglied", displayName] = process.argv;

async function main() {
  const { ROLES } = await import("../src/lib/rbac");
  const { auth } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/prisma");

  if (!rawUsername || !/^[a-zA-Z0-9._-]{3,64}$/.test(rawUsername)) {
    throw new Error("Benutzername fehlt oder ungültig (3–64 Zeichen: a–z, 0–9, . _ -)");
  }
  if (!(ROLES as readonly string[]).includes(rawRole)) {
    throw new Error(`Unbekannte Rolle „${rawRole}". Erlaubt: ${ROLES.join(", ")}`);
  }

  const username = rawUsername.toLowerCase();
  const password = randomBytes(18).toString("base64url"); // 24 Zeichen

  const created = await auth.api.createUser({
    body: {
      email: `${username}@users.invalid`,
      password,
      name: displayName ?? rawUsername,
      data: { username, displayUsername: rawUsername },
    },
  });

  await prisma.user.update({
    where: { id: created.user.id },
    data: { role: rawRole, username, displayUsername: rawUsername, mustChangePassword: true },
  });

  console.log(`Konto „${username}" (${rawRole}) angelegt.`);
  console.log(`Startpasswort (nur einmal angezeigt, sicher übergeben): ${password}`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
