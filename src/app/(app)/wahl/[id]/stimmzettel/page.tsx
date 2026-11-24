import { notFound } from "next/navigation";
import { DruckRahmen, Wert } from "@/components/druck-rahmen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeAudit } from "@/lib/audit";
import { fromDbDate } from "@/lib/dates";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { sitzeText } from "@/lib/geschlechter";
import { loadErgebnis, type BewerberInfo } from "@/server/ergebnis";
import { loadGeschlechter } from "@/server/geschlechter";

export const metadata = { title: "Stimmzettel" };

function Kreis() {
  return (
    <span
      aria-hidden
      className="inline-block size-6 shrink-0 rounded-full border-2 border-black"
    />
  );
}

/** Feld zum Ankreuzen oder Eintragen der Stimmenzahl (1–3) */
function StimmenFeld() {
  return (
    <span aria-hidden className="inline-block h-7 w-10 border-2 border-black" />
  );
}

function Kopf({
  dienststelle,
  wahltag,
  zusatz,
}: Readonly<{ dienststelle: string; wahltag: string; zusatz?: string }>) {
  return (
    <header className="text-center">
      <h1 className="text-lg font-bold">Stimmzettel</h1>
      <p>für die Wahl der Jugend- und Auszubildendenvertretung</p>
      <p>
        {dienststelle} · {wahltag}
      </p>
      {zusatz && <p className="mt-2 text-base font-bold">{zusatz}</p>}
    </header>
  );
}

