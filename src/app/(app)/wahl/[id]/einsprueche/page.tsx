import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { writeAudit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import { formatBerlinDateTime, nowBerlinInput, toBerlinLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { einspruchRechtzeitig } from "@/lib/vorschlaege";
import { getDeadlineEnd } from "@/server/elections";
import { decideObjectionAction, deleteObjectionAction } from "./actions";
import { ObjectionForm } from "./objection-form";

export const metadata = { title: "Einsprüche" };

const ENTSCHEIDUNG = {
  offen: { label: "offen", variant: "warning" },
  stattgegeben: { label: "stattgegeben", variant: "secondary" },
  zurueckgewiesen: { label: "zurückgewiesen", variant: "outline" },
} as const;

export default async function EinspruechePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "voters.edit") || !hasPermission(session.user.role, "voters.sensitive.read")) notFound();

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();

  const [objections, persons, fristende] = await Promise.all([
    prisma.objection.findMany({ where: { electionId: id }, orderBy: { eingangAm: "asc" }, include: { voter: true } }),
    prisma.voter.findMany({ where: { electionId: id }, orderBy: [{ nachname: "asc" }, { vorname: "asc" }], select: { id: true, lfdNr: true, nachname: true, vorname: true } }),
    getDeadlineEnd(id, "auslage_ende"),
  ]);

  if (objections.length) {
    await writeAudit({ userId: session.user.id, action: "objections.sensitive.read", objectType: "election", objectId: id, fields: ["begruendung", "entscheidungsgrund"] });
  }

  const rows = objections.map((o) => {
    const eingang = toBerlinLocal(o.eingangAm);
    return {
      ...o,
      eingangText: formatBerlinDateTime(o.eingangAm),
      rechtzeitig: einspruchRechtzeitig(eingang, fristende),
      begruendung: o.begruendungEnc ? decrypt(o.begruendungEnc, `objection:${o.id}`) : "",
      grund: o.entscheidungsgrundEnc ? decrypt(o.entscheidungsgrundEnc, `objection:${o.id}:grund`) : "",
    };
  });
  const offen = rows.filter((r) => r.entscheidung === "offen").length;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}`} className="hover:underline">
            Wahlkalender
          </Link>{" "}
          /{" "}
          <Link href={`/wahl/${id}/waehler`} className="hover:underline">
            Wählerverzeichnis
          </Link>{" "}
          / Einsprüche
        </p>
        <h1 className="text-3xl">Einsprüche gegen das Wählerverzeichnis</h1>
        <p className="text-muted-foreground">
          {fristende ? `Einspruchsfrist bis ${fristende} Uhr` : "Für dieses Verfahren ist keine Einspruchsfrist berechnet."} · {offen} offen
          · über Einsprüche unverzüglich entscheiden
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einspruch erfassen</CardTitle>
          <CardDescription>Inhalt und Entscheidungsgrund werden verschlüsselt gespeichert.</CardDescription>
        </CardHeader>
        <CardContent>
          <ObjectionForm
            electionId={id}
            defaultEingang={nowBerlinInput()}
            persons={persons.map((p) => ({ id: p.id, label: `${p.nachname}, ${p.vorname} (Nr. ${p.lfdNr})` }))}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bisher keine Einsprüche.</p>
      ) : (
        rows.map((o) => (
          <Card key={o.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Eingang {o.eingangText}</CardTitle>
                <Badge variant={ENTSCHEIDUNG[o.entscheidung].variant}>{ENTSCHEIDUNG[o.entscheidung].label}</Badge>
                {o.rechtzeitig === false && (
                  <Badge variant="outline" className="border-destructive text-destructive">
                    nach Fristende
                  </Badge>
                )}
              </div>
              <CardDescription>
                Betrifft: {o.voter ? `${o.voter.nachname}, ${o.voter.vorname} (Nr. ${o.voter.lfdNr})` : "nicht zugeordnet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="whitespace-pre-line text-sm">{o.begruendung}</p>
              <form action={decideObjectionAction} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <input type="hidden" name="objectionId" value={o.id} />
                <select
                  name="entscheidung"
                  defaultValue={o.entscheidung}
                  aria-label="Entscheidung"
                  className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
                >
                  <option value="offen">offen</option>
                  <option value="stattgegeben">stattgegeben</option>
                  <option value="zurueckgewiesen">zurückgewiesen</option>
                </select>
                <input
                  name="grund"
                  defaultValue={o.grund}
                  maxLength={4000}
                  placeholder="Begründung der Entscheidung"
                  aria-label="Begründung der Entscheidung"
                  className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
                />
                <Button type="submit" size="sm">
                  Entscheidung speichern
                </Button>
              </form>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {o.entscheidung !== "offen" && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/wahl/${id}/einsprueche/${o.id}/bescheid`}>Entscheidung drucken</Link>
                  </Button>
                )}
                {o.entscheidung === "stattgegeben" && o.voter && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/wahl/${id}/waehler/${o.voter.id}`}>Eintrag korrigieren</Link>
                  </Button>
                )}
                {o.entscheidung === "stattgegeben" && !o.voter && (
                  <span className="text-muted-foreground">Fehlende Person im Wählerverzeichnis erfassen.</span>
                )}
                <form action={deleteObjectionAction} className="ml-auto">
                  <input type="hidden" name="objectionId" value={o.id} />
                  <ConfirmSubmitButton size="sm" variant="ghost" confirmText="Diesen Einspruch löschen (nur bei Fehleingabe)?">
                    Löschen
                  </ConfirmSubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
