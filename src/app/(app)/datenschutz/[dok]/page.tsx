import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DruckRahmen, Wert } from "@/components/druck-rahmen";
import { writeAudit } from "@/lib/audit";
import { angabe, aufgabenStatus, DATENSCHUTZ_DOKUMENTE, LOESCHFRISTEN, type DatenschutzAngaben, type DatenschutzDokument } from "@/lib/datenschutz";
import { todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { loadAufgabenStand, loadDatenschutzAngaben } from "@/server/einstellungen";

export const metadata = { title: "Datenschutz-Unterlagen" };

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="font-semibold">{titel}</h2>
      {children}
    </section>
  );
}

function Tabelle({ kopf, zeilen }: { kopf: string[]; zeilen: ReactNode[][] }) {
  return (
    <table className="w-full border-collapse text-[9.5pt]">
      <thead>
        <tr className="border-b-2 border-foreground text-left">
          {kopf.map((k) => (
            <th key={k} className="py-1 pr-3 align-bottom">
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z, i) => (
          <tr key={i} className="border-b align-top">
            {z.map((c, j) => (
              <td key={j} className={j === 0 ? "py-1 pr-3 font-semibold" : "py-1 pr-3"}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RECHTSGRUNDLAGEN =
  "Art. 6 Abs. 1 UAbs. 1 lit. c und e, Abs. 3 DSGVO i. V. m. §§ 59–62 LPVG BW und der Wahlordnung zum LPVG (LPVGWO); § 15 Abs. 1 LDSG BW (Rechte und Pflichten der Interessenvertretung); § 67 LPVG BW";

function Verzeichnis({ a }: { a: DatenschutzAngaben }) {
  const v = (k: keyof DatenschutzAngaben, l: string) => <Wert v={angabe(a, k)} l={l} />;
  return (
    <>
      <p>Verarbeitungstätigkeit: Vorbereitung, Durchführung und Abschluss der Wahl der Jugend- und Auszubildendenvertretung mit dem JAV-Wahl-Tool.</p>
      <Tabelle
        kopf={["Merkmal", "Angabe"]}
        zeilen={[
          ["Verantwortlicher", <>{v("verantwortlicheStelle", "Verantwortliche Stelle")}, {v("anschrift", "Anschrift")}, vertreten durch {v("leitung", "Leitung")}</>],
          ["Ansprechperson", v("ansprechperson", "Ansprechperson")],
          ["Datenschutzbeauftragte/r", <>{v("dsbName", "Datenschutzbeauftragte/r")}, {v("dsbKontakt", "Kontakt")}</>],
          ["Zwecke", "Wahlberechtigung und Wählbarkeit feststellen, Wählerverzeichnis führen und auslegen, Einsprüche und Wahlvorschläge prüfen, Stimmabgabe vermerken, Ergebnis ermitteln und bekanntmachen, Fristen planen, Nachweise für eine mögliche Wahlanfechtung"],
          ["Rechtsgrundlagen", RECHTSGRUNDLAGEN],
          ["Betroffene", "Wahlberechtigte und wählbare Beschäftigte im Sinne von § 59 LPVG; Bewerberinnen und Bewerber; Unterzeichnende von Wahlvorschlägen; Einspruchsführende; Mitglieder des Wahlvorstands sowie Wahlhelferinnen und Wahlhelfer als Nutzende"],
          ["Datenkategorien", "Wählerverzeichnis (lfd. Nr., Name, Vorname, Amts-/Funktionsbezeichnung bzw. Ausbildungsberuf, Organisationseinheit, Geschlecht, Geburtsdatum, Ausbildung und Ausbildungsende, Wahlberechtigung, Wählbarkeit); Stimmabgabevermerk und Briefwahlstatus; Einsprüche; Wahlvorschläge mit Bewerbern und Unterzeichnenden; Ergebnis; Wahlvorstand; Benutzerkonten, Sitzungen und Audit-Log. Keine besonderen Kategorien nach Art. 9 DSGVO; das Wahlverhalten wird nicht gespeichert."],
          ["Empfänger", "Keine Übermittlung an Dritte. Durch Aushang in der Dienststelle: Namen der Bewerber (§ 18 LPVGWO), der Gewählten (§ 31), des Wahlvorstands (§ 1 Abs. 3); Wählerverzeichnis zur Einsicht ohne Geburtstag (§ 6 Abs. 4). Bei Wahlanfechtung: Verwaltungsgericht."],
          ["Betrieb", v("betrieb", "Betrieb")],
          ["Drittlandtransfer", <>Keiner. Die Anwendung nutzt keine externen Dienste. Serverstandort: {v("serverstandort", "Serverstandort")}.</>],
          ["Löschfristen", "Siehe Löschkonzept unten"],
          ["Technische und organisatorische Maßnahmen", "Siehe gesondertes Dokument (Art. 32 DSGVO)"],
        ]}
      />
      <Abschnitt titel="Löschkonzept">
        <Tabelle kopf={["Daten", "Frist", "Grundlage", "Umsetzung"]} zeilen={LOESCHFRISTEN.map((l) => [l.daten, l.frist, l.grundlage, l.umsetzung])} />
        <p>Während einer laufenden Wahl werden keine Wahldaten gelöscht.</p>
      </Abschnitt>
    </>
  );
}

const TOM_ZEILEN: [string, string, string][] = [
  ["Zugangskontrolle", "Anmeldung mit Benutzername und Passwort (mind. 12 Zeichen), Passwortwechsel bei der ersten Anmeldung; Zwei-Faktor-Anmeldung (TOTP) freiwillig verfügbar; Sperre nach 5 Fehlversuchen in 15 Minuten für 15 Minuten; Begrenzung der Anmeldeversuche; Sitzungen enden nach 8 Stunden; Sitzungs-Cookies nur verschlüsselt übertragen, nicht per Skript lesbar, nur für die eigene Seite", "Vergabe und Entzug der Konten; Zwei-Faktor-Anmeldung derzeit nicht verpflichtend (bewusste Entscheidung, Restrisiko siehe Folgenabschätzung)"],
  ["Zugriffskontrolle", "Rollen: Administration (Konten, Protokoll, Löschung), Vorsitz, Mitglied, Wahlhelfer/in (nur Stimmabgabe vermerken); jede Berechtigung wird auf dem Server geprüft; Wahlhelfer sehen keine Geburtsdaten; die Wahltisch-Ansicht zeigt Namen erst nach einer Suche", "Wer welche Rolle erhält; Wahlhelfer-Konten nur für den Wahltag"],
  ["Vertraulichkeit", "Geburtsdatum, Ausbildungsende sowie Inhalt und Begründung von Einsprüchen verschlüsselt (AES-256-GCM, an den Datensatz gebunden); Schlüssel getrennt von der Datenbank", "Schlüssel sicher und getrennt von der Datensicherung aufbewahren"],
  ["Übertragungskontrolle", "HTTPS erzwungen (HSTS), Content-Security-Policy, Einbetten in fremde Seiten verboten, keine Referrer-Weitergabe, Kamera/Mikrofon/Standort gesperrt", "TLS-Zertifikat; Datenbankverbindung über TLS; Erreichbarkeit nur im Netz der Dienststelle oder über VPN"],
  ["Eingabekontrolle", "Audit-Log aller Änderungen und Abrufe sensibler Daten (wer, wann, was – nur Feldnamen, keine Inhalte); IP-Adressen nur pseudonymisiert", "Auswertung nur anlassbezogen"],
  ["Datenminimierung, Speicherbegrenzung", "Nur Daten, die die Wahlordnung verlangt; Auslage ohne Geburtsdatum; Unterzeichnende nie veröffentlicht; Löschkonzept mit Löschsperre während der Wahl und bei Anfechtung; automatische Bereinigung von Sitzungen und Audit-Log; Löschung entfernt alle Daten einer Wahl vollständig", "Papierunterlagen sicher verwahren und fristgerecht vernichten"],
  ["Verfügbarkeit, Belastbarkeit", "Doppelte Vermerke durch bedingte Datenbank-Updates ausgeschlossen", "Datensicherung (offen), Wiederherstellungstest, Updates von Server und Abhängigkeiten"],
  ["Organisation", "Hinweise in der Anwendung zu Fristen, Pflichtangaben und Löschung", "Verpflichtung auf Vertraulichkeit; Einweisung von Wahlvorstand und Wahlhelfern; Tablets am Wahltisch mit Bildschirmsperre; Beteiligung des Personalrats"],
];

function Tom({ a }: { a: DatenschutzAngaben }) {
  return (
    <>
      <p>
        Betrieb: <Wert v={angabe(a, "betrieb")} l="Betrieb" />. Serverstandort: <Wert v={angabe(a, "serverstandort")} l="Serverstandort" />. Die
        Anwendung bringt die Maßnahmen der mittleren Spalte mit; die rechte Spalte nennt, was der Betrieb ergänzt.
      </p>
      <Tabelle kopf={["Schutzziel", "In der Anwendung umgesetzt", "Ergänzend im Betrieb"]} zeilen={TOM_ZEILEN} />
    </>
  );
}

const RISIKEN: [string, string, string, string][] = [
  ["Unbefugte Einsicht in das Wählerverzeichnis (u. a. Geburtsdaten)", "mittel", "Rollen mit serverseitiger Prüfung, Verschlüsselung der Geburtsdaten, Audit-Log, Sitzungsende nach 8 Stunden", "gering"],
  ["Übernahme eines Kontos (z. B. erratenes oder weitergegebenes Passwort)", "mittel", "Passwortregeln, Sperre nach Fehlversuchen, Anmeldebremse, Zwei-Faktor-Anmeldung freiwillig", "mittel – 2FA ist nicht verpflichtend; durch Einweisung und kurze Laufzeit der Konten begrenzt"],
  ["Rückschluss auf das Wahlverhalten", "gering", "Die Anwendung speichert nur den Vermerk, dass jemand gewählt hat, nie wie; Ergebnisse nur als Summen", "gering – bei sehr kleinen Wahlen gesetzlich bedingt"],
  ["Einsicht Dritter am Wahltisch", "mittel", "Wahltisch-Ansicht zeigt Namen erst nach einer Suche, keine Liste aller Namen", "gering"],
  ["Falsche oder verfrühte Veröffentlichung (Bekanntmachungen)", "gering", "Entwurfskennzeichnung, Freigabe mit Prüfsumme, Unterzeichnende werden nie veröffentlicht", "gering"],
  ["Manipulation von Stimmabgabevermerken", "gering", "Vermerk nur einmal möglich, Korrektur nur durch den Wahlvorstand, Audit-Log", "gering"],
  ["Zu lange Speicherung", "mittel", "Löschkonzept mit Vorschlag des Löschtermins, automatische Bereinigung, Löschsperre während der Wahl", "gering"],
  ["Datenverlust (z. B. Serverausfall vor der Feststellung)", "mittel", "Datensicherung (noch einzurichten); Papierunterlagen der Wahl", "mittel, bis die Datensicherung eingerichtet ist"],
];

function Dsfa({ a }: { a: DatenschutzAngaben }) {
  return (
    <>
      <p>
        Die Folgenabschätzung wird vorsorglich durchgeführt: Verarbeitet werden Beschäftigtendaten überwiegend junger Menschen, darunter
        Minderjähriger, und Daten zur Teilnahme an einer Wahl.
      </p>
      <Abschnitt titel="1. Systematische Beschreibung">
        <p>
          Der Wahlvorstand organisiert mit dem JAV-Wahl-Tool die Wahl der Jugend- und Auszubildendenvertretung nach LPVG und LPVGWO:
          Wählerverzeichnis, Einsprüche, Wahlvorschläge, Stimmabgabevermerke, Auszählung und Bekanntmachungen. Verantwortlich:{" "}
          <Wert v={angabe(a, "verantwortlicheStelle")} l="Verantwortliche Stelle" />. Betrieb: <Wert v={angabe(a, "betrieb")} l="Betrieb" />. Die
          Datenkategorien, Empfänger und Fristen stehen im Verzeichnis von Verarbeitungstätigkeiten.
        </p>
      </Abschnitt>
      <Abschnitt titel="2. Notwendigkeit und Verhältnismäßigkeit">
        <ul className="list-disc space-y-1 pl-5">
          <li>Zweck und Umfang ergeben sich aus der Wahlordnung; die Anwendung verarbeitet keine Daten darüber hinaus.</li>
          <li>Das Geburtsdatum ist nötig, um Wahlberechtigung und Wählbarkeit festzustellen (§§ 59, 60 LPVG); es wird verschlüsselt und nicht ausgelegt.</li>
          <li>Das Geschlecht ist nötig für die anteilige Vertretung von Frauen und Männern (§ 11 LPVG, § 8 LPVGWO).</li>
          <li>Speicherdauer nach dem Löschkonzept; während der Wahl keine Löschung, danach unverzüglich (§ 32 LPVGWO).</li>
          <li>Die Betroffenen werden durch den Datenschutzhinweis informiert; ihre Rechte bleiben gewahrt, Berichtigung des Wählerverzeichnisses über den Einspruch.</li>
        </ul>
      </Abschnitt>
      <Abschnitt titel="3. Risiken und Maßnahmen">
        <Tabelle kopf={["Risiko", "Ohne Maßnahmen", "Maßnahmen", "Restrisiko"]} zeilen={RISIKEN} />
      </Abschnitt>
      <Abschnitt titel="4. Ergebnis">
        <p>
          Nach den Maßnahmen ist das Restrisiko insgesamt gering bis mittel und vertretbar. Mittel bleiben die Kontoübernahme (Zwei-Faktor-Anmeldung
          nicht verpflichtend) und der Datenverlust, solange keine Datensicherung eingerichtet ist. Eine vorherige Konsultation der
          Aufsichtsbehörde nach Art. 36 DSGVO ist nach dieser Einschätzung nicht erforderlich.
        </p>
      </Abschnitt>
      <Abschnitt titel="5. Stellungnahme und Freigabe">
        <p>Stellungnahme der/des Datenschutzbeauftragten (<Wert v={angabe(a, "dsbName")} l="Datenschutzbeauftragte/r" />):</p>
        <div className="grid gap-6 pt-2">
          <span className="block border-b border-black" />
          <span className="block border-b border-black" />
        </div>
        <div className="unterschrift mt-10 grid grid-cols-2 gap-10">
          <span className="border-t border-black pt-1">Ort, Datum, Datenschutzbeauftragte/r</span>
          <span className="border-t border-black pt-1">Ort, Datum, Verantwortliche Stelle</span>
        </div>
      </Abschnitt>
    </>
  );
}

function Hinweis({ a }: { a: DatenschutzAngaben }) {
  return (
    <>
      <p>
        Für die Wahl der Jugend- und Auszubildendenvertretung (JAV) verarbeitet der Wahlvorstand personenbezogene Daten der Beschäftigten,
        die wählen dürfen oder wählbar sind. Dazu nutzt er eine Anwendung, die von <Wert v={angabe(a, "betrieb")} l="Betrieb" /> betrieben wird.
      </p>
      <p>
        <strong>Wer ist verantwortlich?</strong> <Wert v={angabe(a, "verantwortlicheStelle")} l="Verantwortliche Stelle" />,{" "}
        <Wert v={angabe(a, "anschrift")} l="Anschrift" />. Ansprechperson für die Wahl: <Wert v={angabe(a, "ansprechperson")} l="Ansprechperson" />.
        Datenschutzbeauftragte/r: <Wert v={angabe(a, "dsbName")} l="Datenschutzbeauftragte/r" />, <Wert v={angabe(a, "dsbKontakt")} l="Kontakt" />.
      </p>
      <p>
        <strong>Welche Daten?</strong> Name, Vorname, Amts- oder Funktionsbezeichnung bzw. Ausbildungsberuf, Organisationseinheit, Geschlecht,
        Geburtsdatum und Angaben zur Ausbildung; am Wahltag der Vermerk, dass Sie gewählt haben – nicht, wie Sie gewählt haben; bei Briefwahl
        Antrag, Versand und Eingang. Wenn Sie kandidieren, einen Wahlvorschlag unterschreiben oder Einspruch einlegen, auch diese Angaben.
      </p>
      <p>
        <strong>Woher stammen die Daten?</strong> Von der Personalverwaltung der Dienststelle, die den Wahlvorstand mit den nötigen Unterlagen
        unterstützt (§ 1 Abs. 2 LPVGWO), und von Ihnen selbst.
      </p>
      <p>
        <strong>Wofür und auf welcher Grundlage?</strong> Um festzustellen, wer wählen darf und wählbar ist, das Wählerverzeichnis zu führen,
        Wahlvorschläge zu prüfen, die Stimmabgabe zu vermerken und das Ergebnis festzustellen. Rechtsgrundlage: {RECHTSGRUNDLAGEN}.
      </p>
      <p>
        <strong>Wer erfährt davon?</strong> Das Wählerverzeichnis liegt zur Einsicht der Beschäftigten aus – ohne Geburtsdatum. Die Namen der
        Bewerberinnen und Bewerber und der Gewählten werden in der Dienststelle bekanntgemacht. Wer einen Wahlvorschlag unterschrieben hat, wird
        nicht veröffentlicht. Stellen außerhalb der Dienststelle erhalten Daten nur bei einer gerichtlichen Wahlanfechtung.
      </p>
      <p>
        <strong>Wie lange?</strong> Die elektronischen Daten werden gelöscht, sobald feststeht, dass die Wahl gültig oder ungültig ist – in der Regel
        kurz nach Ablauf der Anfechtungsfrist von zwölf Arbeitstagen nach Bekanntgabe des Ergebnisses (§ 32 LPVGWO, § 21 LPVG). Während der Wahl
        wird nichts gelöscht. Niederschriften und Bekanntmachungen bewahrt der Personalrat in Papierform bis zur nächsten Personalratswahl auf.
      </p>
      <p>
        <strong>Ihre Rechte:</strong> Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 – für das Wählerverzeichnis durch Einspruch beim
        Wahlvorstand bis zum Ende der Auslage, § 6 Abs. 5 LPVGWO), unter den gesetzlichen Voraussetzungen Löschung, Einschränkung der Verarbeitung
        und Widerspruch (Art. 17, 18, 21). Beschwerde beim Landesbeauftragten für den Datenschutz und die Informationsfreiheit Baden-Württemberg
        (Art. 77). Eine automatisierte Entscheidung findet nicht statt: Die Anwendung schlägt Wahlberechtigung und Wählbarkeit nur vor, entscheiden
        tut der Wahlvorstand.
      </p>
      <div className="unterschrift mt-10 grid w-64 gap-1">
        <span className="border-t border-black pt-1">Der Wahlvorstand</span>
      </div>
    </>
  );
}

export default async function DatenschutzDokumentPage({ params }: { params: Promise<{ dok: string }> }) {
  const session = await requireSession();
  const { dok } = await params;
  if (!(dok in DATENSCHUTZ_DOKUMENTE)) notFound();
  const art = dok as DatenschutzDokument;
  const meta = DATENSCHUTZ_DOKUMENTE[art];
  const { angaben } = await loadDatenschutzAngaben();
  const offeneAufgaben = aufgabenStatus(angaben, await loadAufgabenStand()).filter((a) => !a.erledigt);
  const wahl = await prisma.election.findFirst({ orderBy: { createdAt: "desc" }, select: { dienststelle: true } });
  const dienststelle = angaben.verantwortlicheStelle || wahl?.dienststelle || "[Dienststelle]";
  await writeAudit({ userId: session.user.id, action: "privacy.document", objectType: "einstellung", objectId: "datenschutz", fields: [art] });

  return (
    <DruckRahmen
      zurueck={{ href: "/datenschutz", label: "Datenschutz-Unterlagen" }}
      titel={meta.kurz}
      entwurf={false}
      kopf={{ dienststelle, art: meta.kurz, datum: `Stand: ${formatIsoDate(todayBerlin())}` }}
      hinweis={
        <>
          Zum Speichern als PDF: „Drucken“ und im Druckdialog „Als PDF speichern“ wählen. Rot markierte Angaben auf der Seite
          Datenschutz-Unterlagen ergänzen. Entwurf zur Abstimmung mit der/dem Datenschutzbeauftragten – keine Rechtsberatung.
        </>
      }
    >
      <article className="grid gap-5 text-sm leading-relaxed">
        <header className="text-center">
          <h1 className="text-xl font-bold">{meta.titel}</h1>
          <p>
            nach {meta.grundlage} · JAV-Wahl-Tool
          </p>
        </header>
        {art === "verzeichnis" && <Verzeichnis a={angaben} />}
        {art === "tom" && <Tom a={angaben} />}
        {art === "dsfa" && <Dsfa a={angaben} />}
        {art === "hinweis" && <Hinweis a={angaben} />}
        {art !== "hinweis" && offeneAufgaben.length > 0 && (
          <Abschnitt titel="Offene Aufgaben vor dem Einsatz">
            <ul className="list-disc space-y-1 pl-5">
              {offeneAufgaben.map((x) => (
                <li key={x.key}>☐ {x.text}</li>
              ))}
            </ul>
          </Abschnitt>
        )}
      </article>
    </DruckRahmen>
  );
}
