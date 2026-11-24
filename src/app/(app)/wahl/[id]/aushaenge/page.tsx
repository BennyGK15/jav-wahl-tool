import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { berechneAushaenge, zeitleistenBereich, type Aushang, type AushangStatus } from "@/lib/aushaenge";
import { fromDbDate, toBerlinLocal, todayBerlin } from "@/lib/dates";
import { parseIso, type IsoDate } from "@/lib/fristen";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn, formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { syncErledigt } from "@/server/auto-erledigt";

export const metadata = { title: "Aushänge" };

const STATUS: Record<AushangStatus, { label: string; variant: "default" | "outline" | "secondary" }> = {
  haengt: { label: "muss jetzt aushängen", variant: "default" },
  kommt: { label: "kommt noch", variant: "outline" },
  beendet: { label: "darf abgenommen werden", variant: "secondary" },
};

const kurz = (iso: IsoDate) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

function zeitraum(a: Aushang): string {
  const von = a.von ? `${a.vonText.includes("spätestens") ? "spätestens " : ""}${formatIsoDate(a.von)}` : a.vonText;
  const bis = a.bis ? formatIsoDate(a.bis) : a.bisText;
  return `${von} – ${bis}`;
}

export default async function AushaengePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const role = session.user.role;
  if (!hasPermission(role, "deadlines.read")) notFound();

  const { id } = await params;
  await syncErledigt(id);
  const election = await prisma.election.findUnique({
    where: { id },
    include: { deadlines: true, result: { select: { festgestelltAm: true } } },
  });
  if (!election) notFound();
  if (election.einrichtungOffen) redirect(hasPermission(role, "election.manage") ? `/wahl/${id}/einrichtung` : "/");

  const freigabe = await prisma.document.findFirst({
    where: { electionId: id, typ: "wahlausschreiben", freigegebenAm: { not: null } },
    select: { id: true },
  });
  const frist = new Map(election.deadlines.map((d) => [d.ruleKey, fromDbDate(d.datum)]));
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const heute = todayBerlin();
  const wahltag = fromDbDate(election.wahltag);
  const base = `/wahl/${id}`;

  const aushaenge = berechneAushaenge({
    verfahren: election.verfahren,
    heute,
    wahltag,
    wahlvorstandBestelltAm: a.wahlvorstandBestelltAm ?? null,
    wahlausschreibenAm: election.wahlausschreibenAm ? fromDbDate(election.wahlausschreibenAm) : (frist.get("wahlausschreiben") ?? null),
    wahlausschreibenErlassen: Boolean(election.wahlausschreibenAm),
    wahlausschreibenFreigegeben: Boolean(freigabe),
    auslageBeginn: frist.get("auslage_beginn") ?? null,
    auslageEnde: frist.get("auslage_ende") ?? null,
    bekanntmachungVorschlaege: frist.get("bekanntmachung_vorschlaege") ?? null,
    nachfristBekanntgemachtAm: election.nachfristBekanntgemachtAm ? fromDbDate(election.nachfristBekanntgemachtAm) : null,
    nachfristEnde: frist.get("nachfrist_ende") ?? null,
    wvEinladung: frist.get("wv_einladung") ?? null,
    ergebnisBekanntgabe: election.result?.festgestelltAm ? toBerlinLocal(election.result.festgestelltAm).slice(0, 10) : null,
    aushangErgebnisEnde: frist.get("aushang_ergebnis_ende") ?? null,
    bekanntmachungsort: a.bekanntmachungsort ?? null,
    auslageOrt: a.auslageOrt ?? null,
  });

  const jetzt = aushaenge.filter((x) => x.status === "haengt");
  const bereich = zeitleistenBereich(aushaenge, heute, wahltag);
  const start = parseIso(bereich.von);
  const spanne = Math.max(parseIso(bereich.bis) - start, 1);
  const pos = (iso: IsoDate) => ((parseIso(iso) - start) / spanne) * 100;
  // Einen Tag Breite einrechnen, damit „bis einschließlich“ sichtbar bis zum Ende des Tages reicht
  const tag = (86_400_000 / spanne) * 100;
  const ohneOrt = !a.bekanntmachungsort || (election.verfahren === "regulaer" && !a.auslageOrt);
  const ungeprueft = aushaenge.some((x) => !x.geprueft);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Aushänge und Auslagen</h1>
          <p className="max-w-3xl text-muted-foreground">
            Alle Dokumente, die während der Wahl in der Dienststelle aushängen oder zur Einsicht ausliegen müssen – mit Zeitraum, Ort
            und Rechtsgrundlage. Stand {formatIsoDate(heute)}.
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>

      <section aria-labelledby="jetzt" className="grid gap-3 rounded-sm border border-l-4 border-l-foreground bg-card p-5">
        <h2 id="jetzt" className="text-lg font-bold">
          {jetzt.length === 0 ? "Heute muss nichts aushängen" : `Heute ${jetzt.length === 1 ? "muss 1 Dokument" : `müssen ${jetzt.length} Dokumente`} aushängen oder ausliegen`}
        </h2>
        {jetzt.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {jetzt.map((x) => (
              <li key={x.key} className="flex flex-wrap gap-x-2">
                <span className="font-semibold">{x.titel}</span>
                <span className="text-muted-foreground">
                  {x.bis ? `bis einschließlich ${formatIsoDate(x.bis)}` : x.bisText}
                  {x.ort ? ` · ${x.ort}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(ohneOrt || ungeprueft) && (
        <ul role="note" className="grid gap-1 rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-4 text-sm text-foreground">
          {ohneOrt && (
            <li>
              Ort für Bekanntmachungen oder Auslage fehlt noch –{" "}
              <Link href={`${base}/wahlausschreiben`} className="underline">
                in den Angaben zum Wahlausschreiben eintragen
              </Link>
              .
            </li>
          )}
          {ungeprueft && <li>Mit „Zeitraum prüfen“ markierte Aushangdauern sind nicht gegen den amtlichen Text abgeglichen.</li>}
        </ul>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-6">
          <h2 className="text-lg font-bold">Zeitleiste</h2>
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatIsoDate(bereich.von)}</span>
            <span>{formatIsoDate(bereich.bis)}</span>
          </div>
          <div className="relative grid gap-2">
            <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-destructive" style={{ left: `${pos(heute)}%` }} title={`Heute, ${formatIsoDate(heute)}`} />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px border-l border-dashed border-foreground" style={{ left: `${pos(wahltag)}%` }} />
            {aushaenge.map((x) => {
              const offenerBeginn = !x.von;
              const offenesEnde = !x.bis;
              const von = x.von ? pos(x.von) : x.status === "haengt" ? 0 : null;
              const bis = x.bis ? Math.min(pos(x.bis) + tag, 100) : 100;
              return (
                <div key={x.key} className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-3">
                  <span className="text-sm font-semibold leading-tight">{x.titel}</span>
                  <div className="relative h-6 rounded-sm bg-muted/50">
                    {von === null ? (
                      <span className="absolute inset-0 flex items-center px-2 text-xs text-muted-foreground">{x.vonText}</span>
                    ) : (
                      <div
                        className={cn(
                          "absolute inset-y-0 flex items-center overflow-hidden rounded-sm px-2 text-xs font-semibold whitespace-nowrap",
                          x.status === "haengt" && "bg-brand-yellow text-brand-ink",
                          x.status === "kommt" && "border border-foreground bg-card text-foreground",
                          x.status === "beendet" && "bg-muted text-muted-foreground",
                          offenerBeginn && "rounded-l-none",
                          offenesEnde && "rounded-r-none",
                        )}
                        style={{ left: `${von}%`, width: `${Math.max(bis - von, 1)}%` }}
                        title={`${x.titel}: ${zeitraum(x)}`}
                      >
                        {x.von ? kurz(x.von) : "…"} – {x.bis ? kurz(x.bis) : "…"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-0.5 bg-destructive" /> heute
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-px border-l border-dashed border-foreground" />{" "}
              {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"} ({formatIsoDate(wahltag)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3 rounded-sm bg-brand-yellow" /> hängt jetzt
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3 rounded-sm border border-foreground" /> kommt noch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3 rounded-sm bg-muted" /> beendet
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Dokument</th>
                <th className="py-2 pr-4 font-medium">Zeitraum</th>
                <th className="py-2 pr-4 font-medium">Ort</th>
                <th className="py-2 pr-4 font-medium">Rechtsgrundlage</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {aushaenge.map((x) => {
                const darf = x.rechte.some((r) => hasPermission(role, r));
                return (
                  <tr key={x.key} className={cn("border-t align-top", x.status === "beendet" && "text-muted-foreground")}>
                    <td className="py-3 pr-4">
                      {darf ? (
                        <Link href={`${base}/${x.pfad}`} className="inline-flex items-center gap-1 font-semibold">
                          {x.titel} <ArrowRight aria-hidden className="size-3.5 print:hidden" />
                        </Link>
                      ) : (
                        <span className="font-semibold">{x.titel}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">{x.art === "auslage" ? "Auslage zur Einsicht" : "Aushang"}</span>
                      {x.hinweis && <span className="mt-1 block text-xs">{x.hinweis}</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="tabular-nums">{zeitraum(x)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {x.vonText} · {x.bisText}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{x.ort ?? <span className="text-muted-foreground">nicht angegeben</span>}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {x.rechtsgrundlage}
                      {!x.geprueft && (
                        <Badge variant="warning" className="ml-2">
                          Zeitraum prüfen
                        </Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant={STATUS[x.status].variant}>{STATUS[x.status].label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
