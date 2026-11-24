# Sicherheitsrichtlinie

Das JAV-Wahl-Tool verarbeitet personenbezogene Daten von Beschäftigten. Hinweise auf
Sicherheitslücken sind deshalb ausdrücklich willkommen.

## Sicherheitslücke melden

Bitte melde Sicherheitslücken **nicht** über öffentliche Issues, Pull Requests oder
Diskussionen, sondern vertraulich über die private Meldefunktion von GitHub:

**Reiter „Security“ → „Report a vulnerability“**

Hilfreich sind:

- betroffene Komponente, Seite oder Server Action
- Schritte zur Reproduktion bzw. ein Proof of Concept
- eingeschätzte Auswirkung (z. B. Zugriff auf fremde Wahldaten, Umgehung von Rollen)
- verwendete Version (Commit) und Betriebsumgebung

Bitte verwende ausschließlich Testdaten und füge keine echten personenbezogenen Daten,
Zugangsdaten oder Schlüssel in die Meldung ein.

## Ablauf

Es handelt sich um ein privates, experimentelles Projekt ohne zugesicherte Reaktionszeiten.
Meldungen werden nach bestem Vermögen geprüft. In der Regel:

1. Bestätigung des Eingangs
2. Bewertung und Rückmeldung, ob und wie die Lücke behoben wird
3. Behebung und Veröffentlichung eines Sicherheitshinweises (GitHub Security Advisory),
   auf Wunsch mit Nennung der meldenden Person

Bitte gib vor einer Veröffentlichung angemessen Zeit zur Behebung.

## Unterstützte Versionen

Sicherheitskorrekturen erfolgen nur für den aktuellen Stand des Branches `main`.
Ältere Stände werden nicht gepflegt.

## Geltungsbereich

**Im Geltungsbereich**

- Umgehung von Anmeldung, Zwei-Faktor-Anmeldung, Kontosperre oder Rollenprüfung
- unberechtigter Zugriff auf oder Veränderung von Wahldaten
- Schwächen der Feldverschlüsselung oder des Audit-Logs
- Injection, XSS, CSRF und Umgehung der Content-Security-Policy
- unsichere Standardkonfiguration in diesem Repository (z. B. `Dockerfile`, `.env.example`)

**Nicht im Geltungsbereich**

- Fehler in der rechtlichen Bewertung (Fristen, Muster, Wahlverfahren) – bitte als normales Issue melden
- Schwachstellen in Abhängigkeiten ohne nachweisbare Auswirkung auf dieses Projekt – bitte direkt beim jeweiligen Projekt melden
- Fehlkonfigurationen einer eigenen Installation (z. B. fehlendes HTTPS, offene Datenbank)
- Denial-of-Service durch große Datenmengen oder Last
- Social Engineering und physischer Zugriff

## Hinweis für Betreibende

Das Tool ist nicht für den produktiven Einsatz freigegeben (siehe [README](README.md)).
Wer es dennoch betreibt, ist selbst für sicheren Betrieb, Datensicherung, Updates und die
datenschutzrechtliche Prüfung verantwortlich.
