import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { baueApp } from './app.js';
import { fuelleDemoDaten } from './demo.js';
import { ladeKonfig } from './konfig.js';
import { Meldung } from './modelle/meldung.js';
import { Sitzung } from './modelle/sitzung.js';
import { ladeStadt } from './stadt.js';

const konfig = ladeKonfig();
konfig.webVerzeichnis ??= fileURLToPath(new URL('../../web/dist', import.meta.url));
const stadt = ladeStadt(konfig.stadtDatei);

await mongoose.connect(konfig.mongoUrl, { serverSelectionTimeoutMS: 15000 });
await Promise.all([Meldung.init(), Sitzung.init()]);

if (konfig.demo) {
  const angelegt = await fuelleDemoDaten(stadt);
  if (angelegt) console.log(`Demo-Daten angelegt: ${angelegt} erfundene Meldungen.`);
}

const server = baueApp({ konfig, stadt }).listen(konfig.port, () => {
  console.log(`Ortsmelder läuft auf Port ${konfig.port}${konfig.demo ? ' (Demo)' : ''}.`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  });
}
