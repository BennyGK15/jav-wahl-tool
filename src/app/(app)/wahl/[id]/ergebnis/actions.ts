"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requirePermission } from "@/lib/session";
import { recalculateDeadlines } from "@/server/elections";
import { gewaehlteUndErsatz, loadErgebnis, VERSAMMLUNG_KENNWORT } from "@/server/ergebnis";

const uuid = z.string().uuid();
const zahl = z.coerce.number().int().min(0).max(100_000);

export type FormState = { error?: string; ok?: boolean; message?: string };

function refresh(electionId: string) {
  for (const p of ["", "/ergebnis", "/ergebnis/bekanntmachung", "/ergebnis/niederschrift", "/ergebnis/benachrichtigung"]) {
    revalidatePath(`/wahl/${electionId}${p}`);
  }
}

async function guard<T>(permission: Parameters<typeof requirePermission>[0], fn: (userId: string) => Promise<T>): Promise<T | FormState> {
  try {
    const session = await requirePermission(permission);
    return await fn(session.user.id);
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Keine Berechtigung." };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Eingabe ungültig" };
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
}

async function assertOffen(electionId: string) {
  const r = await prisma.result.findUnique({ where: { electionId }, select: { festgestelltAm: true } });
  if (r?.festgestelltAm) throw new Error("Das Ergebnis ist bereits festgestellt. Zum Ändern zuerst die Feststellung aufheben.");
}

/** Auszählung speichern (Entwurf): Stimmzettel, Listen- bzw. Bewerberstimmen, Vorkommnisse. */
export async function saveAuszaehlungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guard("voters.edit", async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    await assertOffen(electionId);
    const gesamt = zahl.parse(formData.get("stimmzettelGesamt"));
    const ungueltig = zahl.parse(formData.get("stimmzettelUngueltig"));
    if (ungueltig > gesamt) throw new Error("Mehr ungültige Stimmzettel als insgesamt.");
    const vorkommnisse = z.string().trim().max(8000).parse(formData.get("vorkommnisse") ?? "");
    const stimmenUngueltigRoh = String(formData.get("stimmenUngueltig") ?? "").trim();
    const stimmenUngueltig = stimmenUngueltigRoh === "" ? null : zahl.parse(stimmenUngueltigRoh);

    // In BW werden Personen gewählt – erfasst werden immer die Stimmen je Bewerber (§ 33 LPVGWO)
    const bewerber: { id: string; stimmen: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string" || value === "") continue;
      if (key.startsWith("bewerber_")) bewerber.push({ id: uuid.parse(key.slice(9)), stimmen: zahl.parse(value) });
    }

    // Nur Bewerber dieser Wahl
    const candidateIds = new Set(
      (await prisma.nominationCandidate.findMany({ where: { nomination: { electionId } }, select: { id: true } })).map((c) => c.id),
    );
    if (bewerber.some((b) => !candidateIds.has(b.id))) throw new Error("Ungültige Zuordnung.");

    await prisma.$transaction([
      prisma.result.upsert({
        where: { electionId },
        create: { electionId, stimmzettelGesamt: gesamt, stimmzettelUngueltig: ungueltig, stimmzettelGueltig: gesamt - ungueltig, stimmenUngueltig, vorkommnisse: vorkommnisse || null },
        update: { stimmzettelGesamt: gesamt, stimmzettelUngueltig: ungueltig, stimmzettelGueltig: gesamt - ungueltig, stimmenUngueltig, vorkommnisse: vorkommnisse || null },
      }),
      ...bewerber.map((b) =>
        prisma.resultEntry.upsert({
          where: { electionId_candidateId: { electionId, candidateId: b.id } },
          create: { electionId, candidateId: b.id, stimmen: b.stimmen, ergebnis: "nicht_gewaehlt" },
          update: { stimmen: b.stimmen },
        }),
      ),
    ]);
    await writeAudit({ userId, action: "result.saved", objectType: "election", objectId: electionId, fields: ["stimmzettel", "stimmen", "vorkommnisse"] });
    refresh(electionId);
    return { ok: true, message: "Auszählung gespeichert." };
  });
}

/** Ergebnis eines Losentscheids festhalten: Gewinner vor die übrigen Beteiligten setzen. */
export async function saveLosAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guard("voters.edit", async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    await assertOffen(electionId);
    const beteiligte = z.array(uuid).min(2).parse(formData.getAll("beteiligt"));
    const gewinner = z.array(uuid).min(1).parse(formData.getAll("gewinner"));
    const plaetze = z.coerce.number().int().min(1).parse(formData.get("plaetze"));
    if (gewinner.length !== plaetze) throw new Error(`Bitte genau ${plaetze} ${plaetze === 1 ? "Gewinner" : "Gewinner"} auswählen.`);
    if (gewinner.some((g) => !beteiligte.includes(g))) throw new Error("Ungültige Auswahl.");

    const result = await prisma.result.findUniqueOrThrow({ where: { electionId } });
    const bisher = z.array(z.string()).catch([]).parse(result.losReihenfolge ?? []).filter((x) => !beteiligte.includes(x));
    const verlierer = beteiligte.filter((b) => !gewinner.includes(b));
    await prisma.result.update({ where: { electionId }, data: { losReihenfolge: [...bisher, ...gewinner, ...verlierer] } });
    await writeAudit({ userId, action: "result.lot", objectType: "election", objectId: electionId, fields: ["losReihenfolge"] });
    refresh(electionId);
    return { ok: true, message: "Losentscheid festgehalten." };
  });
}

