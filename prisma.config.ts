import { defineConfig } from "prisma/config";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file); // bereits gesetzte Variablen werden nicht überschrieben
  } catch {
    // Datei optional
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` braucht keine Verbindung; leer ist beim Docker-Build daher in Ordnung.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
