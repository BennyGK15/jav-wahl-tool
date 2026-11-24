/**
 * Feldverschlüsselung für sensible Spalten (AES-256-GCM).
 * Format: "v1.<iv>.<tag>.<ciphertext>" (jeweils base64url).
 * Der Schlüssel liegt nur in DATA_ENCRYPTION_KEY, nie in der Datenbank.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY ist nicht gesetzt");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY muss 32 Byte (Base64) lang sein");
  return buf;
}

export function encrypt(plain: string, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string, aad = ""): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unbekanntes Chiffrat-Format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptNullable(plain: string | null | undefined, aad = ""): string | null {
  return plain == null || plain === "" ? null : encrypt(plain, aad);
}

/** Pseudonymisierter Hash (z. B. für IP-Adressen im Audit-Log). */
export function pseudonymize(value: string): string {
  return createHmac("sha256", key()).update(value).digest("hex");
}
