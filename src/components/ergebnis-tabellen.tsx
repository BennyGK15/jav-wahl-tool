import type { ErgebnisDaten } from "@/server/ergebnis";
import { gewaehlteUndErsatz } from "@/server/ergebnis";

/** Ergebnisdarstellung für Seite und Druckdokumente (Server-Komponente). */
export function ErgebnisTabellen({ d, mitHoechstzahlen = false }: { d: ErgebnisDaten; mitHoechstzahlen?: boolean }) {
  const name = (id: string) => d.bewerber.get(id)?.name ?? "?";
  const listenName = (id: string) => {
    const i = d.nominations.findIndex((n) => n.id === id);
    const n = d.nominations[i];
    return n ? `Wahlvorschlag ${n.ordnungsnummer ?? i + 1}${n.kennwort ? ` „${n.kennwort}“` : ""}` : "?";
  };
  const { gewaehlt, ersatz } = gewaehlteUndErsatz(d);

  return (
    <div className="grid gap-6 text-sm">
      {d.verhaeltnis && (
        <>
          <section className="break-inside-avoid">
            <h3 className="mb-2 font-semibold">Stimmen und Sitze je Wahlvorschlag (Verhältniswahl, d&apos;Hondt, § 38 LPVGWO)</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-4">Wahlvorschlag</th>
                  <th className="py-1 pr-4 text-right">Stimmen</th>
                  <th className="py-1 text-right">Sitze</th>
                </tr>
              </thead>
              <tbody>
                {d.nominations.map((n) => (
                  <tr key={n.id} className="border-b">
                    <td className="py-1 pr-4">{listenName(n.id)}</td>
                    <td className="py-1 pr-4 text-right tabular-nums">{d.stimmenJeVorschlag.get(n.id) ?? 0}</td>
                    <td className="py-1 text-right tabular-nums">{d.verhaeltnis!.sitzeJeListe[n.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">Stimmen je Bewerberin/Bewerber</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-4">Wahlvorschlag</th>
                  <th className="py-1 pr-4">Platz</th>
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4 text-right">Stimmen</th>
                  <th className="py-1">Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {[...d.bewerber.values()].map((b) => (
                  <tr key={b.candidateId} className="border-b">
                    <td className="py-1 pr-4">{listenName(b.nominationId)}</td>
                    <td className="py-1 pr-4 tabular-nums">{b.listenplatz}</td>
                    <td className="py-1 pr-4">
                      {b.nachname}, {b.vorname}
                    </td>
                    <td className="py-1 pr-4 text-right tabular-nums">{d.stimmenJeBewerber.get(b.candidateId) ?? 0}</td>
                    <td className="py-1">
                      {gewaehlt.includes(b.candidateId) ? "gewählt" : ersatz.includes(b.candidateId) ? "Ersatzmitglied" : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted-foreground print:text-black">
              Innerhalb eines Wahlvorschlags erhalten die Personen mit den meisten Stimmen die Sitze, bei Gleichstand entscheidet
              die Reihenfolge im Wahlvorschlag (§ 37 Abs. 2 LPVGWO).
            </p>
          </section>
          {mitHoechstzahlen && (
            <section className="break-inside-avoid">
              <h3 className="mb-2 font-semibold">Höchstzahlen</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-4">Wahlvorschlag</th>
                    <th className="py-1 pr-4 text-right">Teiler</th>
                    <th className="py-1 pr-4 text-right">Höchstzahl</th>
                    <th className="py-1 text-right">Sitz</th>
                  </tr>
                </thead>
                <tbody>
                  {d.verhaeltnis.hoechstzahlen.slice(0, d.sitze + 3).map((h) => (
                    <tr key={`${h.listeId}-${h.teiler}`} className="border-b">
                      <td className="py-1 pr-4">{listenName(h.listeId)}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{h.teiler}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{(h.stimmen / h.teiler).toLocaleString("de-DE", { maximumFractionDigits: 3 })}</td>
                      <td className="py-1 text-right tabular-nums">{h.sitz ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {d.mehrheit && (
        <section className="break-inside-avoid">
          <h3 className="mb-2 font-semibold">Stimmen je Bewerberin/Bewerber (Mehrheitswahl)</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4 text-right">Stimmen</th>
                <th className="py-1">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {[...d.bewerber.values()]
                .sort((a, b) => (d.stimmenJeBewerber.get(b.candidateId) ?? 0) - (d.stimmenJeBewerber.get(a.candidateId) ?? 0))
                .map((b) => (
                  <tr key={b.candidateId} className="border-b">
                    <td className="py-1 pr-4">{b.nachname}, {b.vorname}</td>
                    <td className="py-1 pr-4 text-right tabular-nums">{d.stimmenJeBewerber.get(b.candidateId) ?? 0}</td>
                    <td className="py-1">
                      {gewaehlt.includes(b.candidateId) ? "gewählt" : ersatz.includes(b.candidateId) ? "Ersatzmitglied" : "–"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="break-inside-avoid">
        <h3 className="mb-2 font-semibold">Gewählte Mitglieder der JAV</h3>
        {gewaehlt.length === 0 ? (
          <p>–</p>
        ) : (
          <ol className="list-decimal pl-6">
            {gewaehlt.map((id) => (
              <li key={id}>
                {name(id)}
                {d.verhaeltnis && <span className="text-muted-foreground print:text-black"> ({listenName(d.bewerber.get(id)!.nominationId)})</span>}
              </li>
            ))}
          </ol>
        )}
        {(d.verhaeltnis?.unbesetzt ?? d.mehrheit?.unbesetzt ?? 0) > 0 && (
          <p className="mt-1 text-destructive">{d.verhaeltnis?.unbesetzt ?? d.mehrheit?.unbesetzt} Sitz(e) konnten nicht besetzt werden.</p>
        )}
      </section>

      <section className="break-inside-avoid">
        <h3 className="mb-2 font-semibold">Ersatzmitglieder (in Reihenfolge)</h3>
        {ersatz.length === 0 ? (
          <p>–</p>
        ) : d.verhaeltnis ? (
          d.nominations.map((n) =>
            (d.verhaeltnis!.ersatzJeListe[n.id] ?? []).length ? (
              <div key={n.id} className="mb-2">
                <p className="font-medium">{listenName(n.id)}</p>
                <ol className="list-decimal pl-6">
                  {d.verhaeltnis!.ersatzJeListe[n.id]!.map((id) => (
                    <li key={id}>
                      {name(id)} ({d.stimmenJeBewerber.get(id) ?? 0} Stimmen)
                    </li>
                  ))}
                </ol>
              </div>
            ) : null,
          )
        ) : (
          <ol className="list-decimal pl-6">
            {ersatz.map((id) => (
              <li key={id}>
                {name(id)} ({d.stimmenJeBewerber.get(id) ?? 0} Stimmen)
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
