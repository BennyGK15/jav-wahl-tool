import "server-only";
import { createHash } from "node:crypto";
import { fromDbDate } from "@/lib/dates";
import { verfahrensauskunft } from "@/lib/jav";
import { prisma } from "@/lib/prisma";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";
import { anteileText, sitzeText } from "@/lib/geschlechter";
import { loadGeschlechter } from "./geschlechter";
import { voterCounts } from "./voters";

/** Alles, was das Wahlausschreiben anzeigt – fertig formatiert. `null` = fehlt. */
export interface WahlausschreibenView {
  dienststelle: string;
  ausstellungsort: string | null;
  erlassAm: string | null;
  mitglieder: number;
  mitgliederQuelle: "verzeichnis" | "schaetzung";
  wahltag: string;
  wahlzeit: string | null;
  wahlraum: string | null;
  auslageVon: string | null;
  auslageBis: string | null;
  auslageOrt: string | null;
  auslageZeiten: string | null;
  einspruchBis: string | null;
  vorschlaegeBis: string | null;
  einreichungsstelle: string | null;
  mindestUnterschriften: number | null;
  bekanntmachungVorschlaegeBis: string | null;
  bekanntmachungsort: string | null;
  auszaehlung: string | null;
  briefwahlHinweis: string | null;
  geschlechterHinweis: boolean;
  /** Anteile von Frauen und Männern an den Wahlberechtigten (§ 9 Abs. 2 Nr. 5 LPVGWO), ab 3 Mitgliedern */
  geschlechterAnteile: string | null;
  /** Sitze für Frauen und Männer (§ 9 Abs. 2 Nr. 6, § 8 LPVGWO), ab 3 Mitgliedern */
  geschlechterSitze: string | null;
}

/** Wo eine fehlende Angabe nachgetragen wird */
export type FehlZiel =
  | { art: "feld"; feld: string } // Feld im Formular auf der Seite Wahlausschreiben
  | { art: "kalender"; frist?: string } // Wahlkalender, optional Zeile einer Frist
  | { art: "vorschlaege"; anker: string } // Seite Wahlvorschläge
  | { art: "seite"; href: string }; // andere Stelle (relativ zur Wahl)

export interface Fehlend {
  label: string;
  ziel: FehlZiel;
}

export interface WahlausschreibenBuild {
  view: WahlausschreibenView;
  fehlend: Fehlend[];
  /** Prüfsumme über den Inhalt – identischer Inhalt ergibt identische Prüfsumme */
  sha256: string;
}

const mitUhrzeit = (iso: string, uhrzeit: string | null) => `${formatIsoDate(iso)}${uhrzeit ? `, ${uhrzeit} Uhr` : ""}`;

