import Link from "next/link";
import { ArrowRight, Archive, CalendarDays, Calculator, Check, Clock, ListChecks, ScrollText, UserCog } from "lucide-react";
import { Tile } from "@/components/tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { darfSeite, fristText, gesperrtHinweis, seiteHref } from "@/lib/ablauf";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { cn, formatIsoDate } from "@/lib/utils";
import { loadAblauf } from "@/server/ablauf";
import { loadEinrichtung } from "@/server/einrichtung";
import { getActiveElection } from "@/server/elections";
import { toggleDeadlineDone } from "./wahl/[id]/actions";

const STATUS = { vorbereitung: "in Vorbereitung", eingeleitet: "eingeleitet", wahl: "Ergebnis festgestellt", abgeschlossen: "abgeschlossen" } as const;

export default async function Dashboard() {
  const session = await requireSession();
  const role = session.user.role;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(role, p);
  const election = can("deadlines.read") ? await getActiveElection() : null;
  const today = todayBerlin();

  const einrichtung = election?.einrichtungOffen ? election : null;
  const ablauf = election && !einrichtung ? await loadAblauf(election) : null;
  const einrichtungsStand = einrichtung ? await loadEinrichtung(einrichtung) : null;
  const personen = election ? await prisma.voter.count({ where: { electionId: election.id, wahlberechtigt: true } }) : 0;
  const loeschfaellig = can("retention.execute")
    ? await prisma.election.count({ where: { retentionUntil: { lte: new Date(`${today}T00:00:00.000Z`) } } })
    : 0;

  const name = session.user.name || session.user.displayUsername || session.user.username;
  const base = election ? `/wahl/${election.id}` : "";
  const jetzt = ablauf?.jetzt ?? null;
  const danach = ablauf ? ablauf.schritte.filter((s) => !s.erledigt && s !== jetzt).slice(0, 4) : [];
  const erledigt = ablauf ? ablauf.schritte.filter((s) => s.erledigt).length : 0;
  const href = (pfad: string) => (pfad ? seiteHref(base, pfad) : base);
  const phaseLabel = (key: string) => ablauf?.phasen.find((p) => p.key === key)?.label ?? "";
  const jetztFrist = jetzt ? fristText(today, jetzt.datum) : null;

  return (
    <div className="grid gap-10">
      <section>
        <p className="text-sm font-semibold text-muted-foreground">{formatIsoDate(today)}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Guten Tag, {name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Hier organisiert der Wahlvorstand die Wahl der Jugend- und Auszubildendenvertretung – von den Fristen bis zur
          Bekanntmachung des Ergebnisses.
        </p>
      </section>

      {loeschfaellig > 0 && (
        <p role="alert" className="border-l-4 border-l-foreground bg-highlight p-4 text-sm">
          Bei {loeschfaellig} {loeschfaellig === 1 ? "Wahl ist" : "Wahlen ist"} die Aufbewahrungsfrist abgelaufen.{" "}
          <Link href="/aufbewahrung" className="font-semibold underline">
            Daten jetzt löschen
          </Link>
        </p>
      )}

      {election && can("voters.markVoted") && !can("voters.edit") && (
        <section className="grid gap-4 rounded-sm border-2 border-foreground bg-card p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-2xl">Wahltag am {formatIsoDate(fromDbDate(election.wahltag))}</h2>
            <p className="mt-1 text-muted-foreground">
              Am Wahltisch: Person suchen, Stimmabgabe bestätigen – fertig. Die Ansicht ist für Tablets gemacht.
            </p>
          </div>
          <Button asChild size="lg" variant="accent">
            <Link href={`/urne/${election.id}`}>
              Wahltag-Ansicht öffnen <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      )}

      {einrichtung && einrichtungsStand ? (
        <section aria-labelledby="einrichtung-titel" className="grid overflow-hidden rounded-sm border bg-card lg:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-4 border-l-[6px] border-l-brand-yellow p-6 sm:p-8">
            <p className="text-sm text-muted-foreground">
              {einrichtung.dienststelle} · {einrichtung.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"}{" "}
              {formatIsoDate(fromDbDate(einrichtung.wahltag))}
            </p>
            <h2 id="einrichtung-titel" className="text-2xl leading-tight font-bold sm:text-3xl">
              Wahl einrichten
            </h2>
            {can("election.manage") ? (
              <>
                <p className="max-w-2xl text-muted-foreground">
                  Bevor es losgeht, werden einmal alle Angaben erfasst, die im Lauf der Wahl gebraucht werden. Danach schaltet die
                  Anwendung den Wahlkalender und die Phasen frei.
                </p>
                <div>
                  <Button asChild size="lg" variant="accent">
                    <Link href={`${base}/einrichtung`}>
                      Einrichtung fortsetzen <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="max-w-2xl text-muted-foreground">
                Der Vorsitz des Wahlvorstands richtet die Wahl gerade ein. Sobald das erledigt ist, erscheinen hier die anstehenden
                Aufgaben.
              </p>
            )}
          </div>
          <div className="border-t bg-secondary/50 p-6 sm:p-8 lg:border-t-0 lg:border-l">
            <h3 className="mb-3 text-base">Schritte</h3>
            <ol className="grid gap-2 text-sm">
              {einrichtungsStand.schritte.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs",
                      s.erledigt ? "bg-foreground text-background" : "border border-muted-foreground/60",
                    )}
                  >
                    {s.erledigt && <Check className="size-3" />}
                  </span>
                  <span className={s.erledigt ? "text-muted-foreground" : "font-semibold"}>{s.titel}</span>
                  <span className="sr-only">{s.erledigt ? "erledigt" : "offen"}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : election && ablauf ? (
        <>
          <section aria-labelledby="jetzt-titel" className="grid overflow-hidden rounded-sm border bg-card lg:grid-cols-[1.4fr_1fr]">
            <div className="grid content-start gap-4 border-l-[6px] border-l-brand-yellow p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{STATUS[election.status]}</Badge>
                <span className="text-muted-foreground">
                  {election.dienststelle} · {election.verfahren === "wahlversammlung" ? "Wahlversammlung" : "Wahltag"}{" "}
                  {formatIsoDate(fromDbDate(election.wahltag))} · {personen || election.wahlberechtigteSchaetzung} Wahlberechtigte
                  {!personen && " (Schätzung)"}
                </span>
              </div>
              <h2 id="jetzt-titel" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                Jetzt zu tun
              </h2>
              {jetzt && jetztFrist ? (
                <>
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold text-muted-foreground">Phase {phaseLabel(jetzt.phase)}</p>
                    <p className="text-2xl leading-tight font-bold sm:text-3xl">{jetzt.aufgabe}</p>
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-sm font-bold",
                          jetztFrist.ton === "ueberfaellig" ? "bg-destructive text-white" : "bg-brand-yellow text-brand-ink",
                        )}
                      >
                        {jetztFrist.text}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {jetzt.termin}: {formatIsoDate(jetzt.datum)}
                        {jetzt.uhrzeit && `, ${jetzt.uhrzeit} Uhr`}
                      </span>
                    </p>
                    {jetzt.automatisch ? (
                      <p className="text-sm text-muted-foreground">Wird automatisch abgehakt, {jetzt.automatisch}.</p>
                    ) : (
                      jetztFrist.ton === "ueberfaellig" &&
                      jetzt.id && (
                        <p className="text-sm text-muted-foreground">
                          Schon erledigt? Dann bitte abhaken – sonst bleibt dieser Schritt hier stehen.
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="lg" variant="accent">
                      <Link href={href(jetzt.pfad)}>
                        Jetzt erledigen <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    {jetzt.id && can("deadlines.edit") && (
                      <form action={toggleDeadlineDone}>
                        <input type="hidden" name="deadlineId" value={jetzt.id} />
                        <Button type="submit" size="lg" variant="outline">
                          <Check aria-hidden /> Als erledigt markieren
                        </Button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xl font-bold">Alle Schritte sind erledigt.</p>
              )}
            </div>
            <div className="border-t bg-secondary/50 p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <h2 className="mb-3 text-base">Danach</h2>
              {danach.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine weiteren offenen Schritte.</p>
              ) : (
                <ol className="grid gap-3">
                  {danach.map((n) => {
                    const f = fristText(today, n.datum);
                    return (
                      <li key={n.key} className="grid grid-cols-[auto_1fr] items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 min-w-24 px-2 py-0.5 text-center text-xs font-bold tabular-nums",
                            f.ton === "ueberfaellig" ? "bg-destructive text-white" : "bg-card text-foreground ring-1 ring-border",
                          )}
                        >
                          {formatIsoDate(n.datum).replace(/^\w+\.,\s*/, "")}
                        </span>
                        <span className="text-sm">
                          <Link href={href(n.pfad)} className="font-semibold">
                            {n.aufgabe}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{f.text}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="mt-4 text-sm">
                <Link href={base} className="font-semibold">
                  Alle {ablauf.schritte.length} Termine im Wahlkalender
                </Link>{" "}
                <span className="text-muted-foreground">· {erledigt} erledigt</span>
              </p>
            </div>
          </section>

          <section aria-labelledby="ablauf-titel">
            <h2 id="ablauf-titel" className="mb-4 text-2xl">
              Ablauf der Wahl
            </h2>
            <ol className={cn("grid gap-3 sm:grid-cols-2", ablauf.phasen.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
              {ablauf.phasen.map((p, i) => {
                const seiten = p.seiten.filter((s) => darfSeite(role, s));
                return (
                  <li
                    key={p.key}
                    className={cn(
                      "flex flex-col gap-3 rounded-sm border bg-card p-5",
                      p.status === "aktuell" && "border-foreground border-t-[6px] border-t-brand-yellow",
                      p.status === "erledigt" && "opacity-75",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-sm font-bold",
                          p.status === "erledigt" && "bg-foreground text-background",
                          p.status === "aktuell" && "bg-brand-yellow text-brand-ink ring-2 ring-brand-ink",
                          p.status === "offen" && "border border-muted-foreground/60 text-muted-foreground",
                        )}
                      >
                        {p.status === "erledigt" ? <Check className="size-4" /> : i + 1}
                      </span>
                      <h3 className="text-lg leading-tight font-bold">{p.label}</h3>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {p.status === "erledigt"
                        ? "erledigt"
                        : p.status === "aktuell"
                          ? `aktuelle Phase · ${p.offen} offen`
                          : p.offen > 0
                            ? `${p.offen} ${p.offen === 1 ? "Schritt" : "Schritte"}`
                            : "noch nicht dran"}
                    </p>
                    <p className="text-sm text-muted-foreground">{p.kurz}</p>
                    {seiten.length > 0 && (
                      <ul className="mt-auto grid gap-1 pt-2 text-sm">
                        {seiten.map((s) => {
                          const gesperrt = gesperrtHinweis(s, ablauf.verfuegbar);
                          return (
                            <li key={s.pfad}>
                              {gesperrt ? (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <Clock aria-hidden className="size-3.5" />
                                  {s.label} <span className="text-xs">({gesperrt})</span>
                                </span>
                              ) : (
                                <Link href={seiteHref(base, s.pfad)} className="inline-flex items-center gap-1.5 font-semibold no-underline hover:underline">
                                  <ArrowRight aria-hidden className="size-3.5" />
                                  {s.label}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      ) : can("deadlines.read") ? (
        <section className="grid gap-4 rounded-sm border bg-card p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-2xl">Noch keine Wahl angelegt</h2>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Ein Assistent führt durch alles, was vor dem Start feststehen muss: Grunddaten und Wahlberechtigte, Wahlvorstand,
              Orte und Zeiten, Stützunterschriften und – beim ersten Mal – die Angaben zum Datenschutz.
            </p>
          </div>
          {can("election.manage") ? (
            <Button asChild size="lg" variant="accent">
              <Link href="/wahl/neu">
                Wahl einrichten <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Der Vorsitz des Wahlvorstands legt die Wahl an.</p>
          )}
        </section>
      ) : null}

      {(can("users.manage") || can("audit.read")) && (
        <section>
          <h2 className="mb-4 text-2xl">Verwaltung</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {can("users.manage") && <Tile href="/benutzer" icon={UserCog} title="Benutzer" text="Konten anlegen, Rollen vergeben, Passwörter zurücksetzen, sperren." />}
            {can("audit.read") && <Tile href="/audit" icon={ScrollText} title="Audit-Log" text="Nachvollziehen, wer wann was geändert hat." />}
            {can("retention.execute") && !election && <Tile href="/aufbewahrung" icon={Archive} title="Aufbewahrung" text="Wahlen abschließen und Daten fristgerecht löschen." />}
          </div>
        </section>
      )}

      {election && !einrichtung && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <Tile href={base} icon={CalendarDays} title="Wahlkalender" text="Alle Termine mit Uhrzeit, Erledigt-Status und Warnungen." />
          <Tile href={`${base}/checklisten`} icon={ListChecks} title="Checklisten" text="Schritte aus der Arbeitsunterlage abhaken." />
          <Tile href="/fristen" icon={Calculator} title="Fristenrechner" text="Unverbindliche Vorschau für beliebige Wahltage." />
        </section>
      )}
    </div>
  );
}
