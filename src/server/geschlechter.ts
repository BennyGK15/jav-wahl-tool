import "server-only";
import { geschlechterRelevant, geschlechterSitze, type GeschlechterVerteilung, type GeschlechterZaehlung } from "@/lib/geschlechter";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { parseAngaben } from "@/lib/wahlausschreiben";

export interface Geschlechterstand {
  sitze: number;
  /** Ab drei Mitgliedern Pflicht (§ 11 Abs. 1 LPVG) */
  relevant: boolean;
  /** Zählung über die Wahlberechtigten im Wählerverzeichnis; null, wenn noch niemand erfasst ist */
  zaehlung: GeschlechterZaehlung | null;
  verteilung: GeschlechterVerteilung | null;
}

/** Anteile und Sitzverteilung nach Geschlechtern für eine Wahl (§ 11 Abs. 3 LPVG, § 8 LPVGWO). */
export async function loadGeschlechter(electionId: string): Promise<Geschlechterstand> {
  const [election, gruppen] = await Promise.all([
    prisma.election.findUniqueOrThrow({ where: { id: electionId }, select: { wahlberechtigteSchaetzung: true, wahlausschreibenAngaben: true } }),
    prisma.voter.groupBy({ by: ["geschlecht"], where: { electionId, wahlberechtigt: true }, _count: { _all: true } }),
  ]);
  const anzahl = (g: "w" | "m" | "d" | null) => gruppen.find((x) => x.geschlecht === g)?._count._all ?? 0;
  const gesamt = gruppen.reduce((s, x) => s + x._count._all, 0);
  const sitze = verfahrensauskunft(gesamt > 0 ? gesamt : election.wahlberechtigteSchaetzung).mitglieder;
  const relevant = geschlechterRelevant(sitze);
  const zaehlung = gesamt > 0 ? { frauen: anzahl("w"), maenner: anzahl("m"), divers: anzahl("d"), ohneAngabe: anzahl(null) } : null;
  const los = parseAngaben(election.wahlausschreibenAngaben).geschlechterLos;
  return { sitze, relevant, zaehlung, verteilung: relevant && zaehlung ? geschlechterSitze(zaehlung, sitze, los) : null };
}
