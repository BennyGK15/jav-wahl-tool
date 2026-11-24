import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KalenderMonate } from "@/components/kalender-monate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { imRegelWahlzeitraum, schwellenHinweise, verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { EMPFEHLUNGEN, FRISTENDEN_MIT_UHRZEIT, ZUSATZ_FRISTEN } from "@/lib/fristen";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { SCHRITTE, seiteHref } from "@/lib/ablauf";
import { AUTO_ERLEDIGT, AUTO_HINWEIS } from "@/lib/auto-erledigt";
import { syncErledigt } from "@/server/auto-erledigt";
import { loadRules } from "@/server/elections";
import { voterCounts } from "@/server/voters";
import { applyDienstschlussAllAction, recalculateAction, setDeadlineTime, setDienstschlussAction, toggleDeadlineDone } from "./actions";

export const metadata = { title: "Wahlkalender" };

const VERFAHREN_LABEL = { regulaer: "Reguläres Verfahren", wahlversammlung: "Wahlversammlung" } as const;

export default async function WahlPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "deadlines.read")) notFound();

  const { id } = await params;
  await syncErledigt(id);
  const election = await prisma.election.findUnique({ where: { id }, include: { deadlines: true } });
  if (!election) notFound();
  if (election.einrichtungOffen) redirect(hasPermission(role, "election.manage") ? `/wahl/${id}/einrichtung` : "/");

  const canEdit = hasPermission(role, "deadlines.edit");
  const canManage = hasPermission(role, "election.manage");
  const rules = new Map((await loadRules(election.verfahren)).map((r) => [r.key, r]));
  const wahltag = fromDbDate(election.wahltag);
  const amtszeitEnde = election.amtszeitEnde ? fromDbDate(election.amtszeitEnde) : null;
  const today = todayBerlin();

  const rows = election.deadlines
    .map((d) => {
      const zusatz = ZUSATZ_FRISTEN[d.ruleKey];
      const rule = rules.get(d.ruleKey) ?? (zusatz ? { ...zusatz, verified: false } : undefined);
      return { ...d, iso: fromDbDate(d.datum), rule };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const offen = rows.filter((r) => !r.erledigtAm);
  const ueberfaellig = offen.filter((r) => r.iso < today);
  const ungeprueft = rows.filter((r) => r.rule && !r.rule.verified && !EMPFEHLUNGEN.includes(r.ruleKey));
  const dienstschluss = parseAngaben(election.wahlausschreibenAngaben).dienstschluss;
  const mitUhrzeit = rows.filter((r) => FRISTENDEN_MIT_UHRZEIT.includes(r.ruleKey));
  const abweichend = dienstschluss ? mitUhrzeit.filter((r) => r.uhrzeit !== dienstschluss) : [];
  const vorDienstschluss = (uhrzeit: string | null) => Boolean(dienstschluss && uhrzeit && uhrzeit < dienstschluss);

  const hinweise: string[] = [];
  if (amtszeitEnde && wahltag > amtszeitEnde) hinweise.push(`Der Wahltag liegt nach dem Ende der Amtszeit (${formatIsoDate(amtszeitEnde)}).`);
  if (!imRegelWahlzeitraum(wahltag)) hinweise.push("Der Wahltag liegt außerhalb der regelmäßigen JAV-Wahlzeiträume (§ 62 Abs. 3 LPVG: zusammen mit den Personalratswahlen 1.4.–31.7. 2029, 2034 … und sonst 1.10.–31.1., z. B. 2026/27, 2031/32). Für eine Wahl außerhalb des Turnus kann das richtig sein.");
  if (election.verfahren === "wahlversammlung" && !amtszeitEnde) hinweise.push("Ohne Amtszeitende kann die Einladungsfrist zur Wahlversammlung nicht berechnet werden.");
  const counts = await voterCounts(election.id);
  const auskunft = verfahrensauskunft(counts.wahlberechtigt > 0 ? counts.wahlberechtigt : election.wahlberechtigteSchaetzung);
  if (counts.wahlberechtigt > 0) {
    hinweise.push(...schwellenHinweise(election.wahlberechtigteSchaetzung, counts.wahlberechtigt, election.verfahren));
  }
  if (mitUhrzeit.some((r) => vorDienstschluss(r.uhrzeit))) {
    hinweise.push(`Mindestens ein Fristende liegt vor dem Dienstschluss (${dienstschluss} Uhr). Fristen dürfen nicht vor Ende der Dienststunden der Mehrheit der Wahlberechtigten ablaufen (§ 55 Abs. 2 Satz 2 LPVGWO).`);
  }
  if (ungeprueft.length > 0) hinweise.push(`${ungeprueft.length} Fristregeln sind noch nicht gegen den Gesetzestext geprüft.`);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Wahlkalender</h1>
          <p className="text-muted-foreground">
            {election.dienststelle} · {VERFAHREN_LABEL[election.verfahren]} · Wahltag {formatIsoDate(wahltag)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/wahl/${election.id}/bearbeiten`}>Wahl bearbeiten</Link>
          </Button>
        )}
        {canManage && (
          <form action={recalculateAction}>
            <input type="hidden" name="electionId" value={election.id} />
            <Button variant="outline" size="sm" type="submit">
              Kalender neu berechnen
            </Button>
          </form>
        )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{counts.wahlberechtigt > 0 ? "Wahlberechtigte laut Verzeichnis" : "Wahlberechtigte (Schätzung)"}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{counts.wahlberechtigt > 0 ? counts.wahlberechtigt : election.wahlberechtigteSchaetzung}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {counts.wahlberechtigt > 0 && `Schätzung ${election.wahlberechtigteSchaetzung} · `}JAV mit {auskunft.mitglieder} {auskunft.mitglieder === 1 ? "Mitglied" : "Mitgliedern"} (§ 61 LPVG BW)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Offene Schritte</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{offen.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">von {rows.length} Terminen</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Überfällig</CardDescription>
            <CardTitle className={`text-3xl tabular-nums ${ueberfaellig.length ? "text-destructive" : ""}`}>{ueberfaellig.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Stand {formatIsoDate(today)}</CardContent>
        </Card>
      </div>

      {hinweise.length > 0 && (
        <ul role="note" className="grid gap-1 rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-4 text-sm text-foreground">
          {hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
          {ungeprueft.length > 0 && (
            <li>
              <Link href="/fristen/regeln" className="underline">
                Fristregeln prüfen
              </Link>
            </li>
          )}
        </ul>
      )}

      <Card id="dienstschluss">
        <CardHeader>
          <CardTitle className="text-lg">Uhrzeit für Fristenden</CardTitle>
          <CardDescription>
            Fristen enden nicht vor Dienstschluss der Mehrheit der Wahlberechtigten (§ 55 Abs. 2 Satz 2 LPVGWO). Tragt hier ein, wann die
            meisten Wahlberechtigten Dienstschluss haben – die App schlägt diese Uhrzeit für Einreichungsfrist, Auslage/Einspruchsfrist und Nachfrist vor.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          {canManage ? (
            <form action={setDienstschlussAction} className="flex items-end gap-2">
              <input type="hidden" name="electionId" value={election.id} />
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Dienstschluss der Mehrheit</span>
                <Input name="dienstschluss" type="time" required defaultValue={dienstschluss ?? ""} className="w-32" />
              </label>
              <Button type="submit" size="sm">
                Speichern
              </Button>
            </form>
          ) : (
            <p className="text-sm">
              Dienstschluss der Mehrheit: <strong>{dienstschluss ? `${dienstschluss} Uhr` : "nicht festgelegt"}</strong>
            </p>
          )}
          {canEdit && dienstschluss && abweichend.length > 0 && (
            <form action={applyDienstschlussAllAction}>
              <input type="hidden" name="electionId" value={election.id} />
              <Button type="submit" size="sm" variant="outline">
                {dienstschluss} Uhr für alle {abweichend.length} abweichenden Fristenden übernehmen
              </Button>
            </form>
          )}
          {dienstschluss && abweichend.length === 0 && mitUhrzeit.length > 0 && (
            <p className="text-sm text-muted-foreground">Alle Fristenden stehen auf {dienstschluss} Uhr.</p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="kalender" className="grid gap-3">
        <h2 id="kalender" className="text-xl font-bold">
          Kalender
        </h2>
        <KalenderMonate
          termine={rows.map((r) => ({
            key: r.ruleKey,
            iso: r.iso,
            label: r.rule?.label ?? r.ruleKey,
            uhrzeit: r.uhrzeit,
            erledigt: Boolean(r.erledigtAm),
            href: `#frist-${r.ruleKey}`,
          }))}
          wahltag={wahltag}
          wahltagLabel={election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Erster Wahltag"}
          heute={today}
        />
      </section>

      <h2 className="text-xl font-bold">Alle Termine</h2>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Datum</th>
                <th className="py-2 pr-4 font-medium">Uhrzeit</th>
                <th className="py-2 pr-4 font-medium">Schritt</th>
                <th className="py-2 pr-4 font-medium">Rechtsgrundlage</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...rows.map((r) => ({ kind: "deadline" as const, ...r })), { kind: "wahltag" as const, iso: wahltag }]
                .sort((a, b) => a.iso.localeCompare(b.iso))
                .map((r) =>
                  r.kind === "wahltag" ? (
                    <tr key="wahltag" className="border-t bg-muted/50 font-medium">
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{formatIsoDate(r.iso)}</td>
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4" colSpan={3}>
                        {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Erster Wahltag"}
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} id={`frist-${r.ruleKey}`} className={`border-t ${r.erledigtAm ? "text-muted-foreground" : ""}`}>
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                        {formatIsoDate(r.iso)}
                        {!r.erledigtAm && r.iso < today && (
                          <Badge variant="outline" className="ml-2 border-destructive text-destructive">
                            überfällig
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {canEdit ? (
                          <form action={setDeadlineTime} className="flex items-center gap-1">
                            <input type="hidden" name="deadlineId" value={r.id} />
                            <Input name="uhrzeit" type="time" defaultValue={r.uhrzeit ?? ""} className="h-8 w-28" aria-label={`Uhrzeit: ${r.rule?.label ?? r.ruleKey}`} />
                            <Button type="submit" size="sm" variant="ghost">
                              Speichern
                            </Button>
                          </form>
                        ) : (
                          (r.uhrzeit ?? "–")
                        )}
                        {canEdit && dienstschluss && FRISTENDEN_MIT_UHRZEIT.includes(r.ruleKey) && r.uhrzeit !== dienstschluss && (
                          <form action={setDeadlineTime} className="mt-1">
                            <input type="hidden" name="deadlineId" value={r.id} />
                            <input type="hidden" name="uhrzeit" value={dienstschluss} />
                            <Button type="submit" size="sm" variant="link" className="h-auto p-0 text-xs">
                              Vorschlag übernehmen: {dienstschluss} Uhr
                            </Button>
                          </form>
                        )}
                        {vorDienstschluss(r.uhrzeit) && (
                          <Badge variant="outline" className="mt-1 border-destructive text-destructive">
                            vor Dienstschluss
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {SCHRITTE[r.ruleKey] ? (
                          <Link href={seiteHref(`/wahl/${election.id}`, SCHRITTE[r.ruleKey]!.pfad)} className="font-semibold">
                            {r.rule?.label ?? r.ruleKey}
                          </Link>
                        ) : (
                          (r.rule?.label ?? r.ruleKey)
                        )}
                        {SCHRITTE[r.ruleKey] && !r.erledigtAm && (
                          <span className="block text-xs text-muted-foreground">{SCHRITTE[r.ruleKey]!.aufgabe}</span>
                        )}
                        {r.rule && !r.rule.verified && (
                          <Badge variant={EMPFEHLUNGEN.includes(r.ruleKey) ? "outline" : "warning"} className="ml-2">
                            {EMPFEHLUNGEN.includes(r.ruleKey) ? "Empfehlung" : "ungeprüft"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{r.rule?.legalBasis}</td>
                      <td className="py-2">
                        {r.erledigtVon === AUTO_ERLEDIGT ? (
                          <Badge variant="secondary" title={`Automatisch abgehakt, ${AUTO_HINWEIS[r.ruleKey] ?? ""}`}>
                            Erledigt ✓ · automatisch
                          </Badge>
                        ) : canEdit ? (
                          <form action={toggleDeadlineDone}>
                            <input type="hidden" name="deadlineId" value={r.id} />
                            <Button type="submit" size="sm" variant={r.erledigtAm ? "secondary" : "outline"}>
                              {r.erledigtAm ? "Erledigt ✓" : "Als erledigt markieren"}
                            </Button>
                          </form>
                        ) : r.erledigtAm ? (
                          "erledigt"
                        ) : (
                          "offen"
                        )}
                        {!r.erledigtAm && AUTO_HINWEIS[r.ruleKey] && (
                          <span className="mt-1 block text-xs text-muted-foreground">automatisch, {AUTO_HINWEIS[r.ruleKey]}</span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