function Hinweise({ punkte }: Readonly<{ punkte: React.ReactNode[] }>) {
  return (
    <ol className="list-decimal space-y-0.5 border border-black p-3 pl-7 text-[9pt] leading-snug">
      {punkte.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ol>
  );
}

const funktion = (b: BewerberInfo) =>
  b.funktion ?? b.organisationseinheit ?? "";

export default async function StimmzettelPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anzahl?: string }>;
}>) {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "nominations.edit") &&
    !hasPermission(session.user.role, "voters.edit")
  )
    notFound();
  const { id } = await params;
  const d = await loadErgebnis(id).catch(() => null);
  if (!d) notFound();
  const anzahl = Math.min(
    500,
    Math.max(1, Number.parseInt((await searchParams).anzahl ?? "1", 10) || 1),
  );
  await writeAudit({
    userId: session.user.id,
    action: "ballots.printed",
    objectType: "election",
    objectId: id,
    fields: [`anzahl:${anzahl}`],
  });

  const wahltag = formatIsoDate(fromDbDate(d.election.wahltag));
  const dienststelle = d.election.dienststelle;
  const listenName = (i: number) => {
    const n = d.nominations[i]!;
    return `Wahlvorschlag Nr. ${n.ordnungsnummer ?? i + 1}${n.kennwort ? ` – „${n.kennwort}“` : ""}`;
  };
  const stimmenText = `${d.sitze} ${d.sitze === 1 ? "Stimme" : "Stimmen"}`;
  // § 34 Abs. 2 Nr. 6 / § 41 Abs. 3 Nr. 5 LPVGWO: Angabe zu Frauen und Männern ab drei Mitgliedern (§ 8 LPVGWO)
  const geschlechter = await loadGeschlechter(id);
  const sitzeFM =
    geschlechter.verteilung && !geschlechter.verteilung.losOffen
      ? sitzeText(geschlechter.verteilung)
      : null;
  const geschlechterHinweis = geschlechter.relevant && (
    <>
      In der Jugend- und Auszubildendenvertretung sollen{" "}
      <Wert v={sitzeFM} l="Sitze Frauen/Männer nach § 8 LPVGWO" /> vertreten
      sein; Sie sind aber nicht verpflichtet, eine bestimmte Zahl von Stimmen an
      Frauen oder Männer zu vergeben.
    </>
  );

  /** Ein Satz Stimmzettel für eine wählende Person (bei Verhältniswahl ein Einzelstimmzettel je Wahlvorschlag) */
  let satz: React.ReactNode[];
  if (d.wahlverfahren === "verhaeltnis") {
    // § 34 LPVGWO
    const hinweise = [
      "Geben Sie nur einen Stimmzettel ab.",
      <>
        Sie haben insgesamt <strong>{stimmenText}</strong>.
      </>,
      "Kennzeichnen Sie die Personen, die Sie wählen, durch ein Kreuz oder durch eine Zahl im Feld neben dem Namen.",
      "Sie können Personen aus anderen Wahlvorschlägen in die freien Zeilen übernehmen (panaschieren).",
      "Sie können einer Person durch Eintragen einer Zahl bis zu drei Stimmen geben (kumulieren) – insgesamt höchstens so viele Stimmen, wie Sie haben.",
      ...(geschlechterHinweis ? [geschlechterHinweis] : []),
      "Personen, die auf keinem Wahlvorschlag stehen, können nicht gewählt werden.",
    ];
    satz = d.nominations.map((n, i) => {
      const bewerber = n.candidates
        .map((c) => d.bewerber.get(c.id)!)
        .filter(Boolean);
      return (
        <article
          key={n.id}
          className="grid gap-4 border-2 border-black p-6 text-sm"
        >
          <Kopf
            dienststelle={dienststelle}
            wahltag={wahltag}
            zusatz={listenName(i)}
          />
          <Hinweise punkte={hinweise} />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 border-b-2 border-black py-1 text-left">
                  Nr.
                </th>
                <th className="border-b-2 border-black py-1 text-left">
                  Name, Vorname
                </th>
                <th className="border-b-2 border-black py-1 text-left">
                  Amts- oder Funktionsbezeichnung
                </th>
                <th className="w-16 border-b-2 border-black py-1 text-center">
                  Stimmen
                </th>
              </tr>
            </thead>
            <tbody>
              {bewerber.map((b) => (
                <tr key={b.candidateId} className="border-b border-black">
                  <td className="py-2 tabular-nums">{b.listenplatz}</td>
                  <td className="py-2 font-semibold">
                    {b.nachname}, {b.vorname}
                  </td>
                  <td className="py-2">{funktion(b)}</td>
                  <td className="py-2 text-center">
                    <StimmenFeld />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-[9pt] font-semibold">
                  Übernommene Personen aus anderen Wahlvorschlägen (Name,
                  Vorname, Wahlvorschlag Nr.):
                </td>
              </tr>
              {Array.from({ length: d.sitze }, (_, k) => (
                <tr key={`frei-${k}`} className="border-b border-black">
                  <td className="py-3" />
                  <td className="py-3" colSpan={2} />
                  <td className="py-2 text-center">
                    <StimmenFeld />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      );
    });
  } else if (d.wahlverfahren === "mehrheit") {
    // § 41 LPVGWO: ein Vorschlag → unveränderte Reihenfolge; eine Person aus mehreren Vorschlägen → alphabetisch
    const mehrereVorschlaege = d.nominations.length > 1;
    const liste = [...d.bewerber.values()];
    if (mehrereVorschlaege)
      liste.sort(
        (a, b) =>
          a.nachname.localeCompare(b.nachname, "de") ||
          a.vorname.localeCompare(b.vorname, "de"),
      );
    const hinweise = [
      "Geben Sie nur einen Stimmzettel ab.",
      <>
        Sie haben{" "}
        <strong>
          {d.sitze === 1 ? "eine Stimme" : `bis zu ${stimmenText}`}
        </strong>
        .
      </>,
      d.sitze === 1 && mehrereVorschlaege
        ? "Kreuzen Sie nur eine Person an – mehr Kreuze machen den Stimmzettel ungültig (§ 42 Abs. 1 LPVGWO)."
        : "Jeder Person kann nur eine Stimme gegeben werden.",
      "Kennzeichnen Sie die Personen, die Sie wählen, durch ein Kreuz im Kreis neben dem Namen.",
      ...(geschlechterHinweis ? [geschlechterHinweis] : []),
      "Personen, die auf keinem Wahlvorschlag stehen, können nicht gewählt werden.",
    ];
    satz = [
      <article
        key="mehrheit"
        className="grid gap-4 border-2 border-black p-6 text-sm"
      >
        <Kopf
          dienststelle={dienststelle}
          wahltag={wahltag}
          zusatz={
            !mehrereVorschlaege &&
            d.nominations[0] &&
            d.election.verfahren === "regulaer"
              ? listenName(0)
              : undefined
          }
        />
        <Hinweise punkte={hinweise} />
        <ul className="grid gap-3">
          {liste.map((b) => (
            <li
              key={b.candidateId}
              className="flex items-center gap-4 border-t border-black pt-2"
            >
              <Kreis />
              <span>
                <span className="font-semibold">
                  {b.nachname}, {b.vorname}
                </span>
                {funktion(b) && (
                  <span className="block text-[9pt]">{funktion(b)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </article>,
    ];
  } else {
    satz = [
      <p key="leer" className="text-sm">
        Es liegen keine gültigen Wahlvorschläge vor.
      </p>,
    ];
  }

  const seiten = Array.from({ length: anzahl }, () => satz).flat();

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}`, label: "Wahlkalender" }}
      titel="Stimmzettel"
      entwurf={false}
      hinweis={
        <div className="grid gap-2">
          <p>
            {d.wahlverfahren === "verhaeltnis"
              ? `Verhältniswahl: Je wählende Person ein Satz aus ${d.nominations.length} Einzelstimmzetteln – einer je Wahlvorschlag (§ 34 Abs. 1 LPVGWO). Jeder Einzelstimmzettel wird auf eine eigene Seite gedruckt.`
              : "Mehrheitswahl: ein Stimmzettel je wählender Person (§ 41 LPVGWO), jeder auf einer eigenen Seite."}{" "}
            Ist für eine Person keine Amts- oder Funktionsbezeichnung erfasst,
            steht dort ersatzweise die Organisationseinheit.
            {geschlechter.relevant &&
              !sitzeFM &&
              " Die Zahl der Sitze für Frauen und Männer (§ 8 LPVGWO) steht noch nicht fest (Wählerverzeichnis bzw. Losentscheid auf der Seite Wahlausschreiben) und ist rot markiert."}
          </p>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 font-medium">
              Anzahl Sätze
              <Input
                name="anzahl"
                type="number"
                min={1}
                max={500}
                defaultValue={anzahl}
                className="w-28"
              />
            </label>
            <Button type="submit" size="sm" variant="outline">
              Übernehmen
            </Button>
            <span className="text-muted-foreground">
              Wahlberechtigte: {d.wahlberechtigte}
            </span>
          </form>
        </div>
      }
    >
      {seiten.map((s, i) => (
        <div
          key={i}
          className={
            i < seiten.length - 1 ? "mb-8 break-after-page print:mb-0" : ""
          }
        >
          {s}
        </div>
      ))}
    </DruckRahmen>
  );
}
