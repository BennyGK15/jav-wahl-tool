import { notFound } from "next/navigation";
import { DruckRahmen, Wert } from "@/components/druck-rahmen";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { writeAudit } from "@/lib/audit";
import { fromDbDate, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { buildWahlausschreiben } from "@/server/wahlausschreiben";

export const metadata = { title: "Vordruck Wahlvorschlag" };

/** Leere Schreiblinie für handschriftliche Angaben */
function Linie({
  breite = "w-full",
  label,
}: {
  breite?: string;
  label?: string;
}) {
  return (
    <span className={`inline-block ${breite} align-bottom`}>
      <span className="block h-7 border-b border-black" />
      {label && (
        <span className="block text-[9pt] text-neutral-600">{label}</span>
      )}
    </span>
  );
}

function Kasten() {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block size-3.5 border border-black align-[-2px]"
    />
  );
}

const th =
  "border border-black px-1.5 py-1 text-left align-bottom text-[9pt] font-semibold";
const td = "h-9 border border-black px-1.5";

function Kopf({
  dienststelle,
  wahltag,
  untertitel,
}: {
  dienststelle: string;
  wahltag: string;
  untertitel: string;
}) {
  return (
    <header className="grid gap-1 border-b-2 border-black pb-2">
      <p className="text-[9pt] tracking-wide uppercase">
        Wahl der Jugend- und Auszubildendenvertretung · {dienststelle} · Wahltag{" "}
        {wahltag}
      </p>
      <h2 className="text-lg font-bold">{untertitel}</h2>
      <p className="text-sm">
        zum Wahlvorschlag mit dem Kennwort: <Linie breite="w-72" />
      </p>
    </header>
  );
}

