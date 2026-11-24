import "server-only";
import { toBerlinLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hatFehler, pruefeWahlvorschlag } from "@/lib/vorschlaege";
import { getDeadlineEnd } from "./elections";
import { loadGeschlechter } from "./geschlechter";

const voterSelect = {
  id: true,
  lfdNr: true,
  nachname: true,
  vorname: true,
  waehlbar: true,
  wahlberechtigt: true,
  geschlecht: true,
  funktion: true,
} as const;

export const STATUS_LABEL = {
  eingegangen: "eingegangen",
  gueltig: "gültig",
  ungueltig: "ungültig",
  zurueckgegeben: "zurückgegeben",
} as const;

/** Alle Wahlvorschläge einer Wahl inkl. Prüfprotokoll (Querverweise über alle Vorschläge). */
export async function loadNominations(electionId: string) {
  const [election, fristende, nominations, geschlechter] = await Promise.all([
    prisma.election.findUniqueOrThrow({ where: { id: electionId } }),
    // Mit bekannt gemachter Nachfrist gilt deren Ende (§ 16 LPVGWO)
    getDeadlineEnd(electionId, "nachfrist_ende").then(
      async (n) => n ?? getDeadlineEnd(electionId, "wahlvorschlaege_ende"),
    ),
    prisma.nomination.findMany({
      where: { electionId },
      orderBy: { eingangAm: "asc" },
      include: {
        candidates: {
          orderBy: { listenplatz: "asc" },
          include: { voter: { select: voterSelect } },
        },
        supporters: { include: { voter: { select: voterSelect } } },
      },
    }),
    loadGeschlechter(electionId),
  ]);
  const geschlechterSitze = !geschlechter.relevant
    ? undefined
    : geschlechter.verteilung && !geschlechter.verteilung.losOffen
      ? {
          sitzeFrauen: geschlechter.verteilung.sitzeFrauen,
          sitzeMaenner: geschlechter.verteilung.sitzeMaenner,
        }
      : null;

  // Wer steht auf / unterschreibt wie viele Vorschläge? (ungültige Vorschläge zählen nicht mit)
  const zaehlbar = nominations.filter(
    (n) => n.status !== "ungueltig" && n.status !== "zurueckgegeben",
  );
  const bewerbungen = new Map<string, number>();
  const unterschriften = new Map<string, number>();
  for (const n of zaehlbar) {
    for (const c of n.candidates)
      bewerbungen.set(c.voterId, (bewerbungen.get(c.voterId) ?? 0) + 1);
    for (const s of n.supporters)
      unterschriften.set(s.voterId, (unterschriften.get(s.voterId) ?? 0) + 1);
  }
  const andere = (
    map: Map<string, number>,
    voterId: string,
    n: { status: string },
  ) =>
    Math.max(
      0,
      (map.get(voterId) ?? 0) -
        (n.status === "ungueltig" || n.status === "zurueckgegeben" ? 0 : 1),
    );

  return {
    election,
    fristende,
    geschlechter,
    nominations: nominations.map((n) => {
      const checks = pruefeWahlvorschlag({
        einreicherArt: n.einreicherArt,
        gewerkschaft: n.gewerkschaft,
        eingang: toBerlinLocal(n.eingangAm),
        fristende,
        mindestUnterschriften: election.stuetzunterschriftenMin,
        geschlechterSitze,
        geschlechterBegruendung: n.geschlechterBegruendung,
        bewerber: n.candidates.map((c) => ({
          name: `${c.voter.vorname} ${c.voter.nachname}`,
          waehlbar: c.voter.waehlbar,
          zustimmung: c.zustimmungLiegtVor,
          geschlecht: c.voter.geschlecht,
          aufAnderenVorschlaegen: andere(bewerbungen, c.voterId, n),
        })),
        unterstuetzer: n.supporters.map((s) => ({
          name: `${s.voter.vorname} ${s.voter.nachname}`,
          wahlberechtigt: s.voter.wahlberechtigt,
          aufAnderenVorschlaegen: andere(unterschriften, s.voterId, n),
        })),
      });
      return { ...n, checks, hatFehler: hatFehler(checks) };
    }),
  };
}

/** Änderungen an Bewerbern/Unterstützern nur, solange der Vorschlag nicht entschieden ist. */
export async function assertNominationEditable(nominationId: string) {
  const n = await prisma.nomination.findUniqueOrThrow({
    where: { id: nominationId },
  });
  if (n.status !== "eingegangen") {
    throw new Error(
      "Über diesen Wahlvorschlag wurde bereits entschieden. Status erst auf „eingegangen“ zurücksetzen.",
    );
  }
  return n;
}

/** Listenplätze lückenlos 1, 2, 3 … vergeben (zweistufig wegen eindeutigem Index). */
export async function renumberCandidates(
  nominationId: string,
  orderedIds?: string[],
) {
  const ids =
    orderedIds ??
    (
      await prisma.nominationCandidate.findMany({
        where: { nominationId },
        orderBy: { listenplatz: "asc" },
        select: { id: true },
      })
    ).map((c) => c.id);
  await prisma.$transaction([
    ...ids.map((id, i) =>
      prisma.nominationCandidate.update({
        where: { id },
        data: { listenplatz: -(i + 1) },
      }),
    ),
    ...ids.map((id, i) =>
      prisma.nominationCandidate.update({
        where: { id },
        data: { listenplatz: i + 1 },
      }),
    ),
  ]);
}
