#!/bin/sh
# Inside the "code" container of compose.pruefen.yaml.
set -e
A=/w/pruefung

echo '== ESLint'
npx eslint . --max-warnings=0
echo '== Prettier'
npx prettier --check .
echo '== Tests Oberfläche (jsdom)'
(cd web && npx vitest run --reporter=default --reporter=json --outputFile.json="$A/web.json")
echo '== Tests API (Einheiten und echtes MongoDB)'
(cd api && npx vitest run --reporter=default --reporter=json --outputFile.json="$A/api.json")
