import { Badge } from "@/components/ui/badge";
import {
  EMPFEHLUNGEN,
  PRUEFER_LANDESRECHT,
  RECHTSSTAND,
  describeRule,
} from "@/lib/fristen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { ensureDefaultRules } from "@/server/elections";
import { toggleRuleVerified } from "./actions";

export const metadata = { title: "Fristregeln" };

const VERFAHREN = [
  { key: "regulaer", title: "Reguläres Verfahren" },
  { key: "wahlversammlung", title: "Wahlversammlung" },
] as const;

const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

export default async function RegelnPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) {
    return <p className="text-muted-foreground">Keine Berechtigung.</p>;
  }
  const canVerify = hasPermission(session.user.role, "rules.verify");

  await ensureDefaultRules();
  const rules = await prisma.deadlineRule.findMany({ orderBy: { key: "asc" } });
  const verifierIds = [
    ...new Set(
      rules
        .map((r) => r.verifiedBy)
        .filter((v): v is string => Boolean(v) && v !== PRUEFER_LANDESRECHT),
    ),
  ];
  const verifiers = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: verifierIds } },
        select: { id: true, displayUsername: true, username: true },
      })
    ).map((u) => [u.id, u.displayUsername ?? u.username ?? "unbekannt"]),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Fristregeln</h1>
        <p className="max-w-3xl text-muted-foreground">
          Grundlage aller Wahlkalender. Die Standardregeln sind mit dem
          amtlichen Text auf landesrecht-bw.de abgeglichen (Stand{" "}
          {RECHTSSTAND.geprueftAm.split("-").reverse().join(".")}):{" "}
          {RECHTSSTAND.lpvg}; {RECHTSSTAND.lpvgwo}. Regeln ohne gesetzliche
          Frist sind als Empfehlung gekennzeichnet und bleiben ungeprüft. Ändert
          ihr eine Regel, prüft sie bitte selbst und wählt danach im
          Wahlkalender „Kalender neu berechnen“.
        </p>
      </div>

      {VERFAHREN.map((v) => (
        <Card key={v.key}>
          <CardHeader>
            <CardTitle>{v.title}</CardTitle>
            <CardDescription>
              {rules.filter((r) => r.verfahren === v.key && r.verified).length}{" "}
              von {rules.filter((r) => r.verfahren === v.key).length} geprüft
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Schritt</th>
                  <th className="py-2 pr-4 font-medium">Regel</th>
                  <th className="py-2 pr-4 font-medium">Rechtsgrundlage</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules
                  .filter((r) => r.verfahren === v.key)
                  .map((r) => (
                    <tr key={r.key} className="border-t align-top">
                      <td className="py-2 pr-4">{r.label}</td>
                      <td className="py-2 pr-4">{describeRule(r)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {r.legalBasis}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.verified ? (
                            <Badge variant="secondary">
                              geprüft
                              {r.verifiedBy === PRUEFER_LANDESRECHT
                                ? " durch Abgleich mit Landesrecht BW"
                                : r.verifiedBy
                                  ? ` von ${verifiers.get(r.verifiedBy) ?? "?"}`
                                  : ""}
                              {r.verifiedAt
                                ? ` am ${dateTime.format(r.verifiedAt)}`
                                : ""}
                            </Badge>
                          ) : EMPFEHLUNGEN.includes(r.key) ? (
                            <Badge variant="outline">
                              Empfehlung – keine gesetzliche Frist
                            </Badge>
                          ) : (
                            <Badge variant="warning">ungeprüft</Badge>
                          )}
                          {canVerify && (
                            <form action={toggleRuleVerified}>
                              <input type="hidden" name="key" value={r.key} />
                              <Button type="submit" size="sm" variant="outline">
                                {r.verified
                                  ? "Prüfung zurücknehmen"
                                  : "Als geprüft markieren"}
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
