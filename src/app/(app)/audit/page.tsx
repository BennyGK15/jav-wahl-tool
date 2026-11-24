import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_BEREICHE, auditLabel } from "@/lib/audit-labels";
import { formatBerlinDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Audit-Log" };
const PRO_SEITE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ bereich?: string; benutzer?: string; seite?: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "audit.read")) notFound();

  const sp = await searchParams;
  const bereich = sp.bereich && sp.bereich in AUDIT_BEREICHE ? sp.bereich : undefined;
  const benutzer = sp.benutzer && /^[\w-]{1,64}$/.test(sp.benutzer) ? sp.benutzer : undefined;
  const seite = Math.max(1, Number.parseInt(sp.seite ?? "1", 10) || 1);

  // „voter“ umfasst auch „voters.*“, „objection“ auch „objections.*“ usw.
  const where = {
    ...(bereich ? { action: { startsWith: bereich } } : {}),
    ...(benutzer ? { userId: benutzer } : {}),
  };
  const [eintraege, gesamt, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take: PRO_SEITE, skip: (seite - 1) * PRO_SEITE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true, displayUsername: true, username: true }, orderBy: { name: "asc" } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.displayUsername ?? u.username ?? u.name]));
  const seiten = Math.max(1, Math.ceil(gesamt / PRO_SEITE));
  const link = (s: number) => {
    const q = new URLSearchParams({ ...(bereich ? { bereich } : {}), ...(benutzer ? { benutzer } : {}), seite: String(s) });
    return `/audit?${q}`;
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Audit-Log</h1>
        <p className="max-w-3xl text-muted-foreground">
          Wer hat wann was getan. Das Protokoll enthält bewusst nur Feldnamen und Kennungen, keine Inhalte; IP-Adressen sind
          nur als Prüfsumme gespeichert.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Bereich
          <select name="bereich" defaultValue={bereich ?? ""} className="h-10 rounded-sm border border-input bg-card px-3 text-sm">
            <option value="">alle</option>
            {Object.entries(AUDIT_BEREICHE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Benutzer
          <select name="benutzer" defaultValue={benutzer ?? ""} className="h-10 rounded-sm border border-input bg-card px-3 text-sm">
            <option value="">alle</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayUsername ?? u.username ?? u.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </form>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {eintraege.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Einträge.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Zeitpunkt</th>
                  <th className="py-2 pr-4 font-semibold">Benutzer</th>
                  <th className="py-2 pr-4 font-semibold">Aktion</th>
                  <th className="py-2 pr-4 font-semibold">Objekt</th>
                  <th className="py-2 font-semibold">Felder</th>
                </tr>
              </thead>
              <tbody>
                {eintraege.map((e) => (
                  <tr key={e.id} className="border-t align-top">
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{formatBerlinDateTime(e.at)}</td>
                    <td className="py-2 pr-4">{e.userId ? (name.get(e.userId) ?? "gelöschtes Konto") : "System"}</td>
                    <td className="py-2 pr-4">
                      {auditLabel(e.action)}
                      <span className="block font-mono text-xs text-muted-foreground">{e.action}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {e.objectType}
                      {e.objectId ? ` · ${e.objectId.slice(0, 8)}` : ""}
                    </td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{Array.isArray(e.fields) ? (e.fields as string[]).join(", ") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <nav aria-label="Seiten" className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {gesamt} Einträge · Seite {seite} von {seiten}
        </span>
        <span className="flex gap-2">
          {seite > 1 && (
            <Button asChild size="sm" variant="outline">
              <Link href={link(seite - 1)}>← Neuere</Link>
            </Button>
          )}
          {seite < seiten && (
            <Button asChild size="sm" variant="outline">
              <Link href={link(seite + 1)}>Ältere →</Link>
            </Button>
          )}
        </span>
      </nav>
    </div>
  );
}
