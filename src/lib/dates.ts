/** Umrechnung zwischen ISO-Datum ("YYYY-MM-DD") und Prisma-DateTime für @db.Date-Spalten (UTC-Mitternacht). */

export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Heutiges Datum in Deutschland als ISO-String. */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Zeitpunkte in deutscher Ortszeit (Eingang von Wahlvorschlägen, Einsprüchen)
// ---------------------------------------------------------------------------

const TZ = "Europe/Berlin";

/** Abstand der Berliner Ortszeit zu UTC in Minuten zum Zeitpunkt `at` (60 im Winter, 120 im Sommer). */
function berlinOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "2026-03-18T14:05" (Berliner Ortszeit, z. B. aus <input type="datetime-local">) → Date. */
export function berlinLocalToDate(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`Ungültiger Zeitpunkt: ${local}`);
  const naive = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
  let ts = naive - berlinOffsetMinutes(new Date(naive)) * 60_000;
  ts = naive - berlinOffsetMinutes(new Date(ts)) * 60_000; // zweiter Schritt für die Zeitumstellung
  return new Date(ts);
}

/** Date → "2026-03-18 14:05" in Berliner Ortszeit (sortier- und vergleichbar). */
export function toBerlinLocal(d: Date): string {
  const shifted = new Date(d.getTime() + berlinOffsetMinutes(d) * 60_000);
  return shifted.toISOString().slice(0, 16).replace("T", " ");
}

/** Aktuelle Ortszeit für <input type="datetime-local">. */
export function nowBerlinInput(): string {
  return toBerlinLocal(new Date()).replace(" ", "T");
}

const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Date → "Mi., 18.03.2026, 14:05" */
export function formatBerlinDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}
