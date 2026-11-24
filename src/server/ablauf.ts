import "server-only";
import { berechneAblauf, type Ablauf, type Verfuegbarkeit } from "@/lib/ablauf";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { ZUSATZ_FRISTEN } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { syncErledigt } from "@/server/auto-erledigt";
import { loadRules } from "@/server/elections";

type ElectionLike = {
  id: string;
  verfahren: "regulaer" | "wahlversammlung";
  wahltag: Date;
  nachfristBekanntgemachtAm: Date | null;
};

/** Phasen, aktueller Schritt und alle Schritte einer Wahl. */
export async function loadAblauf(
  election: ElectionLike,
): Promise<Ablauf & { verfuegbar: Verfuegbarkeit }> {
  await syncErledigt(election.id);
  const [deadlines, result, rules] = await Promise.all([
    prisma.deadline.findMany({ where: { electionId: election.id } }),
    prisma.result.findUnique({
      where: { electionId: election.id },
      select: { festgestelltAm: true },
    }),
    loadRules(election.verfahren),
  ]);
  const labels = new Map(rules.map((r) => [r.key, r.label]));
  const ablauf = berechneAblauf({
    verfahren: election.verfahren,
    termine: deadlines.map((d) => ({
      id: d.id,
      key: d.ruleKey,
      datum: fromDbDate(d.datum),
      uhrzeit: d.uhrzeit,
      label:
        labels.get(d.ruleKey) ?? ZUSATZ_FRISTEN[d.ruleKey]?.label ?? d.ruleKey,
      erledigt: Boolean(d.erledigtAm),
    })),
    wahltag: fromDbDate(election.wahltag),
    ergebnisFestgestellt: Boolean(result?.festgestelltAm),
    heute: todayBerlin(),
  });
  return {
    ...ablauf,
    verfuegbar: {
      nachfrist: Boolean(election.nachfristBekanntgemachtAm),
      ergebnis: Boolean(result),
    },
  };
}
