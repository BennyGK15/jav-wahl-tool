import { notFound } from "next/navigation";
import { DruckRahmen, Wert } from "@/components/druck-rahmen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { voterCounts } from "@/server/voters";
import { verfahrensauskunft } from "@/lib/jav";
import { saveEinladungAction } from "./actions";

export const metadata = { title: "Einladung zur Wahlversammlung" };

export default async function EinladungPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();
  const canManage = hasPermission(session.user.role, "election.manage");
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, include: { deadlines: { where: { ruleKey: "wv_einladung" } } } });
  if (!election || election.verfahren !== "wahlversammlung") notFound();
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const counts = await voterCounts(id);
  const mitglieder = verfahrensauskunft(counts.wahlberechtigt || election.wahlberechtigteSchaetzung).mitglieder;
  const spaetestens = election.deadlines[0] ? formatIsoDate(fromDbDate(election.deadlines[0].datum)) : null;


  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}`, label: "Wahlkalender" }}
      titel="Einladung"
      kopf={{ dienststelle: election.dienststelle, art: "Einladung", datum: `Stand: ${formatIsoDate(todayBerlin())}` }}
      entwurf={false}
      hinweis={
        <div className="grid gap-3">
          <p>
            Muster nach der Arbeitsunterlage – gegen § 62 Abs. 2 LPVG BW und die LPVGWO prüfen.
            {spaetestens && <> Spätestens auszuhängen am <strong>{spaetestens}</strong>.</>}
          </p>
          {canManage && (
            <form action={saveEinladungAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="electionId" value={id} />
              <label className="grid gap-1 font-medium">
                Ort der Versammlung
                <Input name="wahlraum" required defaultValue={a.wahlraum ?? ""} className="w-64" />
              </label>
              <label className="grid gap-1 font-medium">
                Beginn
                <Input name="wahlzeitVon" type="time" required defaultValue={a.wahlzeitVon ?? ""} className="w-32" />
              </label>
              <label className="grid gap-1 font-medium">
                Ausstellungsort
                <Input name="ausstellungsort" required defaultValue={a.ausstellungsort ?? ""} className="w-48" />
              </label>
              <Button type="submit" size="sm" variant="outline">
                Speichern
              </Button>
            </form>
          )}
        </div>
      }
    >
      <article className="grid gap-4 text-sm leading-relaxed">
        <header className="text-center">
          <h1 className="text-xl font-bold">Einladung zur Wahlversammlung</h1>
          <p>zur Wahl der Jugend- und Auszubildendenvertretung</p>
          <p className="mt-1">Dienststelle: {election.dienststelle}</p>
        </header>
        <p>Der Wahlvorstand lädt alle wahlberechtigten Beschäftigten der Dienststelle zur Wahlversammlung ein.</p>
        <table className="w-full max-w-md">
          <tbody>
            <tr>
              <td className="py-1 pr-4">Datum</td>
              <td>
                <strong>{formatIsoDate(fromDbDate(election.wahltag))}</strong>
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Beginn</td>
              <td>
                <Wert v={a.wahlzeitVon ? `${a.wahlzeitVon} Uhr` : null} l="Uhrzeit" />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Ort</td>
              <td>
                <Wert v={a.wahlraum} l="Ort" />
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Zu wählen {mitglieder === 1 ? "ist" : "sind"} <strong>{mitglieder}</strong> {mitglieder === 1 ? "Mitglied" : "Mitglieder"} der
          Jugend- und Auszubildendenvertretung.
        </p>
        <div>
          <p className="font-semibold">Tagesordnung</p>
          <ol className="list-decimal pl-6">
            <li>Begrüßung und Erläuterung des Wahlverfahrens</li>
            <li>Vorstellung der gesetzlichen Grundlagen</li>
            <li>Wahlvorschläge aus der Mitte der Wahlversammlung</li>
            <li>Geheime Wahl mit Stimmzetteln (Mehrheitswahl)</li>
            <li>Feststellung und Bekanntgabe des Wahlergebnisses</li>
          </ol>
        </div>
        <p>
          Wahlberechtigt sind Beschäftigte unter 18 Jahren sowie alle Beschäftigten in beruflicher Ausbildung (§ 60 Abs. 1 LPVG
          BW). Wählbar sind Beschäftigte unter 26 Jahren sowie Beschäftigte in beruflicher Ausbildung. Eine schriftliche
          Stimmabgabe (Briefwahl) ist bei der Wahlversammlung nicht vorgesehen.
        </p>
        <footer className="unterschrift mt-8 grid gap-10">
          <p>
            <Wert v={a.ausstellungsort} l="Ort" />, den {formatIsoDate(todayBerlin())}
          </p>
          <p>Der Wahlvorstand</p>
        </footer>
      </article>
    </DruckRahmen>
  );
}
