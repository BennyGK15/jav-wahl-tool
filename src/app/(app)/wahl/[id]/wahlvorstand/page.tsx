import Link from "next/link";
import { notFound } from "next/navigation";
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
import { FUNKTION_LABEL, parseAngaben } from "@/lib/wahlausschreiben";
import { wahlvorstandNamen } from "@/server/ergebnis";
import { WahlvorstandForm } from "./wahlvorstand-form";

export const metadata = { title: "Wahlvorstand" };

export default async function WahlvorstandPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();
  const canManage = hasPermission(session.user.role, "election.manage");
  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) notFound();
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const liste = a.wahlvorstand ?? [];
  // Vorschlag aus den Benutzerkonten, solange nichts erfasst ist
  const vorschlag = liste.length
    ? liste
    : (await wahlvorstandNamen()).map((m, i) => ({
        name: m.name,
        funktion:
          i === 0 && m.rolle === "Vorsitz"
            ? ("vorsitz" as const)
            : ("mitglied" as const),
      }));
  const prWaehlbar = liste.some((m) => m.prWaehlbar);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Wahlvorstand</h1>
          <p className="max-w-3xl text-muted-foreground">
            Der Personalrat bestimmt den Wahlvorstand, den Vorsitz und die
            Stellvertretung (§ 62 Abs. 1 LPVG). Der Wahlvorstand macht die Namen
            seiner Mitglieder und Ersatzmitglieder unverzüglich bekannt und
            lässt den Aushang bis zur Bekanntmachung des Wahlergebnisses hängen
            (§ 1 Abs. 3 LPVGWO).
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant={liste.length ? "default" : "outline"}
        >
          <Link href={`/wahl/${id}/wahlvorstand/bekanntmachung`}>
            Bekanntmachung drucken
          </Link>
        </Button>
      </div>

      {liste.length > 0 && !prWaehlbar && (
        <p
          role="alert"
          className="border-l-4 border-l-destructive bg-card p-4 text-sm"
        >
          Dem Wahlvorstand muss mindestens ein Mitglied angehören, das nach § 9
          LPVG in den Personalrat wählbar ist (§ 54 Abs. 1 Nr. 3 LPVGWO). Bitte
          in der Liste kennzeichnen.
        </p>
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mitglieder und Ersatzmitglieder
            </CardTitle>
            <CardDescription>
              {liste.length
                ? "Erfasste Zusammensetzung."
                : "Vorschlag aus den Benutzerkonten – bitte prüfen und speichern."}{" "}
              Leere Zeilen werden ignoriert. Die Liste wird auch für
              Niederschriften und Unterschriftsfelder verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WahlvorstandForm
              electionId={id}
              liste={vorschlag}
              bestelltAm={a.wahlvorstandBestelltAm ?? null}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm">
            {liste.length === 0 ? (
              <p className="text-muted-foreground">
                Der Vorsitz hat den Wahlvorstand noch nicht erfasst.
              </p>
            ) : (
              <ul className="grid gap-1">
                {liste.map((m) => (
                  <li key={m.name}>
                    <strong>{m.name}</strong> – {FUNKTION_LABEL[m.funktion]}
                    {m.ersatz && ` · Ersatz: ${m.ersatz}`}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
