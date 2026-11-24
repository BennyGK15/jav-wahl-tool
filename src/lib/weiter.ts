/**
 * Rücksprungziel nach der Anmeldung absichern: nur Pfade dieser Anwendung, keine fremden Adressen
 * („//host“, „/\\host“, Schemata) und nicht zurück zum Login. Sonst die Startseite.
 */
export function sicheresZiel(weiter: unknown): string {
  if (typeof weiter !== "string" || weiter.length > 500) return "/";
  if (!weiter.startsWith("/") || weiter.startsWith("//") || weiter.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(weiter)) return "/";
  if (weiter === "/login" || weiter.startsWith("/login/") || weiter.startsWith("/login?") || weiter.startsWith("/api/")) return "/";
  return weiter;
}
