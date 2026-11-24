import "server-only";
import { z } from "zod";
import {
  bestimmeWahlverfahren,
  mehrheitswahl,
  verhaeltniswahl,
  pruefeZahlen,
  type MehrheitErgebnis,
  type VerhaeltnisErgebnis,
  type ZahlenPruefung,
} from "@/lib/ergebnis";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { FUNKTION_LABEL, parseAngaben } from "@/lib/wahlausschreiben";

/** Kennwort des automatisch angelegten „Wahlvorschlags“ für Bewerber aus der Wahlversammlung. */
export const VERSAMMLUNG_KENNWORT = "Vorschläge aus der Wahlversammlung";

export interface BewerberInfo {
  candidateId: string;
  nominationId: string;
  listenplatz: number;
  name: string;
  nachname: string;
  vorname: string;
  organisationseinheit: string | null;
  funktion: string | null;
}

export async function loadErgebnis(electionId: string) {
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId }, include: { result: true } });

  const [wahlberechtigte, vermerkt, brief, nominations, entries] = await Promise.all([
    prisma.voter.count({ where: { electionId, wahlberechtigt: true } }),
    prisma.voter.count({ where: { electionId, wahlberechtigt: true, votedAt: { not: null } } }),
    prisma.voter.count({ where: { electionId, wahlberechtigt: true, stimmabgabeArt: "brief" } }),
    prisma.nomination.findMany({
      where: { electionId, status: "gueltig" },
      orderBy: [{ ordnungsnummer: "asc" }, { eingangAm: "asc" }],
      include: {
        candidates: { orderBy: { listenplatz: "asc" }, include: { voter: { select: { nachname: true, vorname: true, organisationseinheit: true, funktion: true } } } },
      },
    }),
    prisma.resultEntry.findMany({ where: { electionId } }),
  ]);

  const sitze = verfahrensauskunft(wahlberechtigte > 0 ? wahlberechtigte : election.wahlberechtigteSchaetzung).mitglieder;
  const wahlverfahren = bestimmeWahlverfahren(election.verfahren, nominations.length, sitze);
  const losReihenfolge = z.array(z.string()).catch([]).parse(election.result?.losReihenfolge ?? []);
  const stimmenJeBewerber = new Map(entries.map((e) => [e.candidateId, e.stimmen ?? 0]));

  const bewerber = new Map<string, BewerberInfo>();
  for (const n of nominations) {
    for (const c of n.candidates) {
      bewerber.set(c.id, {
        candidateId: c.id,
        nominationId: n.id,
        listenplatz: c.listenplatz,
        name: `${c.voter.vorname} ${c.voter.nachname}`,
        nachname: c.voter.nachname,
        vorname: c.voter.vorname,
        organisationseinheit: c.voter.organisationseinheit,
        funktion: c.voter.funktion,
      });
    }
  }

  let verhaeltnis: VerhaeltnisErgebnis | null = null;
  let mehrheit: MehrheitErgebnis | null = null;
  let summeStimmen = 0;
  /** Gesamtstimmen je Wahlvorschlag = Summe der Bewerberstimmen (§ 37 Abs. 1 LPVGWO) */
  const stimmenJeVorschlag = new Map(
    nominations.map((n) => [n.id, n.candidates.reduce((s, c) => s + (stimmenJeBewerber.get(c.id) ?? 0), 0)]),
  );
  if (wahlverfahren === "verhaeltnis") {
    const vorschlaege = nominations.map((n) => ({
      id: n.id,
      bewerber: n.candidates.map((c) => ({ id: c.id, stimmen: stimmenJeBewerber.get(c.id) ?? 0 })),
    }));
    summeStimmen = [...stimmenJeVorschlag.values()].reduce((s, x) => s + x, 0);
    verhaeltnis = verhaeltniswahl(vorschlaege, sitze, losReihenfolge);
  } else if (wahlverfahren === "mehrheit") {
    const kandidaten = [...bewerber.keys()].map((id) => ({ id, stimmen: stimmenJeBewerber.get(id) ?? 0 }));
    summeStimmen = kandidaten.reduce((s, k) => s + k.stimmen, 0);
    mehrheit = mehrheitswahl(kandidaten, sitze, losReihenfolge);
  }

  const result = election.result;
  const pruefung: ZahlenPruefung | null =
    result && wahlverfahren
      ? pruefeZahlen({
          wahlverfahren,
          sitze,
          stimmzettelGesamt: result.stimmzettelGesamt,
          stimmzettelUngueltig: result.stimmzettelUngueltig,
          vermerkteStimmabgaben: vermerkt,
          summeStimmen,
          maxBewerberStimmen: Math.max(0, ...[...bewerber.keys()].map((id) => stimmenJeBewerber.get(id) ?? 0)),
        })
      : null;
  const los = verhaeltnis?.los ?? mehrheit?.los ?? null;

  return {
    election,
    result,
    festgestellt: Boolean(result?.festgestelltAm),
    sitze,
    wahlberechtigte,
    vermerkt,
    brief,
    nominations,
    bewerber,
    stimmenJeBewerber,
    stimmenJeVorschlag,
    wahlverfahren,
    verhaeltnis,
    mehrheit,
    los,
    losReihenfolge,
    pruefung,
    /** Feststellung möglich? */
    bereit: Boolean(result && wahlverfahren && pruefung && pruefung.fehler.length === 0 && !los),
  };
}

export type ErgebnisDaten = Awaited<ReturnType<typeof loadErgebnis>>;

/** Gewählte und Ersatzmitglieder in Reihenfolge – für Feststellung und Dokumente. */
export function gewaehlteUndErsatz(d: ErgebnisDaten): { gewaehlt: string[]; ersatz: string[] } {
  if (d.verhaeltnis) {
    // Ersatzmitglieder je Liste; über alle Listen in Listenreihenfolge
    const ersatz = d.nominations.flatMap((n) => d.verhaeltnis!.ersatzJeListe[n.id] ?? []);
    return { gewaehlt: d.verhaeltnis.gewaehlt, ersatz };
  }
  if (d.mehrheit) return { gewaehlt: d.mehrheit.gewaehlt, ersatz: d.mehrheit.ersatz };
  return { gewaehlt: [], ersatz: [] };
}

/** Mitglieder des Wahlvorstands: erfasste Liste der Wahl, sonst Benutzer mit Rolle Vorsitz/Mitglied. */
export async function wahlvorstandNamen(electionId?: string): Promise<{ name: string; rolle: string }[]> {
  if (electionId) {
    const e = await prisma.election.findUnique({ where: { id: electionId }, select: { wahlausschreibenAngaben: true } });
    const liste = parseAngaben(e?.wahlausschreibenAngaben).wahlvorstand;
    if (liste?.length) return liste.map((m) => ({ name: m.name, rolle: FUNKTION_LABEL[m.funktion] }));
  }
  const users = await prisma.user.findMany({
    where: { role: { in: ["vorsitz", "mitglied"] }, OR: [{ banned: false }, { banned: null }] },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: { name: true, role: true },
  });
  return users.map((u) => ({ name: u.name, rolle: u.role === "vorsitz" ? "Vorsitz" : "Mitglied" }));
}
