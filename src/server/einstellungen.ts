import "server-only";
import { aufgabenStandSchema, parseDatenschutzAngaben, type AufgabenStand, type DatenschutzAngaben } from "@/lib/datenschutz";
import { prisma } from "@/lib/prisma";

const DATENSCHUTZ = "datenschutz";
const AUFGABEN = "datenschutz-aufgaben";

export async function loadAufgabenStand(): Promise<AufgabenStand> {
  const e = await prisma.einstellung.findUnique({ where: { schluessel: AUFGABEN } });
  const r = aufgabenStandSchema.safeParse(e?.wert ?? {});
  return r.success ? r.data : {};
}

/** Aufgabe abhaken bzw. wieder öffnen. */
export async function toggleAufgabe(key: string, userId: string): Promise<boolean> {
  const stand = await loadAufgabenStand();
  const erledigt = !stand[key];
  if (erledigt) stand[key] = { erledigtAm: new Date().toISOString(), von: userId };
  else delete stand[key];
  await prisma.einstellung.upsert({
    where: { schluessel: AUFGABEN },
    create: { schluessel: AUFGABEN, wert: stand, geaendertVon: userId },
    update: { wert: stand, geaendertVon: userId },
  });
  return erledigt;
}

export async function loadDatenschutzAngaben(): Promise<{ angaben: DatenschutzAngaben; geaendertAm: Date | null }> {
  const e = await prisma.einstellung.findUnique({ where: { schluessel: DATENSCHUTZ } });
  return { angaben: parseDatenschutzAngaben(e?.wert), geaendertAm: e?.geaendertAm ?? null };
}

export async function saveDatenschutzAngaben(angaben: DatenschutzAngaben, userId: string): Promise<void> {
  await prisma.einstellung.upsert({
    where: { schluessel: DATENSCHUTZ },
    create: { schluessel: DATENSCHUTZ, wert: angaben, geaendertVon: userId },
    update: { wert: angaben, geaendertVon: userId },
  });
}
