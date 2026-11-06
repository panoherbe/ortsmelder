# Ortsmelder: Handover

> Aktueller Stand, wird an Ort und Stelle geändert. Änderungen stehen in
> [`ORTSMELDER-CHANGELOG.md`](ORTSMELDER-CHANGELOG.md), eingetragen in [`SSOT-INDEX.md`](SSOT-INDEX.md).
> Geschrieben für jemanden ohne Vorwissen. Gemessenes ist belegt unter `nachweis/`, alles andere als Annahme markiert.
>
> **Stand:** 2026-11-06

## 1. Auf einen Blick

Bürgerinnen und Bürger melden einen Mangel im öffentlichen Raum mit Kategorie, Ort und Text und bekommen einen Code, mit
dem sie den Stand sehen. Eine Verwaltung sieht Liste, Karte und Kennzahlen, setzt den Stand und antwortet. Die Stadt
„Musterstadt“ und alle Meldungen sind erfunden.

Stapel: Vue 3 (Vite, Vitest), Node.js 22 (Express 5), MongoDB 7 (Mongoose), Docker Compose. Lizenz EUPL-1.2.

## 2. Rechner und Zugang

Läuft überall, wo Docker läuft, keine Dienste Dritter. GitHub: `panoherbe/ortsmelder`, Sichtbarkeit steht in
Abschnitt 8. Geheimnisse: nur `OM_VERWALTUNG_SCHLUESSEL` im echten Betrieb, liegt in `.env` (nicht im Repo).

## 3. Aufbau

| Pfad                                | Was                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `api/src/app.js`                    | Express: Sicherheits-Header, Grenzen, Routen, Auslieferung der Oberfläche |
| `api/src/routen/oeffentlich.js`     | Grundlagen, Melden, Umkreis, Stand zum Code                               |
| `api/src/routen/verwaltung.js`      | Anmeldung, Liste, Detail, Änderung, Kennzahlen                            |
| `api/src/abfragen.js`               | die zwei Aggregationen: `$geoNear` und `$facet` mit `$median`             |
| `api/src/modelle/`                  | Mongoose-Schemas und Indizes                                              |
| `api/stadt/musterstadt.json`        | Grenzen, Orte, Kartenzeichnung                                            |
| `web/src/seiten/`, `web/src/teile/` | Vue-Seiten und -Bausteine, `karte.js` rechnet die Projektion              |
| `e2e/tests/`                        | Browser und axe gegen den fertigen Stapel                                 |
| `werkzeuge/rundgang/`               | Aufnahme von Video und Bildern unter `medien/`                            |

Datenfluss: Das Formular sendet JSON an `POST /api/meldungen`. Der Server prüft mit zod, bestimmt den nächsten
benannten Ort und speichert einen GeoJSON-Punkt (Länge vor Breite). `GET /api/meldungen/nahe` nutzt `$geoNear` auf dem
2dsphere-Index und gibt nur Kategorie, Stand, Ortsname und auf 10 m gerundete Entfernung heraus, nie den Freitext. Änderungen der Verwaltung laufen
als atomares `findOneAndUpdate` mit der Version im Filter; wer eine veraltete Version sendet, bekommt 409.

Sitzungen: Ein Zufalls-Token im HttpOnly-Cookie (SameSite=Strict, Pfad `/api/verwaltung`), in MongoDB nur als HMAC mit
dem Verwaltungsschlüssel, sodass ein neuer Schlüssel alle Sitzungen beendet. Ablauf über einen TTL-Index.

## 4. Geplante Läufe

Keine. GitHub Actions läuft bei jedem Push auf `main` und führt `./pruefen.sh` aus (zuletzt gemessen: Lauf 42250634784 auf `cac93a7`, grün).

## 5. Läuft es?

```bash
docker compose up --build -d --wait
curl -s localhost:8080/api/gesund
./pruefen.sh
```

Erwartet: `{"status":"ok"}`, danach eine Zusammenfassung ohne Fehlschlag in `pruefung/ergebnis.json`.

## 6. Runbooks

- **Start, Stopp, Löschen:** `docker compose up --build -d --wait`, `docker compose down`, mit Daten `down -v`.
- **Echter Betrieb:** [`BETRIEB.md`](BETRIEB.md).
- **Rundgang neu aufnehmen:** Nach `./pruefen.sh` den Ordner `pruefung/` nach `nachweis/<Datum>/` kopieren, dann
  `werkzeuge/rundgang/aufnehmen.sh nachweis/<Datum>`. Die Karte mit den Zahlen liest `ergebnis.json`.
- **Zurück auf einen Stand:** `git revert <commit>`; Daten liegen nur im Compose-Volume `mongo-daten`.

## 7. Fallen

- `mongoose.set('sanitizeFilter', true)` passt nicht zu diesem Code: Es umschließt auch eigene Operatoren wie `$gt` und
  `$ne` und bricht Anmeldung und Listen. Der Schutz kommt aus zod und festen Typen je Route.
- Im Aufnahme-Container ist ein Dienstname auf `.app` in Chrome nicht erreichbar (HSTS-Preload). Der Dienst heißt
  deshalb `ortsmelder`.
- Das GitHub-Image `mcr.microsoft.com/playwright` muss exakt zur Version von `@playwright/test` passen (`1.56.0`).
- Axe nur headless und mit fertig geladenen Schriften messen, sonst stimmen die Kontraste nicht.
- Die Karte zeigt eine gezeichnete Beispielstadt und lädt nichts von außen. Das ist Absicht (strenge CSP, kein Abfluss
  von Adressen an Kartendienste).

## 8. Offene Fragen

- Öffentlich schalten entscheidet der Inhaber. Bis dahin ist das Repo privat.

## 9. Risiken

- Der eine Verwaltungsschlüssel unterscheidet keine Personen; der Verlauf nennt daher keine Bearbeitenden.
- Die Aufrufbegrenzung zählt je Prozess im Speicher (siehe `BETRIEB.md`).
- Läuft die Sitzung beim Tippen ab, führt die Oberfläche zur Anmeldung, und der eben getippte Antworttext ist weg.
- Die Karte der Verwaltung zeigt die neuesten 100 Treffer und sagt das dazu; bei sehr vielen offenen Meldungen braucht
  sie eine Gruppierung.
- Nach 10 Fehlversuchen bleibt die Anmeldung für 15 Minuten je Adresse zu, auch für den richtigen Schlüssel.
- Nicht gemessen: Verhalten unter Last, viele tausend Meldungen, echte Screenreader.

## 10. Nächste Schritte

Rollen je Person, Fotos an Meldungen, Benachrichtigung per E-Mail, echte Kartengrundlage, Löschfristen.

## 11. Glossar

- **Vorgangscode:** Zehn Zeichen (`XXXX-XXXX-XX`), ohne die Buchstaben I, L, O und U, die leicht verwechselt werden.
- **Schwerpunkt:** benannter Ort mit den meisten offenen Meldungen.
- **Köderfeld:** Unsichtbares Feld; wer es ausfüllt, ist vermutlich ein Bot.
