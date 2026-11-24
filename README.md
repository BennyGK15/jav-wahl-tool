# JAV-Wahl-Tool

Plantool für den Wahlvorstand einer Wahl zur Jugend- und Auszubildendenvertretung (JAV)
im öffentlichen Dienst Baden-Württemberg (LPVG BW, LPVGWO).

**Stand:** Code-Grundgerüst (Version 0.1). Fertig sind Login, Rollen, Datenbankschema,
Feldverschlüsselung, Sicherheits-Header und der Fristenrechner. Die Fachmodule
Wählerverzeichnis, Wahlvorschläge und Ergebnis folgen.

> **Rechtlicher Hinweis:** Alle Fristwerte stammen aus einer Vorrecherche und sind als
> „ungeprüft" markiert. Vor dem Einsatz gegen die amtliche Fassung der LPVGWO
> (landesrecht-bw.de) prüfen. Die App ersetzt keine Rechtsberatung.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · shadcn/ui · better-auth 1.7
(Benutzername + Passwort) · Prisma ORM 7 (MariaDB-Treiberadapter) · MariaDB 11 / MySQL 8 · Zod · Vitest

## Erste Schritte

Voraussetzung: Node.js ≥ 20.9 (empfohlen 22), pnpm (z. B. `corepack enable pnpm`) und eine erreichbare
MariaDB-/MySQL-Datenbank mit eigenem Benutzer (nicht root).

```bash
pnpm install                     # erzeugt pnpm-lock.yaml und pinnt die Versionen
cp .env.example .env.local       # DATABASE_URL eurer DB eintragen, Secrets so erzeugen:
openssl rand -base64 32          #  → BETTER_AUTH_SECRET
openssl rand -base64 32          #  → DATA_ENCRYPTION_KEY

pnpm typecheck && pnpm test      # zuerst prüfen (siehe unten)

pnpm db:migrate --name init      # Client generieren, Migration erzeugen und anwenden
                                 # (Prisma 7 generiert nach `migrate dev` nicht mehr automatisch)

pnpm user:create admin admin "IT-Administration"
pnpm user:create m.muster vorsitz "Max Muster"

pnpm dev                         # http://localhost:3000
```

Beim ersten Login muss jedes Konto sein Startpasswort ändern.

### Wichtig beim ersten `pnpm install`

Das Gerüst wurde ohne Zugriff auf die npm-Registry geschrieben. Die reine Logik
(Fristen, Feldverschlüsselung) ist mit Node getestet, der Rest noch nicht kompiliert.
Bitte nach `pnpm install` einmal ausführen:

1. `pnpm typecheck`: Typfehler zeigen eventuelle API-Abweichungen der installierten Versionen.
2. `pnpm test`: Fristen, Wahlberechtigung, Verschlüsselung, Rollen.
3. `pnpm auth:schema-check`: erzeugt das better-auth-Schema zum Vergleich mit `prisma/schema.prisma`.
4. `pnpm build`

## Struktur

```
src/
  app/
    login/              Anmeldung (Benutzername + Passwort)
    passwort/           Passwort ändern (beim ersten Login erzwungen)
    (app)/              geschützter Bereich: Übersicht, Fristenrechner
    api/auth/[...all]/  better-auth-Endpunkte
  components/ui/        shadcn/ui-Komponenten (weitere: `pnpm dlx shadcn@latest add …`)
prisma/schema.prisma    (liegt im Projektwurzelordner) better-auth-Tabellen + Fachdaten
  generated/prisma/     generierter Prisma-Client (nicht einchecken, entsteht bei `pnpm install`)
  lib/
    fristen/            Fristenrechner (Arbeitstage, Feiertage BW, BGB) + Tests
    jav.ts              Wahlberechtigung, Wählbarkeit, JAV-Größe + Tests
    auth.ts             better-auth-Konfiguration
    session.ts          requireSession / requirePermission
    rbac.ts             Rollen und Berechtigungen
    crypto.ts           AES-256-GCM-Feldverschlüsselung
    audit.ts            Audit-Log (nur Feldnamen, keine Inhalte)
  proxy.ts              CSP mit Nonce, Login-Weiterleitung
scripts/create-user.ts  Konten anlegen
```

## Rollen

| Rolle | Darf |
| --- | --- |
| admin | Konten verwalten, Audit-Log lesen – **keine** Wahldaten |
| vorsitz | alles rund um die Wahl, Freigaben, Ergebnis |
| mitglied | Wählerverzeichnis und Wahlvorschläge bearbeiten |
| wahlhelfer | nur Stimmabgabe vermerken |

## Datenschutz und Sicherheit (umgesetzt)

- Keine Selbstregistrierung; Konten nur per Skript bzw. durch den Admin
- Passwörter mind. 12 Zeichen, gehasht durch better-auth (scrypt)
- Rate-Limit in der DB: 5 Anmeldeversuche je 5 Minuten, generische Fehlermeldung
- Sitzung in der DB, Cookie `HttpOnly`, `SameSite=Strict`, `Secure` in Produktion, max. 8 Stunden
- Jede Seite und jede Server Action prüft Sitzung und Rolle serverseitig
- CSP mit Nonce, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
- Geburtsdatum, Ausbildungsende und Einspruchsbegründung AES-256-GCM-verschlüsselt
- Audit-Log ohne Inhalte, IP-Adressen nur als HMAC
- Keine externen Skripte, Schriften oder Analytics
- Löschung je Wahl per Kaskade (Feld `retention_until`)

## Offen

- [ ] Fristwerte gegen die amtliche LPVGWO prüfen und als geprüft markieren
- [ ] Aufbewahrungsdauer mit der/dem Datenschutzbeauftragten festlegen; Verzeichnis der Verarbeitungstätigkeiten
- [ ] Kontosperre nach Fehlversuchen (aktuell nur Rate-Limit)
- [ ] Optional 2. Faktor (better-auth `twoFactor`-Plugin) für den Vorsitz
- [ ] Module Wählerverzeichnis, Wahlvorschläge, Bekanntmachungen (PDF), Ergebnis
- [ ] Backups verschlüsselt, Wiederherstellung testen
