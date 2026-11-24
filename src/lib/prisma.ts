import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/** Baut den MariaDB/MySQL-Treiberadapter aus DATABASE_URL (eine Variable statt fünf). */
function createAdapter(): PrismaMariaDb {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    // Kein Abbruch beim Import (z. B. während `next build`); Abfragen schlagen dann fehl.
    console.warn("[db] DATABASE_URL ist nicht gesetzt");
  }
  const url = new URL(raw || "mysql://localhost:3306/jav_wahl");
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 10,
    ...(process.env.DB_SSL === "true"
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
}

const globalForPrisma = globalThis as unknown as { jav_prisma?: PrismaClient };

export const prisma =
  globalForPrisma.jav_prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.jav_prisma = prisma;
