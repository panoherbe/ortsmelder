#!/usr/bin/env bash
# Records the walkthrough against the real stack and encodes it into medien/.
#   werkzeuge/rundgang/aufnehmen.sh <nachweis-ordner mit ergebnis.json>
set -euo pipefail
cd "$(dirname "$0")/../.."
export NACHWEIS="$(cd "$1" && pwd)"
C="docker compose -p ortsmelder-rundgang -f compose.pruefen.yaml -f werkzeuge/rundgang/compose.rundgang.yaml"
trap '$C down -v --remove-orphans >/dev/null 2>&1 || true' EXIT
rm -rf werkzeuge/rundgang/aus
mkdir -p werkzeuge/rundgang/aus medien/bilder
$C build ortsmelder aufnahme
$C up -d --wait ortsmelder
$C run --rm aufnahme
werkzeuge/rundgang/kodieren.sh werkzeuge/rundgang/aus medien
cp werkzeuge/rundgang/aus/kapitel.json medien/kapitel.json
cp werkzeuge/rundgang/aus/bilder/*.png medien/bilder/
