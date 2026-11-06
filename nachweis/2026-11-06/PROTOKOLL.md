# Messprotokoll 06.11.2026

Gemessen auf einem Mac mit Apple-Prozessor (`linux/arm64` in den Containern), Docker 29.2.1, MongoDB 7.0.45, Node.js 22.

| Datei               | Was                                                                                     | Befehl                               |
| ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| `ergebnis.json`     | Testzahlen je Gruppe, axe je Ansicht und Fensterbreite, Laufzeit bei vorhandenen Images | `./pruefen.sh`                       |
| `frischer-klon.txt` | Bau ohne Cache und Start aus einem sauberen Klon                                        | `werkzeuge/frischer-klon.sh <datei>` |
| `medien.txt`        | Größe und Dauer des Rundgangs                                                           | `ffprobe`, `wc -c`                   |

Stand der Messung: Commit `b02c519`. Spätere Commits ändern nur README, Rundgang und diesen Ordner.

Aus demselben Stand: 22 gezielte Mutationen im Container gegen echtes MongoDB 7; jede lässt mindestens einen Test scheitern.

GitHub Actions (`ubuntu-24.04`): Lauf 42250634784 auf Commit `cac93a7`, `./pruefen.sh` grün, dieselben 195 Tests und 18 axe-Prüfungen ohne Verstoß, 152 s.

Grenzen dieser Messung:

- Die Zeit für den Start setzt voraus, dass `node:22-alpine` und `mongo:7` schon lokal liegen. Das Herunterladen hängt
  von der Leitung ab und ist nicht mitgemessen.
- `./pruefen.sh` lädt beim ersten Mal zusätzlich das Browser-Image. Bei rund 1 MB/s dauerte das am 06.11.2026 etwa zehn
  Minuten.
- axe findet nur den automatisch prüfbaren Teil der WCAG. Ein Test mit echten Screenreadern fand nicht statt.
- Last, große Datenmengen und andere Browser als Chromium sind nicht gemessen.
