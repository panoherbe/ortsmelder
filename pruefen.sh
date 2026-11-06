#!/usr/bin/env bash
# Runs every check against real containers: lint, formatting, unit tests, MongoDB 7, browser and axe.
# Needs Docker only. Results: pruefung/ergebnis.json
set -euo pipefail
cd "$(dirname "$0")"

C="docker compose -p ortsmelder-pruefen -f compose.pruefen.yaml"
beginn=$(date +%s)

aufraeumen() {
  $C run --rm --no-deps -T code chown -R "$(id -u):$(id -g)" pruefung >/dev/null 2>&1 || true
  $C down -v --remove-orphans >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

rm -rf pruefung
mkdir -p pruefung

$C build
$C run --rm code sh werkzeuge/pruefe-code.sh
$C up -d --wait ortsmelder
$C run --rm e2e
$C run --rm --no-deps -e OM_DAUER_S="$(($(date +%s) - beginn))" -e OM_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || true)" code node werkzeuge/zaehlen.mjs