export default async function VordruckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();
  const { id } = await params;
  const election = await prisma.election.findUnique({
    where: { id },
    include: { deadlines: { where: { ruleKey: "nachfrist_ende" } } },
  });
  if (!election) notFound();
  if (election.verfahren === "wahlversammlung") {
    return (
      <NochNichtVerfuegbar
        titel="Vordruck Wahlvorschlag"
        text="Bei der Wahlversammlung werden die Wahlvorschläge aus der Mitte der Versammlung gemacht (§ 54 Abs. 2 LPVGWO). Ein schriftlicher Wahlvorschlag ist nicht nötig."
        ziel={{ href: `/wahl/${id}/einladung`, label: "Zur Einladung" }}
      />
    );
  }

  const { view: v } = await buildWahlausschreiben(id);
  const sitzeFM = v.geschlechterSitze;
  const nachfrist = election.deadlines[0];
  const fristBis = nachfrist
    ? `${formatIsoDate(fromDbDate(nachfrist.datum))}${nachfrist.uhrzeit ? `, ${nachfrist.uhrzeit} Uhr` : ""} (Nachfrist)`
    : v.vorschlaegeBis;
  const mitGeschlecht = v.mitglieder >= 3;
  const sollBewerber = v.mitglieder * 2; // § 12 Abs. 1 LPVGWO: mindestens doppelt so viele Bewerber wie zu wählen
  const zeilenBewerber = Math.max(sollBewerber, 4);
  const min = v.mindestUnterschriften;
  const zeilenUnterschriften = Math.min(
    Math.max(Math.ceil((min ?? 10) * 1.5), 12),
    80,
  );
  const fehlt = [
    !fristBis && "Uhrzeit des Fristendes (Wahlkalender)",
    !v.einreichungsstelle && "Einreichungsstelle (Wahlausschreiben)",
    min == null && "Mindestzahl der Stützunterschriften (Wahlvorschläge)",
  ].filter(Boolean);

  await writeAudit({
    userId: session.user.id,
    action: "nominations.form.generated",
    objectType: "election",
    objectId: id,
  });

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/vorschlaege`, label: "Wahlvorschläge" }}
      titel="Vordruck Wahlvorschlag"
      kopf={{
        dienststelle: v.dienststelle,
        art: "Vordruck Wahlvorschlag",
        datum: `Stand: ${formatIsoDate(todayBerlin())}`,
      }}
      entwurf={false}
      hinweis={
        <>
          Vordruck zum Ausgeben an Beschäftigte und Gewerkschaften – drucken
          oder im Druckdialog „Als PDF speichern“ wählen und z. B. per E-Mail
          oder im Intranet bereitstellen. Inhalt nach §§ 11–15 LPVGWO, § 13 und
          § 60 LPVG; die Verwendung des Vordrucks ist nicht vorgeschrieben, ein
          formlos eingereichter Wahlvorschlag mit allen Angaben ist ebenso
          gültig.
          {fehlt.length > 0 && (
            <strong className="mt-1 block">
              Noch offen: {fehlt.join(", ")} – im Ausdruck rot markiert.
            </strong>
          )}
        </>
      }
    >
      <article className="grid gap-5 text-[10.5pt] leading-snug">
        {/* ---------------- Seite 1: Wahlvorschlag ---------------- */}
        <header className="grid gap-1 text-center">
          <p className="text-[9pt] tracking-wide uppercase">
            An den Wahlvorstand · {v.dienststelle}
          </p>
          <h1 className="text-2xl font-bold">Wahlvorschlag</h1>
          <p>
            für die Wahl der Jugend- und Auszubildendenvertretung bei{" "}
            <strong>{v.dienststelle}</strong> am <strong>{v.wahltag}</strong>
          </p>
          <p className="text-[9pt]">
            Einzureichen bis{" "}
            <Wert v={fristBis} l="Ende der Einreichungsfrist" /> während der
            Dienststunden bei{" "}
            <Wert v={v.einreichungsstelle} l="Einreichungsstelle" /> (§ 11 Abs.
            2 LPVGWO)
          </p>
        </header>

        <section className="grid gap-2">
          <h2 className="font-bold">
            1. Kennwort (freiwillig, § 12 Abs. 7 LPVGWO)
          </h2>
          <Linie />
        </section>

        <section className="grid gap-2">
          <h2 className="font-bold">2. Eingereicht von</h2>
          <p>
            <Kasten /> wahlberechtigten Beschäftigten – mit Unterschriften von
            mindestens{" "}
            <Wert v={min != null ? String(min) : null} l="Mindestzahl" />{" "}
            Wahlberechtigten (Anlage 1)
          </p>
          <p>
            <Kasten /> der in der Dienststelle vertretenen Gewerkschaft:{" "}
            <Linie breite="w-80" />
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-bold">3. Bewerberinnen und Bewerber</h2>
          <p className="text-[9pt]">
            In der Reihenfolge, in der sie auf dem Stimmzettel erscheinen sollen
            (§ 12 Abs. 3 LPVGWO). Zu wählen{" "}
            {v.mitglieder === 1
              ? "ist 1 Person"
              : `sind ${v.mitglieder} Mitglieder`}
            ; der Wahlvorschlag soll mindestens {sollBewerber} Bewerberinnen und
            Bewerber enthalten (§ 12 Abs. 1 LPVGWO). Wählbar ist, wer am Wahltag
            das 26. Lebensjahr noch nicht vollendet hat oder sich in einer
            beruflichen Ausbildung befindet (§ 60 Abs. 2 LPVG). Für jede Person
            ist eine Zustimmungserklärung beizufügen (Anlage 2).
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-8`}>Nr.</th>
                <th className={th}>Familienname</th>
                <th className={th}>Vorname</th>
                <th className={th}>
                  Amts- oder Funktionsbezeichnung / Ausbildungsberuf
                </th>
                <th className={th}>Dienststelle / Organisationseinheit</th>
                {mitGeschlecht && <th className={`${th} w-16`}>Frau / Mann</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: zeilenBewerber }, (_, i) => (
                <tr key={i} className="break-inside-avoid">
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                  {mitGeschlecht && <td className={td} />}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[9pt]">
            Weitere Bewerberinnen und Bewerber bitte auf einem Beiblatt in
            gleicher Form fortsetzen.
          </p>
        </section>

        {mitGeschlecht && (
          <section className="grid gap-2">
            <h2 className="font-bold">
              4. Begründung bei abweichender Verteilung von Frauen und Männern
            </h2>
            <p className="text-[9pt]">
              Auf Frauen und Männer entfallen{" "}
              <Wert v={sitzeFM} l="Sitze Frauen/Männer" /> (§ 8 LPVGWO). Der
              Wahlvorschlag muss mindestens so viele Frauen und Männer
              enthalten. Weicht er davon ab, ist dies schriftlich zu begründen –
              sonst ist er ungültig (§ 13 Abs. 5 LPVG, §§ 12 Abs. 2, 15 Abs. 5
              Nr. 7 LPVGWO).
            </p>
            <Linie />
            <Linie />
          </section>
        )}

        <section className="grid gap-2">
          <h2 className="font-bold">
            {mitGeschlecht ? "5" : "4"}. Vertretung des Wahlvorschlags (§ 12
            Abs. 5 und 6 LPVGWO)
          </h2>
          <p className="text-[9pt]">
            Die Vertreterin oder der Vertreter verhandelt mit dem Wahlvorstand
            und nimmt dessen Erklärungen und Entscheidungen entgegen. Ohne
            Angabe gilt die erste Unterzeichnerin bzw. der erste Unterzeichner,
            vertreten durch die zweite Person. Mitglieder des Wahlvorstands
            können nicht Vertreter sein.
          </p>
          <div className="grid grid-cols-2 gap-6">
            <Linie label="Vertreter/in: Name, Vorname, Dienststelle, Telefon/E-Mail" />
            <Linie label="Stellvertreter/in: Name, Vorname, Dienststelle, Telefon/E-Mail" />
          </div>
        </section>

        <section className="grid gap-2">
          <h2 className="font-bold">
            {mitGeschlecht ? "6" : "5"}. Nur bei Wahlvorschlägen einer
            Gewerkschaft (§ 12 Abs. 4 LPVGWO)
          </h2>
          <p className="text-[9pt]">
            Unterschrift eines zeichnungsberechtigten Mitglieds des Vorstands
            der Gewerkschaft auf Orts-, Bezirks-, Landes- oder Bundesebene.
            Stützunterschriften (Anlage 1) sind dann nicht nötig.
          </p>
          <div className="unterschrift grid grid-cols-3 gap-6">
            <Linie label="Ort, Datum" />
            <Linie label="Name in Blockschrift, Funktion im Vorstand" />
            <Linie label="Unterschrift" />
          </div>
        </section>

        <section className="grid gap-1 border-2 border-black p-3 break-inside-avoid">
          <h2 className="font-bold">
            Eingangsvermerk des Wahlvorstands (§ 14 Abs. 1 LPVGWO)
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <Linie label="Eingegangen am" />
            <Linie label="um (Uhrzeit)" />
            <Linie label="Unterschrift Vorsitz Wahlvorstand" />
          </div>
        </section>

        {/* ---------------- Anlage 1: Stützunterschriften ---------------- */}
        <section className="grid gap-3 break-before-page pt-2">
          <Kopf
            dienststelle={v.dienststelle}
            wahltag={v.wahltag}
            untertitel="Anlage 1 – Unterschriften zur Unterstützung des Wahlvorschlags"
          />
          <p className="text-[9pt]">
            Nur bei Wahlvorschlägen der Beschäftigten. Erforderlich sind
            Unterschriften von mindestens{" "}
            <Wert v={min != null ? String(min) : null} l="Mindestzahl" />{" "}
            wahlberechtigten Beschäftigten (§ 62 Abs. 1 i. V. m. § 13 Abs. 4 und
            6 LPVG). Unterschreiben darf nur, wer bei dieser Wahl wahlberechtigt
            ist – und nur auf einem einzigen Wahlvorschlag (§ 13 Abs. 3 LPVGWO).
            Eine Unterschrift kann nicht zurückgenommen werden (§ 14 Abs. 3
            LPVGWO). Name bitte in Blockschrift wiederholen. Ohne andere Angabe
            vertreten die beiden ersten Unterzeichner den Wahlvorschlag.
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-8`}>Nr.</th>
                <th className={th}>Familienname, Vorname (Blockschrift)</th>
                <th className={th}>Amts- oder Funktionsbezeichnung</th>
                <th className={th}>Dienststelle</th>
                <th className={`${th} w-40`}>Unterschrift</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: zeilenUnterschriften }, (_, i) => (
                <tr key={i} className="break-inside-avoid">
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---------------- Anlage 2: Zustimmungserklärungen ---------------- */}
        <section className="grid gap-4 break-before-page pt-2">
          <Kopf
            dienststelle={v.dienststelle}
            wahltag={v.wahltag}
            untertitel="Anlage 2 – Zustimmungserklärungen der Bewerberinnen und Bewerber"
          />
          <p className="text-[9pt]">
            Jede Person, die auf dem Wahlvorschlag steht, muss ihrer Aufnahme
            schriftlich zustimmen (§ 13 Abs. 2 LPVGWO). Die Zustimmung kann
            nicht zurückgenommen werden und darf keine Bedingung enthalten (§§
            14 Abs. 2 und 3 LPVGWO).
          </p>
          {Array.from({ length: zeilenBewerber }, (_, i) => (
            <div
              key={i}
              className="grid gap-2 border border-black p-3 break-inside-avoid"
            >
              <p className="font-semibold">
                Zustimmungserklärung – Bewerber/in Nr. {i + 1}
              </p>
              <p>
                Ich stimme meiner Aufnahme in den oben genannten Wahlvorschlag
                für die Wahl der Jugend- und Auszubildendenvertretung zu. Ich
                bin auf keinem anderen Wahlvorschlag für diese Wahl benannt (§
                13 Abs. 1 LPVGWO).
              </p>
              <div className="grid grid-cols-[2fr_1fr_1.5fr] gap-6">
                <Linie label="Familienname, Vorname (Blockschrift)" />
                <Linie label="Ort, Datum" />
                <Linie label="Unterschrift" />
              </div>
            </div>
          ))}
        </section>

        {/* ---------------- Merkblatt ---------------- */}
        <section className="grid gap-2 break-before-page pt-2 text-[10pt]">
          <h2 className="text-lg font-bold">
            Merkblatt: So wird der Wahlvorschlag gültig
          </h2>
          <ol className="grid list-decimal gap-1.5 pl-5">
            <li>
              <strong>Rechtzeitig einreichen:</strong> bis{" "}
              <Wert v={fristBis} l="Ende der Einreichungsfrist" /> schriftlich
              im Original bei{" "}
              <Wert v={v.einreichungsstelle} l="Einreichungsstelle" />. Zu spät
              eingereichte Wahlvorschläge sind ungültig (§ 15 Abs. 5 Nr. 1
              LPVGWO). Früh einreichen lohnt sich: Mängel können dann noch
              behoben werden.
            </li>
            <li>
              <strong>Reihenfolge eindeutig:</strong> Bewerberinnen und Bewerber
              untereinander mit fortlaufender Nummer, mit Familienname, Vorname,
              Amts- oder Funktionsbezeichnung und Dienststelle (§ 12 Abs. 3
              LPVGWO).
            </li>
            <li>
              <strong>Keine Stimmenhäufung, keine Bedingungen:</strong> Der
              Wahlvorschlag darf keine Hinweise enthalten, wem man mehrere
              Stimmen geben soll, und an keine Bedingung geknüpft sein (§§ 12
              Abs. 3, 15 Abs. 5 Nr. 2 LPVGWO).
            </li>
            <li>
              <strong>Zustimmung jeder Person</strong> beifügen (Anlage 2). Jede
              Person darf nur auf einem Wahlvorschlag stehen.
            </li>
            <li>
              <strong>Genug Unterschriften</strong> (Anlage 1): mindestens{" "}
              <Wert v={min != null ? String(min) : null} l="Mindestzahl" />{" "}
              Wahlberechtigte, jede Person nur für einen Wahlvorschlag. Bei
              Wahlvorschlägen einer Gewerkschaft genügt die Unterschrift eines
              zeichnungsberechtigten Vorstandsmitglieds.
            </li>
            {mitGeschlecht && (
              <li>
                <strong>Frauen und Männer</strong> entsprechend ihrem Anteil
                berücksichtigen oder die Abweichung schriftlich begründen
                (Abschnitt 4).
              </li>
            )}
            <li>
              <strong>Mängel:</strong> Der Wahlvorstand teilt Mängel spätestens
              am Arbeitstag nach Ablauf der Einreichungsfrist mit; der
              berichtigte Wahlvorschlag muss spätestens am dritten Arbeitstag
              nach Fristablauf wieder vorliegen. Fehlende Unterschriften oder
              Zustimmungserklärungen können nach Fristablauf nicht mehr
              nachgereicht werden (§ 14 Abs. 2 LPVGWO).
            </li>
          </ol>
          <p className="text-[9pt] text-neutral-600">
            Fragen beantwortet der Wahlvorstand.
          </p>
        </section>
      </article>
    </DruckRahmen>
  );
}
