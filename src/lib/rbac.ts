/** Rollen und Berechtigungen laut Konzept. Prüfung erfolgt IMMER serverseitig. */

export const ROLES = [
  "admin",
  "vorsitz",
  "mitglied",
  "wahlhelfer",
  "datenschutz",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administration (IT)",
  vorsitz: "Vorsitz Wahlvorstand",
  mitglied: "Mitglied Wahlvorstand",
  wahlhelfer: "Wahlhelfer/in",
  datenschutz: "Datenschutzbeauftragte/r",
};

const PERMISSIONS = {
  "users.manage": ["admin"],
  "election.manage": ["vorsitz"],
  "voters.edit": ["vorsitz", "mitglied"],
  "voters.sensitive.read": ["vorsitz", "mitglied"],
  "voters.markVoted": ["vorsitz", "mitglied", "wahlhelfer"],
  "nominations.edit": ["vorsitz", "mitglied"],
  "documents.release": ["vorsitz"],
  "result.finalize": ["vorsitz"],
  "audit.read": ["admin", "vorsitz"],
  "retention.execute": ["admin", "vorsitz"],
  "deadlines.read": ["vorsitz", "mitglied", "wahlhelfer"],
  "deadlines.edit": ["vorsitz", "mitglied"],
  "rules.verify": ["vorsitz"],
  "privacy.manage": ["admin", "vorsitz", "datenschutz"],
  /** Datenschutz-Unterlagen als abgestimmt einreichen bzw. die Einreichung zurückziehen */
  "privacy.submit": ["datenschutz"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
