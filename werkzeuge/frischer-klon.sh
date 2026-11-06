#!/usr/bin/env bash
# Measures the start from a clean clone: no local files, no build cache for this project.
# The base images (node, mongo) are used from the local Docker cache if present; the report says which.
#   werkzeuge/frischer-klon.sh <ausgabe-datei>
set -euo pipefail
QUELLE="$(cd "$(dirname "$0")/.." && pwd)"
AUS="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
ORDNER="$(mktemp -d)"
PORT="${OM_PORT:-18090}"
trap 'cd "$ORDNER/mm" 2>/dev/null && docker compose -p ortsmelder-klon down -v --remove-orphans >/dev/null 2>&1; rm -rf "$ORDNER"' EXIT
git clone -q --no-local "$QUELLE" "$ORDNER/mm"
cd "$ORDNER/mm"
{
  echo "Datum: $(TZ=Europe/Berlin date '+%d.%m.%Y %H:%M %Z')"
  echo "Commit: $(git rev-parse --short HEAD)"
  echo "Rechner: $(uname -sm), Docker $(docker version --format '{{.Server.Version}}')"
  echo "Dateien im Klon außerhalb von Git: $(git status --porcelain --ignored | wc -l | tr -d ' ')"
  echo "Basis-Images lokal vorhanden: node:22-alpine, mongo:7 (nicht mitgemessen)"
  beginn=$(date +%s)
  docker compose -p ortsmelder-klon build --no-cache --quiet ortsmelder >/dev/null 2>&1
  gebaut=$(date +%s)
  OM_PORT="$PORT" docker compose -p ortsmelder-klon up -d --wait >/dev/null 2>&1
  ende=$(date +%s)
  echo "Bauen ohne Cache: $((gebaut - beginn)) s"
  echo "Start bis gesund: $((ende - gebaut)) s"
  echo "Gesamt: $((ende - beginn)) s"
  echo "GET /api/gesund: $(curl -s "http://127.0.0.1:$PORT/api/gesund")"
  echo "GET /: HTTP $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
  C="$(mktemp)"
  echo "Anmeldung mit dem Demo-Schlüssel: HTTP $(curl -s -o /dev/null -w '%{http_code}' -c "$C" -H 'Content-Type: application/json' -d '{"schluessel":"demo-verwaltung"}' "http://127.0.0.1:$PORT/api/verwaltung/anmelden")"
  echo "Meldungen in der Liste: $(curl -s -b "$C" "http://127.0.0.1:$PORT/api/verwaltung/meldungen" | python3 -c 'import json,sys; print(json.load(sys.stdin)["gesamt"])')"
  rm -f "$C"
  echo "Container: $(docker compose -p ortsmelder-klon ps --format '{{.Service}}={{.Status}}' | tr '\n' ' ')"
  echo "MongoDB-Version: $(docker compose -p ortsmelder-klon exec -T mongo mongod --version | head -1)"
} | tee "$AUS"
