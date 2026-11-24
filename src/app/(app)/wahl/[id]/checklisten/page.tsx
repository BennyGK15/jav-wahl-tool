import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PHASEN, STANDARD_CHECKLISTE, type Phase } from "@/lib/checklisten";
import { formatBerlinDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { addItemAction, deleteItemAction, toggleItemAction } from "./actions";

export const metadata = { title: "Checklisten" };

async function ensureChecklist(electionId: string) {
  if ((await prisma.checklistItem.count({ where: { electionId } })) > 0) return;
  await prisma.checklistItem.createMany({
    data: (Object.keys(STANDARD_CHECKLISTE) as Phase[]).flatMap((phase) =>
      STANDARD_CHECKLISTE[phase].map((text, i) => ({ electionId, phase, text, sortierung: i + 1 })),
    ),
  });
}

export default async function ChecklistenPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();
  const canEdit = hasPermission(session.user.role, "deadlines.edit");

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, select: { id: true, dienststelle: true } });
  if (!election) notFound();
  if (canEdit) await ensureChecklist(id);

  const items = await prisma.checklistItem.findMany({ where: { electionId: id }, orderBy: [{ phase: "asc" }, { sortierung: "asc" }] });
  const userIds = [...new Set(items.map((i) => i.erledigtVon).filter((x): x is string => Boolean(x)))];
  const users = new Map(
    (await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayUsername: true, username: true } })).map((u) => [
      u.id,
      u.displayUsername ?? u.username ?? "?",
    ]),
  );
  const erledigt = items.filter((i) => i.erledigtAm).length;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}`} className="hover:underline">
            Wahlkalender
          </Link>{" "}
          / Checklisten
        </p>
        <h1 className="text-3xl">Checklisten</h1>
        <p className="text-muted-foreground">
          {election.dienststelle} · {erledigt} von {items.length} erledigt
        </p>
        <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={erledigt} aria-valuemin={0} aria-valuemax={items.length} aria-label="Fortschritt">
          <div className="h-full bg-primary transition-all" style={{ width: `${items.length ? (erledigt / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {(Object.keys(PHASEN) as Phase[]).map((phase) => {
        const list = items.filter((i) => i.phase === phase);
        const done = list.filter((i) => i.erledigtAm).length;
        return (
          <Card key={phase}>
            <CardHeader>
              <CardTitle className="text-base">
                {PHASEN[phase].titel}{" "}
                <span className="font-normal text-muted-foreground">
                  ({done}/{list.length})
                </span>
              </CardTitle>
              <CardDescription>{PHASEN[phase].beschreibung}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1">
              {list.map((item) => (
                <div key={item.id} className="group flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  {canEdit ? (
                    <form action={toggleItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        aria-pressed={Boolean(item.erledigtAm)}
                        aria-label={item.erledigtAm ? `„${item.text}“ wieder öffnen` : `„${item.text}“ abhaken`}
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs",
                          item.erledigtAm ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {item.erledigtAm ? "✓" : ""}
                      </button>
                    </form>
                  ) : (
                    <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs", item.erledigtAm && "bg-primary text-primary-foreground")}>
                      {item.erledigtAm ? "✓" : ""}
                    </span>
                  )}
                  <div className="flex-1 text-sm">
                    <p className={cn(item.erledigtAm && "text-muted-foreground line-through")}>{item.text}</p>
                    {item.erledigtAm && (
                      <p className="text-xs text-muted-foreground">
                        erledigt {formatBerlinDateTime(item.erledigtAm)}
                        {item.erledigtVon ? ` · ${users.get(item.erledigtVon) ?? "?"}` : ""}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <form action={deleteItemAction} className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <input type="hidden" name="itemId" value={item.id} />
                      <ConfirmSubmitButton size="sm" variant="ghost" confirmText={`Punkt „${item.text}“ löschen?`}>
                        Löschen
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              ))}
              {canEdit && (
                <form action={addItemAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="electionId" value={id} />
                  <input type="hidden" name="phase" value={phase} />
                  <Input name="text" required minLength={3} maxLength={500} placeholder="Eigenen Punkt hinzufügen …" className="max-w-md" aria-label={`Punkt zu ${PHASEN[phase].titel} hinzufügen`} />
                  <Button type="submit" size="sm" variant="outline">
                    Hinzufügen
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
