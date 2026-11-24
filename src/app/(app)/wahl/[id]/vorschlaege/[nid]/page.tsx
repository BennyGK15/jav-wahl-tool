import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBerlinDateTime, toBerlinLocal } from "@/lib/dates";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { loadNominations, STATUS_LABEL } from "@/server/nominations";
import {
  setGeschlechterBegruendungAction,
  addCandidateAction,
  addSupporterAction,
  decideNominationAction,
  deleteNominationAction,
  moveCandidateAction,
  removeCandidateAction,
  removeSupporterAction,
  toggleConsentAction,
} from "../actions";
import { NominationForm } from "../nomination-form";

export const metadata = { title: "Wahlvorschlag" };

const selectClass =
  "h-9 min-w-64 rounded-sm border border-input bg-card px-3 text-sm";
const GESCHLECHT = { w: "weiblich", m: "männlich", d: "divers" } as const;

function verteilung(list: { geschlecht: "w" | "m" | "d" | null }[]) {
  const z = { w: 0, m: 0, d: 0, ohne: 0 };
  for (const p of list) z[p.geschlecht ?? "ohne"]++;
  return z;
}

export default async function VorschlagPage({
  params,
}: Readonly<{ params: Promise<{ id: string; nid: string }> }>) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "nominations.edit")) notFound();

  const { id, nid } = await params;
  const data = await loadNominations(id).catch(() => null);
  const n = data?.nominations.find((x) => x.id === nid);
  if (!data || !n) notFound();

  const editable = n.status === "eingegangen";
  const onList = new Set(n.candidates.map((c) => c.voterId));
  const signed = new Set(n.supporters.map((s) => s.voterId));
  const persons = await prisma.voter.findMany({
    where: {
      electionId: id,
      OR: [{ waehlbar: true }, { wahlberechtigt: true }],
    },
    orderBy: [{ nachname: "asc" }, { vorname: "asc" }],
    select: {
      id: true,
      lfdNr: true,
      nachname: true,
      vorname: true,
      waehlbar: true,
      wahlberechtigt: true,
      geschlecht: true,
    },
  });
  const kandidierbar = persons.filter((p) => p.waehlbar && !onList.has(p.id));
  const unterzeichnend = persons.filter(
    (p) => p.wahlberechtigt && !signed.has(p.id),
  );
  const label = (p: { nachname: string; vorname: string; lfdNr: number }) =>
    `${p.nachname}, ${p.vorname} (Nr. ${p.lfdNr})`;

  const wahlberechtigte = persons.filter((p) => p.wahlberechtigt);
  const mitglieder = verfahrensauskunft(wahlberechtigte.length).mitglieder;
  const vBewerber = verteilung(n.candidates.map((c) => c.voter));
  const vBerechtigt = verteilung(wahlberechtigte);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}/vorschlaege`} className="hover:underline">
            Wahlvorschläge
          </Link>{" "}
          / {n.kennwort ?? "ohne Kennwort"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">
            {n.kennwort ?? "Wahlvorschlag ohne Kennwort"}
          </h1>
          <Badge
            variant={
              n.status === "gueltig"
                ? "secondary"
                : n.status === "eingegangen"
                  ? "warning"
                  : "outline"
            }
          >
            {STATUS_LABEL[n.status]}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {n.hatFehler && (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/wahl/${id}/vorschlaege/${n.id}/schreiben?art=maengel`}
              >
                Mängelmitteilung drucken
              </Link>
            </Button>
          )}
          {n.status === "ungueltig" && (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/wahl/${id}/vorschlaege/${n.id}/schreiben?art=zurueckweisung`}
              >
                Zurückweisung drucken
              </Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Eingang {formatBerlinDateTime(n.eingangAm)} ·{" "}
          {n.einreicherArt === "gewerkschaft"
            ? `Gewerkschaft ${n.gewerkschaft ?? ""}`
            : "Vorschlag der Beschäftigten"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prüfprotokoll</CardTitle>
          <CardDescription>
            Arbeitshilfe – über die Gültigkeit entscheidet der Wahlvorstand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {n.checks.map((c) => (
              <li key={c.text} className="flex gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    c.status === "ok" && "bg-secondary",
                    c.status === "fehler" && "bg-destructive text-white",
                    c.status === "hinweis" &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  {c.status === "ok" ? "✓" : c.status === "fehler" ? "!" : "i"}
                </span>
                <span>
                  <span className="sr-only">
                    {c.status === "ok"
                      ? "In Ordnung: "
                      : c.status === "fehler"
                        ? "Mangel: "
                        : "Hinweis: "}
                  </span>
                  {c.text}
                </span>
              </li>
            ))}
            {mitglieder >= 3 && (
              <li className="flex gap-2 text-muted-foreground">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold"
                >
                  i
                </span>
                <span>
                  Geschlechteranteile (bei mindestens 3 JAV-Mitgliedern zu
                  berücksichtigen): Wahlberechtigte w {vBerechtigt.w} / m{" "}
                  {vBerechtigt.m} / d {vBerechtigt.d}
                  {vBerechtigt.ohne
                    ? ` / ohne Angabe ${vBerechtigt.ohne}`
                    : ""}{" "}
                  – auf diesem Vorschlag w {vBewerber.w} / m {vBewerber.m} / d{" "}
                  {vBewerber.d}
                  {vBewerber.ohne ? ` / ohne Angabe ${vBewerber.ohne}` : ""}.
                </span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {mitglieder >= 3 && (
        <Card id="begruendung">
          <CardHeader>
            <CardTitle className="text-base">
              Begründung bei abweichender Verteilung von Frauen und Männern
            </CardTitle>
            <CardDescription>
              Nur nötig, wenn der Vorschlag weniger Frauen oder Männer enthält,
              als Sitze auf sie entfallen (§ 12 Abs. 2 Satz 2 LPVGWO). Die
              Begründung muss schriftlich mit dem Vorschlag eingereicht worden
              sein und wird mit ihm bekanntgemacht (§ 18 Abs. 1).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={setGeschlechterBegruendungAction}
              className="grid gap-2"
            >
              <input type="hidden" name="nominationId" value={n.id} />
              <textarea
                name="begruendung"
                rows={3}
                maxLength={4000}
                defaultValue={n.geschlechterBegruendung ?? ""}
                disabled={n.status !== "eingegangen"}
                aria-label="Begründung laut Wahlvorschlag"
                placeholder="Wortlaut der Begründung aus dem eingereichten Wahlvorschlag"
                className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
              />
              {n.status === "eingegangen" && (
                <div>
                  <Button type="submit" size="sm" variant="outline">
                    Begründung speichern
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Bewerberinnen und Bewerber ({n.candidates.length})
          </CardTitle>
          <CardDescription>
            In der Reihenfolge des Wahlvorschlags. Auswählbar sind nur wählbare
            Personen aus dem Verzeichnis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {n.candidates.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Platz</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Zustimmung</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {n.candidates.map((c, i) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pr-4 tabular-nums">{c.listenplatz}</td>
                    <td className="py-2 pr-4">
                      {c.voter.nachname}, {c.voter.vorname}
                      {c.voter.geschlecht && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {GESCHLECHT[c.voter.geschlecht]}
                        </span>
                      )}
                      {!c.voter.waehlbar && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-destructive text-destructive"
                        >
                          nicht wählbar
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <form action={toggleConsentAction}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant={
                            c.zustimmungLiegtVor ? "secondary" : "outline"
                          }
                          disabled={!editable}
                        >
                          {c.zustimmungLiegtVor ? "liegt vor ✓" : "fehlt"}
                        </Button>
                      </form>
                    </td>
                    <td className="py-2">
                      {editable && (
                        <div className="flex justify-end gap-1">
                          <form action={moveCandidateAction}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={c.id}
                            />
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={i === 0}
                              aria-label="Nach oben"
                            >
                              ↑
                            </Button>
                          </form>
                          <form action={moveCandidateAction}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={c.id}
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value="down"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={i === n.candidates.length - 1}
                              aria-label="Nach unten"
                            >
                              ↓
                            </Button>
                          </form>
                          <form action={removeCandidateAction}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={c.id}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Entfernen
                            </Button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {editable && (
            <form
              action={addCandidateAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="nominationId" value={n.id} />
              <select
                name="voterId"
                required
                aria-label="Person hinzufügen"
                className={selectClass}
                defaultValue=""
              >
                <option value="" disabled>
                  Wählbare Person auswählen …
                </option>
                {kandidierbar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="zustimmung" /> Zustimmung liegt vor
              </label>
              <Button type="submit" size="sm" variant="outline">
                Hinzufügen
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {n.einreicherArt === "beschaeftigte" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Stützunterschriften ({n.supporters.length})
            </CardTitle>
            <CardDescription>
              Werden nie veröffentlicht. Nur Unterschriften von Wahlberechtigten
              zählen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {n.supporters.length > 0 && (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {n.supporters
                  .slice()
                  .sort((a, b) =>
                    a.voter.nachname.localeCompare(b.voter.nachname, "de"),
                  )
                  .map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 border-b py-1"
                    >
                      <span>
                        {s.voter.nachname}, {s.voter.vorname}
                        {!s.voter.wahlberechtigt && (
                          <span className="text-destructive">
                            {" "}
                            · nicht wahlberechtigt
                          </span>
                        )}
                      </span>
                      {editable && (
                        <form action={removeSupporterAction}>
                          <input
                            type="hidden"
                            name="supporterId"
                            value={s.id}
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            Entfernen
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            {editable && (
              <form
                action={addSupporterAction}
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="nominationId" value={n.id} />
                <select
                  name="voterId"
                  required
                  aria-label="Unterschrift hinzufügen"
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Wahlberechtigte Person auswählen …
                  </option>
                  {unterzeichnend.map((p) => (
                    <option key={p.id} value={p.id}>
                      {label(p)}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Hinzufügen
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Entscheidung des Wahlvorstands
          </CardTitle>
          <CardDescription>
            Solange der Status „eingegangen“ ist, können Bewerber und
            Unterschriften geändert werden. Die Ordnungsnummer wird nach dem
            Losentscheid vergeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={decideNominationAction} className="grid gap-3">
            <input type="hidden" name="nominationId" value={n.id} />
            <div className="flex flex-wrap items-end gap-3">
              <select
                name="status"
                defaultValue={n.status}
                aria-label="Status"
                className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
              >
                <option value="eingegangen">eingegangen (in Prüfung)</option>
                <option value="gueltig">gültig</option>
                <option value="ungueltig">ungültig</option>
                <option value="zurueckgegeben">
                  zurückgegeben (Mängel behebbar)
                </option>
              </select>
              <Input
                name="ordnungsnummer"
                type="number"
                min={1}
                max={99}
                defaultValue={n.ordnungsnummer ?? ""}
                placeholder="Ordnungsnr."
                aria-label="Ordnungsnummer"
                className="w-32"
              />
            </div>
            <textarea
              name="pruefnotiz"
              defaultValue={n.pruefnotiz ?? ""}
              rows={2}
              maxLength={4000}
              placeholder="Prüfnotiz / Begründung"
              aria-label="Prüfnotiz"
              className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
            />
            {n.hatFehler && (
              <p className="text-sm text-destructive">
                Das Prüfprotokoll enthält Mängel. Bitte vor „gültig“ prüfen.
              </p>
            )}
            <div>
              <Button type="submit" size="sm">
                Entscheidung speichern
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Angaben zum Eingang</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <NominationForm
            electionId={id}
            disabled={!editable}
            defaults={{
              nominationId: n.id,
              kennwort: n.kennwort,
              einreicherArt: n.einreicherArt,
              gewerkschaft: n.gewerkschaft,
              eingangAm: toBerlinLocal(n.eingangAm).replace(" ", "T"),
            }}
          />
          <form action={deleteNominationAction}>
            <input type="hidden" name="nominationId" value={n.id} />
            <ConfirmSubmitButton
              size="sm"
              variant="ghost"
              confirmText="Diesen Wahlvorschlag löschen (nur bei Fehleingabe)?"
            >
              Wahlvorschlag löschen
            </ConfirmSubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
