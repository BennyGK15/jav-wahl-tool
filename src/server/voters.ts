import "server-only";
import { decrypt, encrypt, encryptNullable } from "@/lib/crypto";
import { fromDbDate } from "@/lib/dates";
import { eligibility, inAusbildungAm } from "@/lib/jav";
import { prisma } from "@/lib/prisma";

/** Zusätzliche Authentifizierungsdaten: Chiffrat ist an genau diesen Datensatz gebunden. */
const aad = (voterId: string) => `voter:${voterId}`;

export interface VoterInput {
  nachname: string;
  vorname: string;
  organisationseinheit?: string | null;
  funktion?: string | null;
  geburtsdatum: string;
  inAusbildung: boolean;
  ausbildungsende?: string | null;
  geschlecht?: "w" | "m" | "d" | null;
}

function flags(input: VoterInput, wahltag: string) {
  const training = inAusbildungAm(
    input.inAusbildung,
    input.ausbildungsende,
    wahltag,
  );
  const e = eligibility({
    birthDate: input.geburtsdatum,
    inTraining: training,
    electionDay: wahltag,
  });
  return { wahlberechtigt: e.wahlberechtigt, waehlbar: e.waehlbar };
}

function sensitiveColumns(voterId: string, input: VoterInput) {
  return {
    geburtsdatumEnc: encrypt(input.geburtsdatum, aad(voterId)),
    ausbildungsendeEnc: encryptNullable(input.ausbildungsende, aad(voterId)),
  };
}

export async function createVoter(electionId: string, input: VoterInput) {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });
  const id = crypto.randomUUID();
  const max = await prisma.voter.aggregate({
    where: { electionId },
    _max: { lfdNr: true },
  });
  return prisma.voter.create({
    data: {
      id,
      electionId,
      lfdNr: (max._max.lfdNr ?? 0) + 1,
      nachname: input.nachname,
      vorname: input.vorname,
      organisationseinheit: input.organisationseinheit || null,
      funktion: input.funktion || null,
      inAusbildung: input.inAusbildung,
      geschlecht: input.geschlecht ?? null,
      ...sensitiveColumns(id, input),
      ...flags(input, fromDbDate(election.wahltag)),
    },
  });
}

export async function updateVoter(voterId: string, input: VoterInput) {
  const voter = await prisma.voter.findUniqueOrThrow({
    where: { id: voterId },
    include: { election: true },
  });
  return prisma.voter.update({
    where: { id: voterId },
    data: {
      nachname: input.nachname,
      vorname: input.vorname,
      organisationseinheit: input.organisationseinheit || null,
      funktion: input.funktion || null,
      inAusbildung: input.inAusbildung,
      geschlecht: input.geschlecht ?? null,
      ...sensitiveColumns(voterId, input),
      ...flags(input, fromDbDate(voter.election.wahltag)),
    },
  });
}

/** Lädt eine Person inkl. entschlüsselter Felder. Nur für Rollen mit voters.sensitive.read aufrufen. */
export async function getVoterDecrypted(voterId: string) {
  const v = await prisma.voter.findUnique({ where: { id: voterId } });
  if (!v) return null;
  return {
    ...v,
    geburtsdatum: decrypt(v.geburtsdatumEnc, aad(v.id)),
    ausbildungsende: v.ausbildungsendeEnc
      ? decrypt(v.ausbildungsendeEnc, aad(v.id))
      : null,
  };
}

/** Prüft Wahlberechtigung und Wählbarkeit aller Personen neu (z. B. nach Änderung des Wahltags). */
export async function recomputeEligibility(
  electionId: string,
): Promise<number> {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });
  const wahltag = fromDbDate(election.wahltag);
  const voters = await prisma.voter.findMany({ where: { electionId } });
  const updates = voters.map((v) => {
    const input: VoterInput = {
      nachname: v.nachname,
      vorname: v.vorname,
      geburtsdatum: decrypt(v.geburtsdatumEnc, aad(v.id)),
      inAusbildung: v.inAusbildung,
      ausbildungsende: v.ausbildungsendeEnc
        ? decrypt(v.ausbildungsendeEnc, aad(v.id))
        : null,
    };
    return prisma.voter.update({
      where: { id: v.id },
      data: flags(input, wahltag),
    });
  });
  await prisma.$transaction(updates);
  return updates.length;
}

/** Nummeriert alphabetisch (Nachname, Vorname) neu: 1, 2, 3 … */
export async function renumberAlphabetically(
  electionId: string,
): Promise<void> {
  const voters = await prisma.voter.findMany({
    where: { electionId },
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  // Zwei Schritte wegen des eindeutigen Index (electionId, lfdNr): erst negativ, dann final.
  await prisma.$transaction([
    ...voters.map((v, i) =>
      prisma.voter.update({ where: { id: v.id }, data: { lfdNr: -(i + 1) } }),
    ),
    ...voters.map((v, i) =>
      prisma.voter.update({ where: { id: v.id }, data: { lfdNr: i + 1 } }),
    ),
  ]);
}

export async function voterCounts(electionId: string) {
  const [gesamt, wahlberechtigt, nurWaehlbar] = await Promise.all([
    prisma.voter.count({ where: { electionId } }),
    prisma.voter.count({ where: { electionId, wahlberechtigt: true } }),
    prisma.voter.count({
      where: { electionId, wahlberechtigt: false, waehlbar: true },
    }),
  ]);
  return { gesamt, wahlberechtigt, nurWaehlbar };
}

/**
 * Importiert mehrere Personen auf einmal. Dubletten (gleicher Name + Geburtsdatum, auch gegenüber
 * bereits erfassten Personen) werden übersprungen.
 */
export async function importVoters(
  electionId: string,
  rows: VoterInput[],
): Promise<{ importiert: number; dubletten: number }> {
  const { dublettenSchluessel } = await import("@/lib/csv-import");
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
  });
  const wahltag = fromDbDate(election.wahltag);
  const vorhanden = await prisma.voter.findMany({
    where: { electionId },
    select: {
      id: true,
      nachname: true,
      vorname: true,
      geburtsdatumEnc: true,
      lfdNr: true,
    },
  });
  const schluessel = new Set(
    vorhanden.map((v) =>
      dublettenSchluessel({
        nachname: v.nachname,
        vorname: v.vorname,
        geburtsdatum: decrypt(v.geburtsdatumEnc, aad(v.id)),
      }),
    ),
  );
  let lfdNr = vorhanden.reduce((m, v) => Math.max(m, v.lfdNr), 0);
  let dubletten = 0;
  const data = [];
  for (const input of rows) {
    const key = dublettenSchluessel(input);
    if (schluessel.has(key)) {
      dubletten++;
      continue;
    }
    schluessel.add(key);
    const id = crypto.randomUUID();
    data.push({
      id,
      electionId,
      lfdNr: ++lfdNr,
      nachname: input.nachname,
      vorname: input.vorname,
      organisationseinheit: input.organisationseinheit || null,
      funktion: input.funktion || null,
      inAusbildung: input.inAusbildung,
      geschlecht: input.geschlecht ?? null,
      ...sensitiveColumns(id, input),
      ...flags(input, wahltag),
    });
  }
  if (data.length) await prisma.voter.createMany({ data });
  return { importiert: data.length, dubletten };
}
