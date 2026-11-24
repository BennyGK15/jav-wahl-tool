import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBerlinDateTime, fromDbDate, nowBerlinInput, todayBerlin } from "@/lib/dates";
import { formatIsoDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { mindestStuetzunterschriften, STUETZ_RECHTSGRUNDLAGE } from "@/lib/jav";
import { getDeadlineEnd } from "@/server/elections";
import { voterCounts } from "@/server/voters";
import { loadNominations, STATUS_LABEL } from "@/server/nominations";
import { setMinSupportersAction, setNachfristAction } from "./actions";
import { NominationForm } from "./nomination-form";

export const metadata = { title: "Wahlvorschläge" };

export default async function VorschlaegePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "nominations.edit")) notFound();
  const canManage = hasPermission(role, "election.manage");

  const { id } = await params;
  const data = await loadNominations(id).catch(() => null);
  if (!data) notFound();
  const { election, fristende, nominations } = data;

  if (election.verfahren === "wahlversammlung") {
    return (
      <p className="text-muted-foreground">
        Bei der Wahlversammlung werden Wahlvorschläge aus der Mitte der Versammlung gemacht – eine schriftliche Erfassung
        entfällt.
      </p>
    );
  }

  const heute = todayBerlin();
  const regulaerEnde = await getDeadlineEnd(id, "wahlvorschlaege_ende");
  const fristAbgelaufen = Boolean(regulaerEnde && regulaerEnde.slice(0, 10) < heute);
  const gueltige = nominations.filter((n) => n.status === "gueltig").length;
  const nachfrist = election.nachfristBekanntgemachtAm ? fromDbDate(election.nachfristBekanntgemachtAm) : null;
  const { wahlberechtigt } = await voterCounts(id);
  const basis = wahlberechtigt > 0 ? wahlberechtigt : election.wahlberechtigteSchaetzung;
  const vorschlagMin = mindestStuetzunterschriften(basis);
  const gespeichert = election.stuetzunterschriftenMin;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/wahl/${id}`} className="hover:underline">
              Wahlkalender
            </Link>{" "}
            / Wahlvorschläge
          </p>
          <h1 className="text-3xl">Wahlvorschläge</h1>
          <p className="text-muted-foreground">
            {fristende ? `Einreichungsfrist bis ${fristende} Uhr` : "Einreichungsfrist nicht berechnet"} · {nominations.length} eingegangen
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/wahl/${id}/vorschlaege/vordruck`}>Vordruck Wahlvorschlag</Link>
          </Button>
          {gueltige > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/wahl/${id}/stimmzettel`}>Stimmzettel drucken</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={`/wahl/${id}/vorschlaege/bekanntmachung`}>Bekanntmachung drucken</Link>
          </Button>
        </div>
      </div>

      {(nachfrist || (fristAbgelaufen && gueltige === 0)) && (
        <Card className={nachfrist ? undefined : "border-2 border-primary"}>
          <CardHeader>
            <CardTitle className="text-base">Nachfrist für Wahlvorschläge (§ 16 LPVGWO)</CardTitle>
            <CardDescription>
              {nachfrist
                ? `Bekannt gemacht am ${formatIsoDate(nachfrist)}. Neue Vorschläge können bis ${fristende ?? "–"} Uhr eingereicht werden.`
                : "Die Einreichungsfrist ist abgelaufen und es liegt kein gültiger Wahlvorschlag vor. Der Wahlvorstand muss eine Nachfrist von sechs Arbeitstagen bekannt machen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            {canManage && !nachfrist && (
              <form action={setNachfristAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="electionId" value={id} />
                <label className="grid gap-1 text-sm font-medium">
                  Tag der Bekanntmachung
                  <Input name="datum" type="date" required defaultValue={heute} className="w-44" />
                </label>
                <Button type="submit" size="sm">
                  Nachfrist festlegen
                </Button>
              </form>
            )}
            {nachfrist && (
              <Button asChild size="sm">
                <Link href={`/wahl/${id}/vorschlaege/nachfrist`}>Bekanntmachung der Nachfrist drucken</Link>
              </Button>
            )}
            {canManage && nachfrist && (
              <form action={setNachfristAction}>
                <input type="hidden" name="electionId" value={id} />
                <input type="hidden" name="aufheben" value="1" />
                <Button type="submit" size="sm" variant="ghost">
                  Nachfrist aufheben
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="mindestunterschriften">
        <CardHeader>
          <CardTitle className="text-base">Mindestzahl der Stützunterschriften</CardTitle>
          <CardDescription>
            Gilt für Vorschläge der Beschäftigten (nicht für Gewerkschaften): mindestens ein Zwanzigstel der Wahlberechtigten,
            in jedem Fall genügen 50 ({STUETZ_RECHTSGRUNDLAGE}).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3 border-l-4 border-l-foreground bg-highlight p-3 text-sm">
            <p>
              Vorschlag: <strong className="text-base">{vorschlagMin}</strong>{" "}
              {vorschlagMin === 1 ? "Unterschrift" : "Unterschriften"}
              <span className="text-muted-foreground">
                {" "}
                – {basis} Wahlberechtigte {wahlberechtigt > 0 ? "laut Wählerverzeichnis" : "(Schätzung, Verzeichnis noch leer)"} ÷ 20, aufgerundet
                {Math.ceil(basis / 20) > 50 ? ", begrenzt auf 50" : ""}
              </span>
            </p>
            {canManage && gespeichert !== vorschlagMin && (
              <form action={setMinSupportersAction}>
                <input type="hidden" name="electionId" value={id} />
                <input type="hidden" name="min" value={vorschlagMin} />
                <Button type="submit" size="sm" variant="outline">
                  Übernehmen
                </Button>
              </form>
            )}
            {gespeichert === vorschlagMin && <span className="font-semibold">✓ übernommen</span>}
          </div>
          {gespeichert != null && gespeichert !== vorschlagMin && (
            <p className="text-sm text-destructive">
              Der festgelegte Wert ({gespeichert}) weicht vom Vorschlag ab
              {wahlberechtigt > 0 ? " – hat sich die Zahl der Wahlberechtigten geändert?" : "."}
            </p>
          )}
          {canManage ? (
            <form action={setMinSupportersAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="electionId" value={id} />
              <label className="grid gap-1 text-sm font-medium">
                Festgelegte Mindestzahl
                <Input name="min" type="number" min={0} max={1000} defaultValue={gespeichert ?? ""} className="w-28" />
              </label>
              <Button type="submit" size="sm" variant="outline">
                Speichern
              </Button>
            </form>
          ) : (
            <p className="text-sm">Festgelegt: {gespeichert ?? "noch nicht festgelegt"}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wahlvorschlag erfassen</CardTitle>
          <CardDescription>Datum und Uhrzeit des Eingangs genau erfassen – sie entscheiden über die Rechtzeitigkeit.</CardDescription>
        </CardHeader>
        <CardContent>
          <NominationForm electionId={id} defaultEingang={nowBerlinInput()} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {nominations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Wahlvorschläge.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Eingang</th>
                  <th className="py-2 pr-4 font-medium">Kennwort / Einreicher</th>
                  <th className="py-2 pr-4 font-medium">Bewerber</th>
                  <th className="py-2 pr-4 font-medium">Unterschriften</th>
                  <th className="py-2 pr-4 font-medium">Prüfung</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {nominations.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <Link href={`/wahl/${id}/vorschlaege/${n.id}`} className="underline-offset-4 hover:underline">
                        {formatBerlinDateTime(n.eingangAm)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {n.kennwort ?? "ohne Kennwort"}
                      <span className="block text-muted-foreground">
                        {n.einreicherArt === "gewerkschaft" ? n.gewerkschaft : "Beschäftigte"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{n.candidates.length}</td>
                    <td className="py-2 pr-4 tabular-nums">{n.einreicherArt === "gewerkschaft" ? "–" : n.supporters.length}</td>
                    <td className="py-2 pr-4">
                      {n.hatFehler ? (
                        <Badge variant="outline" className="border-destructive text-destructive">
                          {n.checks.filter((c) => c.status === "fehler").length} Mängel
                        </Badge>
                      ) : (
                        <Badge variant="secondary">ohne Mängel</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant={n.status === "gueltig" ? "secondary" : n.status === "eingegangen" ? "warning" : "outline"}>
                        {STATUS_LABEL[n.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