/** Ergebnis feststellen: Gewählte und Ersatzmitglieder speichern, Eingaben sperren. */
export async function feststellenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guard("result.finalize", async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    await assertOffen(electionId);
    const d = await loadErgebnis(electionId);
    if (!d.bereit) throw new Error("Das Ergebnis kann noch nicht festgestellt werden (Fehler, offener Losentscheid oder fehlende Auszählung).");
    const { gewaehlt, ersatz } = gewaehlteUndErsatz(d);
    const rang = new Map<string, { ergebnis: "gewaehlt" | "ersatz"; rang: number }>();
    gewaehlt.forEach((id, i) => rang.set(id, { ergebnis: "gewaehlt", rang: i + 1 }));
    ersatz.forEach((id, i) => rang.set(id, { ergebnis: "ersatz", rang: i + 1 }));

    await prisma.$transaction([
      ...[...d.bewerber.keys()].map((candidateId) => {
        const r = rang.get(candidateId);
        const data = { ergebnis: r?.ergebnis ?? ("nicht_gewaehlt" as const), rang: r?.rang ?? null };
        return prisma.resultEntry.upsert({
          where: { electionId_candidateId: { electionId, candidateId } },
          create: { electionId, candidateId, stimmen: d.stimmenJeBewerber.get(candidateId) ?? 0, ...data },
          update: data,
        });
      }),
      prisma.result.update({ where: { electionId }, data: { festgestelltAm: new Date(), festgestelltVon: userId } }),
      prisma.election.update({ where: { id: electionId }, data: { status: "wahl" } }),
    ]);
    await recalculateDeadlines(electionId);
    await writeAudit({ userId, action: "result.finalized", objectType: "election", objectId: electionId });
    refresh(electionId);
    return { ok: true, message: "Ergebnis festgestellt." };
  });
}

export async function aufhebenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guard("result.finalize", async (userId) => {
    const electionId = uuid.parse(formData.get("electionId"));
    await prisma.$transaction([
      prisma.result.update({ where: { electionId }, data: { festgestelltAm: null, festgestelltVon: null } }),
      prisma.resultEntry.updateMany({ where: { electionId }, data: { ergebnis: "nicht_gewaehlt", rang: null } }),
      prisma.election.update({ where: { id: electionId }, data: { status: "eingeleitet" } }),
    ]);
    await recalculateDeadlines(electionId);
    await writeAudit({ userId, action: "result.reopened", objectType: "election", objectId: electionId });
    refresh(electionId);
    return { ok: true, message: "Feststellung aufgehoben." };
  });
}

/** Wahlversammlung: Bewerber aus der Versammlung aufnehmen bzw. entfernen. */
export async function addVersammlungsBewerberAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const electionId = uuid.parse(formData.get("electionId"));
  const voterId = uuid.parse(formData.get("voterId"));
  await assertOffen(electionId);
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId } });
  if (election.verfahren !== "wahlversammlung") throw new Error("Nur bei der Wahlversammlung");
  const voter = await prisma.voter.findUniqueOrThrow({ where: { id: voterId } });
  if (voter.electionId !== electionId || !voter.waehlbar) throw new Error("Person ist nicht wählbar");

  let nomination = await prisma.nomination.findFirst({ where: { electionId, kennwort: VERSAMMLUNG_KENNWORT } });
  nomination ??= await prisma.nomination.create({
    data: { electionId, kennwort: VERSAMMLUNG_KENNWORT, einreicherArt: "beschaeftigte", eingangAm: new Date(), status: "gueltig" },
  });
  if (!(await prisma.nominationCandidate.findFirst({ where: { nominationId: nomination.id, voterId } }))) {
    const max = await prisma.nominationCandidate.aggregate({ where: { nominationId: nomination.id }, _max: { listenplatz: true } });
    await prisma.nominationCandidate.create({
      data: { nominationId: nomination.id, voterId, listenplatz: (max._max.listenplatz ?? 0) + 1, zustimmungLiegtVor: true },
    });
  }
  await writeAudit({ userId: session.user.id, action: "assembly.candidate.added", objectType: "election", objectId: electionId });
  refresh(electionId);
}

export async function removeVersammlungsBewerberAction(formData: FormData): Promise<void> {
  const session = await requirePermission("voters.edit");
  const candidateId = uuid.parse(formData.get("candidateId"));
  const c = await prisma.nominationCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { nomination: true } });
  if (c.nomination.kennwort !== VERSAMMLUNG_KENNWORT) throw new Error("Nur Bewerber aus der Wahlversammlung");
  await assertOffen(c.nomination.electionId);
  await prisma.nominationCandidate.delete({ where: { id: candidateId } });
  await writeAudit({ userId: session.user.id, action: "assembly.candidate.removed", objectType: "election", objectId: c.nomination.electionId });
  refresh(c.nomination.electionId);
}
