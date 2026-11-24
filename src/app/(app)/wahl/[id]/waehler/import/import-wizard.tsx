"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IMPORT_FELDER, parseCsv, rateZuordnung, wandleZeilen, type ImportFeld, type Zuordnung } from "@/lib/csv-import";
import { importVotersAction, type ImportResult } from "./actions";

const selectClass = "h-9 w-full rounded-sm border border-input bg-card px-3 text-sm";
const leer: Zuordnung = { nachname: -1, vorname: -1, organisationseinheit: -1, funktion: -1, geburtsdatum: -1, inAusbildung: -1, ausbildungsende: -1, geschlecht: -1 };

export function ImportWizard({ electionId }: { electionId: string }) {
  const [dateiname, setDateiname] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1252">("utf-8");
  const [mitKopf, setMitKopf] = useState(true);
  const [zuordnung, setZuordnung] = useState<Zuordnung>(leer);
  const [ergebnis, setErgebnis] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => (buffer ? parseCsv(new TextDecoder(encoding).decode(buffer)) : []), [buffer, encoding]);
  const spalten = rows[0]?.map((h, i) => (mitKopf ? h || `Spalte ${i + 1}` : `Spalte ${i + 1} (z. B. „${h}“)`)) ?? [];
  const pflichtFehlt = IMPORT_FELDER.filter((f) => f.pflicht && zuordnung[f.key] < 0);
  const { zeilen, fehler } = useMemo(
    () => (rows.length && pflichtFehlt.length === 0 ? wandleZeilen(rows, zuordnung, mitKopf) : { zeilen: [], fehler: [] }),
    [rows, zuordnung, mitKopf, pflichtFehlt.length],
  );

  async function onFile(file: File | undefined) {
    setErgebnis(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErgebnis({ error: "Die Datei ist größer als 5 MB." });
      return;
    }
    const buf = await file.arrayBuffer();
    // Ungültiges UTF-8 deutet auf eine Excel-Datei in Windows-1252 hin
    let enc: "utf-8" | "windows-1252" = "utf-8";
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      enc = "windows-1252";
    }
    setEncoding(enc);
    setBuffer(buf);
    setDateiname(file.name);
    const first = parseCsv(new TextDecoder(enc).decode(buf))[0] ?? [];
    setZuordnung(rateZuordnung(first));
  }

  function importieren() {
    startTransition(async () => {
      setErgebnis(await importVotersAction(electionId, zeilen));
    });
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="font-semibold">1. Datei auswählen</h2>
        <p className="text-sm text-muted-foreground">
          CSV-Datei (in Excel: „Speichern unter“ → „CSV (Trennzeichen-getrennt)“). Die Datei wird nur in diesem Browser gelesen
          und nicht hochgeladen; übertragen werden ausschließlich die geprüften Zeilen.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          aria-label="CSV-Datei auswählen"
        />
        {dateiname && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              {dateiname} · {rows.length} Zeilen
            </span>
            <label className="flex items-center gap-2">
              Zeichensatz
              <select value={encoding} onChange={(e) => setEncoding(e.target.value as typeof encoding)} className="h-8 rounded-sm border border-input bg-card px-2">
                <option value="utf-8">UTF-8</option>
                <option value="windows-1252">Windows (Excel)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mitKopf} onChange={(e) => setMitKopf(e.target.checked)} />
              Erste Zeile enthält Spaltennamen
            </label>
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-semibold">2. Spalten zuordnen</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {IMPORT_FELDER.map((f) => (
              <div key={f.key} className="grid gap-1">
                <Label htmlFor={`map-${f.key}`}>
                  {f.label}
                  {f.pflicht && <span className="text-destructive"> *</span>}
                </Label>
                <select
                  id={`map-${f.key}`}
                  className={selectClass}
                  value={zuordnung[f.key]}
                  onChange={(e) => setZuordnung({ ...zuordnung, [f.key as ImportFeld]: Number(e.target.value) })}
                >
                  <option value={-1}>– nicht vorhanden –</option>
                  {spalten.map((s, i) => (
                    <option key={i} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {pflichtFehlt.length > 0 && <p className="text-sm text-destructive">Bitte zuordnen: {pflichtFehlt.map((f) => f.label).join(", ")}.</p>}
        </section>
      )}

      {rows.length > 0 && pflichtFehlt.length === 0 && (
        <section className="grid gap-3">
          <h2 className="font-semibold">3. Vorschau prüfen</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{zeilen.length} Zeilen bereit</Badge>
            {fehler.length > 0 && (
              <Badge variant="outline" className="border-destructive text-destructive">
                {fehler.length} Zeilen mit Fehlern
              </Badge>
            )}
          </div>
          {fehler.length > 0 && (
            <details className="text-sm" open={fehler.length <= 10}>
              <summary className="cursor-pointer">Fehlerhafte Zeilen (werden nicht importiert)</summary>
              <ul className="mt-2 grid gap-1">
                {fehler.slice(0, 200).map((f) => (
                  <li key={f.zeile}>
                    Zeile {f.zeile}: {f.fehler}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Name</th>
                  <th className="py-1 pr-3 font-medium">Geburtsdatum</th>
                  <th className="py-1 pr-3 font-medium">Ausbildung</th>
                  <th className="py-1 pr-3 font-medium">Funktion</th>
                  <th className="py-1 pr-3 font-medium">OE</th>
                  <th className="py-1 font-medium">G.</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.slice(0, 10).map((z, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-3">
                      {z.nachname}, {z.vorname}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{z.geburtsdatum.split("-").reverse().join(".")}</td>
                    <td className="py-1 pr-3">{z.inAusbildung ? `ja${z.ausbildungsende ? ` bis ${z.ausbildungsende.split("-").reverse().join(".")}` : ""}` : "nein"}</td>
                    <td className="py-1 pr-3">{z.funktion ?? "–"}</td>
                    <td className="py-1 pr-3">{z.organisationseinheit ?? "–"}</td>
                    <td className="py-1">{z.geschlecht ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {zeilen.length > 10 && <p className="mt-1 text-xs text-muted-foreground">… und {zeilen.length - 10} weitere</p>}
          </div>
          <p className="text-sm text-muted-foreground">
            Wahlberechtigung und Wählbarkeit werden beim Import zum Wahltag berechnet. Personen mit gleichem Namen und
            Geburtsdatum werden nicht doppelt angelegt.
          </p>
          <div>
            <Button onClick={importieren} disabled={pending || zeilen.length === 0}>
              {pending ? "Importiere …" : `${zeilen.length} Personen importieren`}
            </Button>
          </div>
        </section>
      )}

      {ergebnis?.error && (
        <p role="alert" className="text-sm text-destructive">
          {ergebnis.error}
        </p>
      )}
      {ergebnis && !ergebnis.error && (
        <div role="status" className="grid gap-2 rounded-md border p-4 text-sm">
          <p>
            <strong>{ergebnis.importiert}</strong> Personen importiert
            {ergebnis.dubletten ? `, ${ergebnis.dubletten} Dubletten übersprungen` : ""}.
          </p>
          <div>
            <Button asChild size="sm">
              <Link href={`/wahl/${electionId}/waehler?ansicht=alle`}>Zum Wählerverzeichnis</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
