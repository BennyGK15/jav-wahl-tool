import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./crypto";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("Feldverschlüsselung", () => {
  it("verschlüsselt und entschlüsselt", () => {
    const c = encrypt("2009-06-01", "voter:1");
    expect(c).not.toContain("2009");
    expect(decrypt(c, "voter:1")).toBe("2009-06-01");
  });
  it("erzeugt bei gleichem Klartext unterschiedliche Chiffrate", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });
  it("erkennt Manipulation und falschen Kontext", () => {
    const c = encrypt("geheim", "voter:1");
    expect(() => decrypt(c, "voter:2")).toThrow();
    const parts = c.split(".");
    parts[3] = Buffer.from("manipuliert").toString("base64url");
    expect(() => decrypt(parts.join("."), "voter:1")).toThrow();
  });
});
