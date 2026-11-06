# Ortsmelder: Changelog

> Änderungen mit Datum, Grund und Prüfung, das Neueste oben. Aktueller Stand:
> [`ORTSMELDER-HANDOVER.md`](ORTSMELDER-HANDOVER.md).

## 2026-11-06: Das Projekt heißt jetzt Ortsmelder

- **Was:** Neuer Name in Oberfläche, Texten, Tests, Medien, Docs, Paketen und Umgebungsvariablen (`OM_…`, Cookie
  `om_sitzung`). Das Repo heißt `panoherbe/ortsmelder`. Frühere Commits bleiben, wie sie sind.
- **Wie geprüft:** `./pruefen.sh`, neue Aufnahme, neue Messung in `nachweis/2026-11-06/`, CI.
- **Rückweg:** `git revert`, GitHub-Repo zurückbenennen. Wer eine eigene `.env` hat, stellt sie auf `OM_…` um.

## 2026-11-06: Befunde der unabhängigen Prüfung behoben

- **Was:** Nach einem Konflikt zeigt das Formular jetzt den fremden Stand, statt ihn beim nächsten Klick zu überschreiben.
  Liste und Detail verwerfen veraltete Antworten, „Mehr laden“ lädt nur einmal. Ausfälle der Sitzungsprüfung ergeben keine
  leere Seite mehr. Änderungen ohne Inhalt schreiben keinen Verlauf; öffentlich erscheinen nur echte Statuswechsel. Ein
  neuer Verwaltungsschlüssel beendet alle Sitzungen. Die Bearbeitungszeit rechnet in Minuten statt nach Stundengrenzen.
  Die öffentliche Umkreissuche rundet auf 10 m und antwortet außerhalb der Stadt leer. Abgewiesene Eingaben zählen nicht
  gegen die Aufrufbegrenzung. `.env.example` enthält keinen startfähigen Schlüssel mehr.
- **Warum:** Ein unabhängiger Prüfer fand per Beweislauf 2 schwere, 8 mittlere und 15 leichte Befunde; 10 von 33 Mutationen
  überlebten die Tests. Bewusst offen, siehe Handover Abschnitt 9: Antworttext geht beim Sitzungsablauf verloren, nach
  10 Fehlversuchen bleibt die Anmeldung 15 Minuten zu, der Köderfeld-Fehler ist nur für Bots gedacht.
- **Wie geprüft:** `./pruefen.sh`, Zahlen in `nachweis/2026-11-06/`. Dazu 22 gezielte Mutationen im Container gegen echtes
  MongoDB 7, darunter neun der zehn überlebenden des Prüfers (den zehnten, die Leerzeichenprüfung im Formular, fängt der
  Server ab): Alle lassen mindestens einen Test scheitern.
- **Rückweg:** `git revert`.

## 2026-11-06: Erste Fassung

- **Was:** Meldeformular mit Karte, Stand zum Code, Verwaltung mit Liste, Karte, Kennzahlen, Stand und Antwort. Vue 3,
  Node.js 22, Express 5, MongoDB 7, Docker Compose. Tests, Rundgang, README.
- **Warum:** Ein kleines, echtes Werkzeug, das Vue und MongoDB im Einsatz zeigt und das jede Person selbst starten kann.
- **Wie geprüft:** `./pruefen.sh`, Belege in `nachweis/2026-11-06/`. Dabei gefunden und behoben: Der Fokus sprang beim
  ersten Seitenwechsel nicht in den Inhalt; der Header Cross-Origin-Opener-Policy erzeugte über einfaches HTTP einen
  Konsolenfehler und kommt jetzt nur noch mit HTTPS.
- **Rückweg:** `git revert`; Daten liegen nur im Compose-Volume.
