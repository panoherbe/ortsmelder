// Adds up what the test runners wrote into pruefung/ and fails if anything failed or was skipped.
import { readFileSync, writeFileSync } from 'node:fs';

const AUS = process.env.OM_PRUEFUNG ?? 'pruefung';
const lies = (name) => JSON.parse(readFileSync(`${AUS}/${name}`, 'utf8'));

function vitest(bericht, filter = () => true) {
  const ergebnis = { bestanden: 0, fehlgeschlagen: 0, uebersprungen: 0 };
  for (const datei of bericht.testResults.filter((d) => filter(d.name))) {
    for (const test of datei.assertionResults) {
      if (test.status === 'passed') ergebnis.bestanden += 1;
      else if (test.status === 'failed') ergebnis.fehlgeschlagen += 1;
      else ergebnis.uebersprungen += 1;
    }
  }
  return ergebnis;
}

function playwright(bericht) {
  return {
    bestanden: bericht.stats.expected,
    fehlgeschlagen: bericht.stats.unexpected + bericht.stats.flaky,
    uebersprungen: bericht.stats.skipped,
  };
}

const api = lies('api.json');
const axe = readFileSync(`${AUS}/axe.jsonl`, 'utf8')
  .trim()
  .split('\n')
  .map((zeile) => JSON.parse(zeile));

const gruppen = {
  oberflaeche: vitest(lies('web.json')),
  api_einheiten: vitest(api, (name) => name.includes('/einheit/')),
  api_echtes_mongodb: vitest(api, (name) => name.includes('/mongo/')),
  browser: playwright(lies('e2e.json')),
};
const summe = (feld) => Object.values(gruppen).reduce((s, g) => s + g[feld], 0);

const ergebnis = {
  datum: new Date().toISOString(),
  datum_de: new Date().toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  laufzeit_s: Number(process.env.OM_DAUER_S ?? 0),
  commit: process.env.OM_COMMIT || null,
  node: process.version,
  plattform: `${process.platform}/${process.arch}`,
  gruppen,
  gesamt: {
    bestanden: summe('bestanden'),
    fehlgeschlagen: summe('fehlgeschlagen'),
    uebersprungen: summe('uebersprungen'),
  },
  axe: {
    pruefungen: axe.length,
    verstoesse: axe.reduce((s, a) => s + a.verstoesse.length, 0),
    regeln: 'wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa',
    ansichten: axe,
  },
};

writeFileSync(`${AUS}/ergebnis.json`, `${JSON.stringify(ergebnis, null, 2)}\n`);

console.log('');
for (const [name, g] of Object.entries(gruppen)) {
  console.log(`${name.padEnd(22)} ${g.bestanden} bestanden, ${g.fehlgeschlagen} fehlgeschlagen`);
}
console.log(`${'gesamt'.padEnd(22)} ${ergebnis.gesamt.bestanden} bestanden`);
console.log(
  `${'axe'.padEnd(22)} ${ergebnis.axe.pruefungen} Prüfungen, ${ergebnis.axe.verstoesse} Verstöße`,
);
console.log(`${'Laufzeit'.padEnd(22)} ${ergebnis.laufzeit_s} s`);

if (ergebnis.gesamt.fehlgeschlagen || ergebnis.gesamt.uebersprungen || ergebnis.axe.verstoesse) {
  process.exit(1);
}
