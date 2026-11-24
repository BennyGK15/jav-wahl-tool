/**
 * Anteilige Vertretung von Frauen und Männern in der JAV (§ 62 Abs. 1 i. V. m. § 11 Abs. 1 und 3 LPVG,
 * § 8 i. V. m. § 7 Abs. 2 LPVGWO). Gilt erst ab drei Mitgliedern. Reine Funktionen.
 *
 * Der Wahlvorstand stellt fest, wie hoch der Anteil der Frauen und der Männer an den in der Regel
 * Beschäftigten i. S. v. § 59 LPVG ist, und verteilt die Sitze nach d'Hondt auf die Geschlechter.
 * Ist bei gleichen Höchstzahlen nur noch ein Sitz zu vergeben, entscheidet das Los.
 * Personen mit Geschlechtseintrag „divers“ oder ohne Angabe sind im Gesetz nicht geregelt; sie werden
 * gesondert ausgewiesen und bei der Verteilung nicht berücksichtigt.
 */
import { dHondt, type Hoechstzahl } from "./ergebnis";

export type GeschlechtFM = "w" | "m";

export interface GeschlechterZaehlung {
  frauen: number;
  maenner: number;
  divers: number;
  ohneAngabe: number;
}

export interface GeschlechterVerteilung {
  sitzeFrauen: number;
  sitzeMaenner: number;
  /** Gleichstand um den letzten Sitz, über den noch nicht gelost wurde */
  losOffen: boolean;
  hoechstzahlen: Hoechstzahl[];
}

/** Ab drei Mitgliedern gilt die anteilige Vertretung (§ 11 Abs. 1 LPVG). */
export function geschlechterRelevant(sitze: number): boolean {
  return sitze >= 3;
}

/**
 * Sitze für Frauen und Männer nach d'Hondt (§ 7 Abs. 2 LPVGWO entsprechend).
 * `los` = Gewinner eines bereits durchgeführten Losentscheids. null, wenn unter drei Sitzen.
 */
export function geschlechterSitze(z: Pick<GeschlechterZaehlung, "frauen" | "maenner">, sitze: number, los?: GeschlechtFM): GeschlechterVerteilung | null {
  if (!geschlechterRelevant(sitze)) return null;
  const platzhalter = Array.from({ length: sitze }, (_, i) => String(i));
  const losReihenfolge = los ? [los, los === "w" ? "m" : "w"] : [];
  const r = dHondt(
    [
      { id: "w", stimmen: z.frauen, bewerber: platzhalter },
      { id: "m", stimmen: z.maenner, bewerber: platzhalter },
    ],
    sitze,
    losReihenfolge,
  );
  return { sitzeFrauen: r.sitzeJeListe.w ?? 0, sitzeMaenner: r.sitzeJeListe.m ?? 0, losOffen: r.los !== null, hoechstzahlen: r.hoechstzahlen };
}

const prozent = (teil: number, ganz: number) =>
  ganz > 0 ? `${((teil / ganz) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : "–";

/** „12 Frauen (40 %) und 18 Männer (60 %)“ */
export function anteileText(z: GeschlechterZaehlung): string {
  const basis = z.frauen + z.maenner;
  return `${z.frauen} ${z.frauen === 1 ? "Frau" : "Frauen"} (${prozent(z.frauen, basis)}) und ${z.maenner} ${z.maenner === 1 ? "Mann" : "Männer"} (${prozent(z.maenner, basis)})`;
}

/** „2 Frauen und 1 Mann“ */
export function sitzeText(v: Pick<GeschlechterVerteilung, "sitzeFrauen" | "sitzeMaenner">): string {
  const f = `${v.sitzeFrauen} ${v.sitzeFrauen === 1 ? "Frau" : "Frauen"}`;
  const m = `${v.sitzeMaenner} ${v.sitzeMaenner === 1 ? "Mann" : "Männer"}`;
  return `${f} und ${m}`;
}

/**
 * Prüfung eines Wahlvorschlags nach § 12 Abs. 2, § 15 Abs. 1 Nr. 6 und Abs. 5 Nr. 7 LPVGWO:
 * Er muss mindestens so viele Frauen und Männer enthalten, wie Sitze auf sie entfallen sollen –
 * oder die Abweichung schriftlich begründen.
 */
export function pruefeGeschlechter(args: {
  verteilung: Pick<GeschlechterVerteilung, "sitzeFrauen" | "sitzeMaenner">;
  bewerber: { geschlecht: "w" | "m" | "d" | null }[];
  begruendung: string | null;
}): { status: "ok" | "fehler" | "hinweis"; text: string } {
  const { verteilung: v, bewerber, begruendung } = args;
  const frauen = bewerber.filter((b) => b.geschlecht === "w").length;
  const maenner = bewerber.filter((b) => b.geschlecht === "m").length;
  const ohne = bewerber.filter((b) => b.geschlecht == null).length;
  const fehlt: string[] = [];
  if (frauen < v.sitzeFrauen) fehlt.push(`${v.sitzeFrauen - frauen} ${v.sitzeFrauen - frauen === 1 ? "Frau" : "Frauen"}`);
  if (maenner < v.sitzeMaenner) fehlt.push(`${v.sitzeMaenner - maenner} ${v.sitzeMaenner - maenner === 1 ? "Mann" : "Männer"}`);
  const soll = `erforderlich sind mindestens ${sitzeText(v)}`;
  if (fehlt.length === 0) return { status: "ok", text: `Frauen und Männer ausreichend benannt (${frauen} Frauen, ${maenner} Männer; ${soll}).` };
  if (ohne > 0) {
    return { status: "hinweis", text: `Geschlecht bei ${ohne} Bewerber/innen nicht erfasst – anteilige Vertretung prüfen (${soll}).` };
  }
  if (begruendung?.trim()) {
    return { status: "ok", text: `Es fehlen ${fehlt.join(" und ")} (${soll}); die Abweichung ist schriftlich begründet (§ 12 Abs. 2 Satz 2 LPVGWO).` };
  }
  return {
    status: "fehler",
    text: `Es fehlen ${fehlt.join(" und ")} (${soll}) und es liegt keine schriftliche Begründung vor – ungültig nach § 15 Abs. 5 Nr. 7 LPVGWO.`,
  };
}
