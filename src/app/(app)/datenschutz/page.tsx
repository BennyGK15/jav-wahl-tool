import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aufgabenStatus, DATENSCHUTZ_DOKUMENTE, DATENSCHUTZ_FELDER, LOESCHFRISTEN, type DatenschutzDokument } from "@/lib/datenschutz";
import { formatBerlinDateTime } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { loadAufgabenStand, loadDatenschutzAngaben } from "@/server/einstellungen";
import { toggleAufgabeAction } from "./actions";
import { DatenschutzForm } from "./datenschutz-form";

export const metadata = { title: "Datenschutz-Unterlagen" };

export default async function DatenschutzPage() {
  const session = await requireSession();
  const darfBearbeiten = hasPermission(session.user.role, "privacy.manage");
  const { angaben, geaendertAm } = await loadDatenschutzAngaben();
  const fehlend = DATENSCHUTZ_FELDER.filter((f) => !f.vorgabe && !angaben[f.key]);
  const aufgaben = aufgabenStatus(angaben, await loadAufgabenStand());
  const offen = aufgaben.filter((a) => !a.erledigt).length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Datenschutz-Unterlagen</h1>
        <p className="max-w-3xl text-muted-foreground">
          Unterlagen für die Dienststelle und die/den Datenschutzbeauftragte(n). Sie beschreiben, was das JAV-Wahl-Tool tatsächlich
          tut, und übernehmen die Angaben unten. Jedes Dokument lässt sich drucken oder im Druckdialog als PDF speichern. Keine
          Rechtsberatung – bitte vor dem Einsatz abstimmen.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(DATENSCHUTZ_DOKUMENTE) as DatenschutzDokument[]).map((k) => (
          <Link key={k} href={`/datenschutz/${k}`} className="group flex flex-col gap-3 rounded-sm border bg-card p-5 no-underline hover:border-foreground">
            <span aria-hidden className="flex size-9 items-center justify-center bg-brand-yellow text-brand-ink">
              <FileText className="size-5" />
            </span>
            <span className="text-lg leading-tight font-bold text-foreground">{DATENSCHUTZ_DOKUMENTE[k].titel}</span>
            <span className="text-sm text-muted-foreground">{DATENSCHUTZ_DOKUMENTE[k].grundlage}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-foreground">
              <ArrowRight aria-hidden className="size-4" /> Öffnen, drucken, als PDF speichern
            </span>
          </Link>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verantwortliche Stelle und Ansprechpersonen</CardTitle>
          <CardDescription>
            {fehlend.length
              ? `Noch offen: ${fehlend.map((f) => f.label).join(", ")} – in den Dokumenten rot markiert.`
              : "Alle Angaben sind ausgefüllt."}
            {geaendertAm && ` Zuletzt geändert am ${formatBerlinDateTime(geaendertAm)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {darfBearbeiten ? (
            <DatenschutzForm angaben={angaben} />
          ) : (
            <p className="text-sm text-muted-foreground">Bearbeiten können der Vorsitz des Wahlvorstands und die Administration.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Löschfristen</CardTitle>
          <CardDescription>
            Gesetzliche Vorgaben aus LPVG und LPVGWO; wo nichts geregelt ist, 30 Tage nach Abschluss der Wahl. Während einer laufenden
            Wahl wird nichts gelöscht.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Daten</th>
                <th className="py-2 pr-4 font-medium">Frist</th>
                <th className="py-2 pr-4 font-medium">Grundlage</th>
                <th className="py-2 font-medium">Umsetzung</th>
              </tr>
            </thead>
            <tbody>
              {LOESCHFRISTEN.map((l) => (
                <tr key={l.daten} className="border-t align-top">
                  <td className="py-2 pr-4 font-medium">{l.daten}</td>
                  <td className="py-2 pr-4">{l.frist}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{l.grundlage}</td>
                  <td className="py-2">{l.umsetzung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vor dem Einsatz zu erledigen</CardTitle>
          <CardDescription>
            {offen ? `${offen} von ${aufgaben.length} offen.` : "Alles erledigt."} In den Dokumenten erscheinen nur offene Aufgaben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {aufgaben.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-3">
                {a.automatisch || !darfBearbeiten ? (
                  <span
                    aria-hidden
                    className={`flex size-6 shrink-0 items-center justify-center rounded-sm border ${a.erledigt ? "border-foreground bg-foreground text-background" : "border-input"}`}
                  >
                    {a.erledigt && <Check className="size-4" />}
                  </span>
                ) : (
                  <form action={toggleAufgabeAction}>
                    <input type="hidden" name="aufgabe" value={a.key} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={a.erledigt ? "default" : "outline"}
                      className="size-6 p-0"
                      aria-label={a.erledigt ? `Wieder öffnen: ${a.text}` : `Als erledigt markieren: ${a.text}`}
                    >
                      {a.erledigt && <Check className="size-4" />}
                    </Button>
                  </form>
                )}
                <span className={a.erledigt ? "text-muted-foreground line-through" : undefined}>{a.text}</span>
                {a.automatisch && <span className="text-xs text-muted-foreground">(automatisch, sobald alle Angaben oben ausgefüllt sind)</span>}
                {a.erledigtAm && <span className="text-xs text-muted-foreground">erledigt am {formatBerlinDateTime(new Date(a.erledigtAm))}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