export async function buildWahlausschreiben(electionId: string): Promise<WahlausschreibenBuild> {
  const election = await prisma.election.findUniqueOrThrow({ where: { id: electionId }, include: { deadlines: true } });
  const a = parseAngaben(election.wahlausschreibenAngaben);
  const dl = new Map(election.deadlines.map((d) => [d.ruleKey, { iso: fromDbDate(d.datum), uhrzeit: d.uhrzeit }]));
  const [counts, geschlechter] = await Promise.all([voterCounts(electionId), loadGeschlechter(electionId)]);
  const anzahl = counts.wahlberechtigt > 0 ? counts.wahlberechtigt : election.wahlberechtigteSchaetzung;
  const mitglieder = verfahrensauskunft(anzahl).mitglieder;
  const wahltag = fromDbDate(election.wahltag);

  const vorschlaege = dl.get("wahlvorschlaege_ende");
  const auslageBeginn = dl.get("auslage_beginn");
  const auslageEnde = dl.get("auslage_ende");
  const bekanntmachung = dl.get("bekanntmachung_vorschlaege");

  const view: WahlausschreibenView = {
    dienststelle: election.dienststelle,
    ausstellungsort: a.ausstellungsort || null,
    erlassAm: election.wahlausschreibenAm ? formatIsoDate(fromDbDate(election.wahlausschreibenAm)) : null,
    mitglieder,
    mitgliederQuelle: counts.wahlberechtigt > 0 ? "verzeichnis" : "schaetzung",
    wahltag: formatIsoDate(wahltag),
    wahlzeit: a.wahlzeitVon && a.wahlzeitBis ? `${a.wahlzeitVon} bis ${a.wahlzeitBis} Uhr` : null,
    wahlraum: a.wahlraum || null,
    auslageVon: auslageBeginn ? formatIsoDate(auslageBeginn.iso) : null,
    auslageBis: auslageEnde ? formatIsoDate(auslageEnde.iso) : null,
    auslageOrt: a.auslageOrt || null,
    auslageZeiten: a.auslageZeiten || null,
    einspruchBis: auslageEnde?.uhrzeit ? mitUhrzeit(auslageEnde.iso, auslageEnde.uhrzeit) : null,
    vorschlaegeBis: vorschlaege?.uhrzeit ? mitUhrzeit(vorschlaege.iso, vorschlaege.uhrzeit) : null,
    einreichungsstelle: a.einreichungsstelle || null,
    mindestUnterschriften: election.stuetzunterschriftenMin,
    bekanntmachungVorschlaegeBis: bekanntmachung ? formatIsoDate(bekanntmachung.iso) : null,
    bekanntmachungsort: a.bekanntmachungsort || null,
    auszaehlung: a.auszaehlungZeit && a.auszaehlungOrt ? `${formatIsoDate(wahltag)}, ${a.auszaehlungZeit} Uhr, ${a.auszaehlungOrt}` : null,
    briefwahlHinweis: a.briefwahlHinweis || null,
    geschlechterHinweis: mitglieder >= 3,
    geschlechterAnteile: geschlechter.relevant && geschlechter.zaehlung ? anteileText(geschlechter.zaehlung) : null,
    geschlechterSitze:
      geschlechter.relevant && geschlechter.verteilung && !geschlechter.verteilung.losOffen ? sitzeText(geschlechter.verteilung) : null,
  };

  const fehlend: Fehlend[] = [];
  const feld = (label: string, name: string) => fehlend.push({ label, ziel: { art: "feld", feld: name } });
  if (!view.ausstellungsort) feld("Ausstellungsort", "ausstellungsort");
  if (!view.erlassAm) feld("Datum des Erlasses", "wahlausschreibenAm");
  if (!view.wahlzeit) feld(a.wahlzeitVon ? "Wahlzeit bis" : "Wahlzeit von/bis", a.wahlzeitVon ? "wahlzeitBis" : "wahlzeitVon");
  if (!view.wahlraum) feld("Wahlraum", "wahlraum");
  if (!view.auslageVon || !view.auslageBis) fehlend.push({ label: "Auslagezeitraum (Wahlkalender neu berechnen)", ziel: { art: "kalender" } });
  if (!view.auslageOrt) feld("Ort der Auslage", "auslageOrt");
  if (!view.auslageZeiten) feld("Zeiten der Einsichtnahme", "auslageZeiten");
  if (!view.einspruchBis) fehlend.push({ label: "Uhrzeit für das Ende der Einspruchsfrist", ziel: { art: "kalender", frist: "auslage_ende" } });
  if (!view.vorschlaegeBis) fehlend.push({ label: "Uhrzeit für das Ende der Einreichungsfrist", ziel: { art: "kalender", frist: "wahlvorschlaege_ende" } });
  if (!view.einreichungsstelle) feld("Einreichungsstelle für Wahlvorschläge", "einreichungsstelle");
  if (view.mindestUnterschriften == null) fehlend.push({ label: "Mindestzahl der Stützunterschriften", ziel: { art: "vorschlaege", anker: "mindestunterschriften" } });
  if (!view.bekanntmachungsort) feld("Ort der Bekanntmachungen", "bekanntmachungsort");
  if (geschlechter.relevant) {
    const z = geschlechter.zaehlung;
    if (!z) fehlend.push({ label: "Anteile von Frauen und Männern (Wählerverzeichnis anlegen)", ziel: { art: "seite", href: "waehler" } });
    else if (z.ohneAngabe > 0) fehlend.push({ label: `Geschlecht bei ${z.ohneAngabe} Wahlberechtigten nicht erfasst`, ziel: { art: "seite", href: "waehler" } });
    if (geschlechter.verteilung?.losOffen) fehlend.push({ label: "Losentscheid zur Verteilung der Sitze auf Frauen und Männer", ziel: { art: "feld", feld: "geschlechter" } });
  }
  if (!view.auszaehlung) feld(a.auszaehlungZeit ? "Ort der Auszählung" : "Uhrzeit der Auszählung", a.auszaehlungZeit ? "auszaehlungOrt" : "auszaehlungZeit");

  const sha256 = createHash("sha256").update(JSON.stringify(view)).digest("hex");
  return { view, fehlend, sha256 };
}
