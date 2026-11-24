import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { writeAudit } from "@/lib/audit";
import { todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { FUNKTION_LABEL, parseAngaben } from "@/lib/wahlausschreiben";

export const metadata = { title: "Bekanntmachung des Wahlvorstands" };

const REIHENFOLGE = { vorsitz: 0, stellvertretung: 1, mitglied: 2 } as const;

export default async function WahlvorstandBekanntmachungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const liste = [...(a.wahlvorstand ?? [])].sort(
    (x, y) => REIHENFOLGE[x.funktion] - REIHENFOLGE[y.funktion],
  );
  if (liste.length === 0) {
    return (
      <NochNichtVerfuegbar
        titel="Bekanntmachung des Wahlvorstands"
        text="Bitte zuerst die Mitglieder und Ersatzmitglieder des Wahlvorstands erfassen."
        ziel={{ href: `/wahl/${id}/wahlvorstand`, label: "Zum Wahlvorstand" }}
      />
    );
  }
  await writeAudit({
    userId: session.user.id,
    action: "election.wahlvorstand.notice",
    objectType: "election",
    objectId: id,
  });
  const datum = a.ausstellungsort
    ? `${a.ausstellungsort}, ${formatIsoDate(todayBerlin())}`
    : `Stand: ${formatIsoDate(todayBerlin())}`;
  const vorsitz = liste.find((m) => m.funktion === "vorsitz");

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/wahlvorstand`, label: "Wahlvorstand" }}
      titel="Bekanntmachung"
      entwurf={false}
      kopf={{
        dienststelle: election.dienststelle,
        art: "Bekanntmachung",
        datum,
      }}
      hinweis="Unverzüglich nach der Bestimmung aushängen und bis zur Bekanntmachung des Wahlergebnisses hängen lassen (§ 1 Abs. 3 LPVGWO); zusätzlich elektronisch bekanntmachen (§ 2 Abs. 2)."
    >
      <article className="grid gap-5 text-sm leading-relaxed">
        <header className="text-center">
          <h1 className="text-xl font-bold">
            Bekanntmachung des Wahlvorstands
          </h1>
          <p>für die Wahl der Jugend- und Auszubildendenvertretung</p>
        </header>
        <p>
          Der Personalrat hat{" "}
          {a.wahlvorstandBestelltAm
            ? `am ${formatIsoDate(a.wahlvorstandBestelltAm)} `
            : ""}
          für die Wahl der Jugend- und Auszubildendenvertretung bei{" "}
          <strong>{election.dienststelle}</strong> folgenden Wahlvorstand
          bestimmt (§ 62 Abs. 1 LPVG). Die Ersatzmitglieder treten in der
          angegebenen Reihenfolge für das jeweilige Mitglied ein (§ 1 Abs. 3
          LPVGWO).
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th className="py-1 pr-4">Funktion</th>
              <th className="py-1 pr-4">Mitglied</th>
              <th className="py-1">Ersatzmitglieder</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((m) => (
              <tr key={m.name} className="border-b">
                <td className="py-1 pr-4">{FUNKTION_LABEL[m.funktion]}</td>
                <td className="py-1 pr-4 font-semibold">{m.name}</td>
                <td className="py-1">{m.ersatz ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.einreichungsstelle && (
          <p>
            Erreichbar ist der Wahlvorstand:{" "}
            <strong>{a.einreichungsstelle}</strong>.
          </p>
        )}
        <div className="unterschrift mt-10 grid w-64 gap-1">
          <span className="border-t border-black pt-1">
            {vorsitz
              ? `${vorsitz.name}, Vorsitz des Wahlvorstands`
              : "Vorsitz des Wahlvorstands"}
          </span>
        </div>
      </article>
    </DruckRahmen>
  );
}
