import "server-only";
import {
  aufgabenStandSchema,
  einreichungSchema,
  einreichungStatus,
  parseDatenschutzAngaben,
  type AufgabenStand,
  type DatenschutzAngaben,
  type Einreichung,
  type EinreichungStatus,
} from "@/lib/datenschutz";
import { prisma } from "@/lib/prisma";

const DATENSCHUTZ = "datenschutz";
const AUFGABEN = "datenschutz-aufgaben";
const EINREICHUNG = "datenschutz-einreichung";

export async function loadAufgabenStand(): Promise<AufgabenStand> {
  const e = await prisma.einstellung.findUnique({
    where: { schluessel: AUFGABEN },
  });
  const r = aufgabenStandSchema.safeParse(e?.wert ?? {});
  return r.success ? r.data : {};
}

/** Aufgabe abhaken bzw. wieder öffnen. */
export async function toggleAufgabe(
  key: string,
  userId: string,
): Promise<boolean> {
  const stand = await loadAufgabenStand();
  const erledigt = !stand[key];
  if (erledigt)
    stand[key] = { erledigtAm: new Date().toISOString(), von: userId };
  else delete stand[key];
  await prisma.einstellung.upsert({
    where: { schluessel: AUFGABEN },
    create: { schluessel: AUFGABEN, wert: stand, geaendertVon: userId },
    update: { wert: stand, geaendertVon: userId },
  });
  return erledigt;
}

export async function loadDatenschutzAngaben(): Promise<{
  angaben: DatenschutzAngaben;
  geaendertAm: Date | null;
}> {
  const e = await prisma.einstellung.findUnique({
    where: { schluessel: DATENSCHUTZ },
  });
  return {
    angaben: parseDatenschutzAngaben(e?.wert),
    geaendertAm: e?.geaendertAm ?? null,
  };
}

export async function saveDatenschutzAngaben(
  angaben: DatenschutzAngaben,
  userId: string,
): Promise<void> {
  await prisma.einstellung.upsert({
    where: { schluessel: DATENSCHUTZ },
    create: { schluessel: DATENSCHUTZ, wert: angaben, geaendertVon: userId },
    update: { wert: angaben, geaendertVon: userId },
  });
}

export async function loadEinreichung(): Promise<Einreichung | null> {
  const e = await prisma.einstellung.findUnique({
    where: { schluessel: EINREICHUNG },
  });
  if (!e) return null;
  const r = einreichungSchema.safeParse(e.wert);
  return r.success ? r.data : null;
}

/** Unterlagen als eingereicht vermerken (ersetzt eine frühere Einreichung). */
export async function saveEinreichung(
  anmerkung: string | undefined,
  userId: string,
): Promise<void> {
  const wert: Einreichung = {
    eingereichtAm: new Date().toISOString(),
    von: userId,
    ...(anmerkung ? { anmerkung } : {}),
  };
  await prisma.einstellung.upsert({
    where: { schluessel: EINREICHUNG },
    create: { schluessel: EINREICHUNG, wert, geaendertVon: userId },
    update: { wert, geaendertVon: userId },
  });
}

export async function deleteEinreichung(): Promise<void> {
  await prisma.einstellung.deleteMany({ where: { schluessel: EINREICHUNG } });
}

/** Stand der Einreichung samt Anzeigename der einreichenden Person. */
export async function loadEinreichungStatus(
  angabenGeaendertAm: Date | null,
): Promise<EinreichungStatus & { name?: string }> {
  const status = einreichungStatus(await loadEinreichung(), angabenGeaendertAm);
  if (status.art === "offen" || !status.von) return status;
  const u = await prisma.user.findUnique({
    where: { id: status.von },
    select: { name: true, displayUsername: true, username: true },
  });
  return {
    ...status,
    name: u
      ? u.name || u.displayUsername || u.username || undefined
      : undefined,
  };
}
