import type { ReactNode } from "react";
import type { WahlausschreibenView } from "@/server/wahlausschreiben";

/** Platzhalter für fehlende Angaben – auch im Ausdruck sichtbar, damit nichts Unvollständiges aushängt. */
function V({ value, label }: { value: string | number | null; label: string }) {
  if (value == null || value === "") {
    return (
      <span className="rounded bg-destructive/10 px-1 font-medium text-destructive">
        [fehlt: {label}]
      </span>
    );
  }
  return <strong>{value}</strong>;
}

function Abschnitt({
  nr,
  titel,
  children,
}: {
  nr: number;
  titel: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-semibold">
        {nr}. {titel}
      </h2>
      <div className="mt-1 grid gap-2">{children}</div>
    </section>
  );
}

/**
 * Muster eines Wahlausschreibens für die JAV-Wahl (reguläres Verfahren).
 * Grundlage: Arbeitsunterlage der Vorrecherche. Vor dem Aushang gegen alle
 * Pflichtangaben des § 9 LPVGWO in der geltenden Fassung prüfen.
 */
export function WahlausschreibenDokument({ v }: { v: WahlausschreibenView }) {
  let nr = 0;
  return (
    <article className="grid gap-5 text-sm leading-relaxed">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-wide">WAHLAUSSCHREIBEN</h1>
        <p>zur Wahl der Jugend- und Auszubildendenvertretung</p>
        <p className="mt-1">
          Dienststelle: <strong>{v.dienststelle}</strong>
        </p>
      </header>

      <p>
        Der Wahlvorstand leitet hiermit die Wahl der Jugend- und
        Auszubildendenvertretung ein. Mit dem Erlass dieses Wahlausschreibens
        ist die Wahl eingeleitet.
      </p>

      <Abschnitt nr={++nr} titel="Zahl der zu wählenden Mitglieder">
        <p>
          Es sind <V value={v.mitglieder} label="Mitgliederzahl" />{" "}
          {v.mitglieder === 1 ? "Mitglied" : "Mitglieder"} der Jugend- und
          Auszubildendenvertretung zu wählen (§ 61 LPVG BW). Die Wahl wird als
          gemeinsame Wahl durchgeführt.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Ort und Zeit der Stimmabgabe">
        <p>
          Die Wahl findet statt am <V value={v.wahltag} label="Wahltag" />, in
          der Zeit von <V value={v.wahlzeit} label="Wahlzeit" />, im Wahlraum{" "}
          <V value={v.wahlraum} label="Wahlraum" />.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Wahlberechtigung">
        <p>
          Wahlberechtigt sind alle Beschäftigten, die am Wahltag das 18.
          Lebensjahr noch nicht vollendet haben, sowie die Beschäftigten, die
          sich in einer beruflichen Ausbildung befinden, unabhängig vom Alter (§
          60 Abs. 1 LPVG BW). Wählen kann nur, wer in das Wählerverzeichnis
          eingetragen ist.
        </p>
        <p>
          Wählbar sind Beschäftigte, die am Wahltag das 26. Lebensjahr noch
          nicht vollendet haben, sowie Beschäftigte in beruflicher Ausbildung (§
          60 Abs. 2 LPVG BW).
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Wählerverzeichnis und Einsprüche">
        <p>
          Das Wählerverzeichnis liegt vom{" "}
          <V value={v.auslageVon} label="Beginn der Auslage" /> bis
          einschließlich <V value={v.auslageBis} label="Ende der Auslage" /> zur
          Einsicht aus: <V value={v.auslageOrt} label="Ort der Auslage" />,{" "}
          <V value={v.auslageZeiten} label="Zeiten der Einsichtnahme" />.
        </p>
        <p>
          Einsprüche gegen die Richtigkeit des Wählerverzeichnisses können nur
          innerhalb der Auslegungsfrist schriftlich beim Wahlvorstand eingelegt
          werden, spätestens bis{" "}
          <V value={v.einspruchBis} label="Ende der Einspruchsfrist" />.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Wahlvorschläge">
        <p>
          Die wahlberechtigten Beschäftigten und die in der Dienststelle
          vertretenen Gewerkschaften können Wahlvorschläge machen. Die
          Wahlvorschläge sind innerhalb von zwölf Arbeitstagen nach Erlass
          dieses Wahlausschreibens beim Wahlvorstand einzureichen, also
          spätestens bis{" "}
          <V value={v.vorschlaegeBis} label="Ende der Einreichungsfrist" />,
          bei: <V value={v.einreichungsstelle} label="Einreichungsstelle" />.
        </p>
        <p>
          Wahlvorschläge der Beschäftigten müssen von mindestens{" "}
          <V
            value={v.mindestUnterschriften}
            label="Mindestzahl der Unterschriften"
          />{" "}
          wahlberechtigten Beschäftigten unterzeichnet sein. Jede
          wahlberechtigte Person kann ihre Unterschrift zur Wahl nur für einen
          Wahlvorschlag abgeben. Jede vorgeschlagene Person muss ihrer Aufnahme
          in den Wahlvorschlag schriftlich zustimmen; eine Person kann nur auf
          einem Wahlvorschlag benannt werden. Vordrucke für Wahlvorschläge sind
          beim Wahlvorstand erhältlich; ihre Verwendung ist nicht
          vorgeschrieben.
        </p>
        {v.geschlechterHinweis && (
          <p>
            Frauen und Männer sollen in der Jugend- und Auszubildendenvertretung
            entsprechend ihren Anteilen an den Wahlberechtigten vertreten sein
            (§ 62 Abs. 1 i. V. m. § 11 Abs. 1 LPVG). Unter den Wahlberechtigten
            sind{" "}
            <V
              value={v.geschlechterAnteile}
              label="Anteile von Frauen und Männern"
            />
            . Danach entfallen auf{" "}
            <V
              value={v.geschlechterSitze}
              label="Sitze für Frauen und Männer"
            />{" "}
            (§ 8 LPVGWO). Jeder Wahlvorschlag muss mindestens so viele Frauen
            und Männer enthalten; andernfalls ist die Abweichung schriftlich zu
            begründen, sonst ist der Wahlvorschlag ungültig (§ 13 Abs. 5 LPVG, §
            12 Abs. 2 LPVGWO).
          </p>
        )}
        <p>
          Nur fristgerecht eingereichte Wahlvorschläge werden berücksichtigt.
          Die Stimmabgabe ist an die Wahlvorschläge gebunden.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Wahlverfahren">
        <p>
          Die Wahl ist geheim und unmittelbar. Gehen mehrere gültige
          Wahlvorschläge ein, wird nach den Grundsätzen der Verhältniswahl
          gewählt; liegt nur ein gültiger Wahlvorschlag vor, nach den
          Grundsätzen der Mehrheitswahl.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Schriftliche Stimmabgabe (Briefwahl)">
        <p>
          Wahlberechtigte, die am Wahltag verhindert sind, können die Unterlagen
          für die schriftliche Stimmabgabe beim Wahlvorstand anfordern.
          {v.briefwahlHinweis && <> {v.briefwahlHinweis}</>}
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Bekanntmachungen">
        <p>
          Die gültigen Wahlvorschläge werden spätestens am{" "}
          <V
            value={v.bekanntmachungVorschlaegeBis}
            label="Datum der Bekanntmachung"
          />{" "}
          bis zum Abschluss der Stimmabgabe bekannt gemacht:{" "}
          <V value={v.bekanntmachungsort} label="Ort der Bekanntmachungen" />.
          Dort erfolgen auch alle weiteren Bekanntmachungen des Wahlvorstands.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Stimmenauszählung">
        <p>
          Die Stimmen werden öffentlich ausgezählt:{" "}
          <V value={v.auszaehlung} label="Zeit und Ort der Auszählung" />.
        </p>
      </Abschnitt>

      <Abschnitt nr={++nr} titel="Rechtsgrundlagen">
        <p>
          Landespersonalvertretungsgesetz Baden-Württemberg (insbesondere §§
          59–62) und Wahlordnung zum LPVG (insbesondere §§ 1–44 i. V. m. § 54
          LPVGWO). LPVG und Wahlordnung liegen beim Wahlvorstand zur Einsicht
          aus.
        </p>
      </Abschnitt>

      <footer className="unterschrift mt-4 grid gap-10">
        <p>
          <V value={v.ausstellungsort} label="Ort" />, den{" "}
          <V value={v.erlassAm} label="Datum des Erlasses" />
        </p>
        <div>
          <p>Der Wahlvorstand</p>
          <div className="mt-10 grid grid-cols-3 gap-6 text-xs text-muted-foreground print:text-black">
            <span className="border-t pt-1">Vorsitz</span>
            <span className="border-t pt-1">Mitglied</span>
            <span className="border-t pt-1">Mitglied</span>
          </div>
        </div>
      </footer>
    </article>
  );
}
