import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { baueApp } from '../src/app.js';
import { neuerVorgangscode } from '../src/fachlich.js';
import { ladeKonfig } from '../src/konfig.js';
import { Meldung } from '../src/modelle/meldung.js';
import { Sitzung } from '../src/modelle/sitzung.js';
import { ladeStadt } from '../src/stadt.js';

export const SCHLUESSEL = 'testschluessel-mit-laenge';
export const stadt = ladeStadt();
export const MARKT = stadt.orte.find((o) => o.name === 'Marktplatz');

const MONGO_BASIS = process.env.OM_TEST_MONGO ?? 'mongodb://127.0.0.1:27017';

/** Real MongoDB, one database per test file. Fails if there is none: nothing is mocked or skipped. */
export async function verbinde(name) {
  await mongoose.connect(`${MONGO_BASIS}/om_test_${name}`, { serverSelectionTimeoutMS: 15000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([Meldung.init(), Sitzung.init()]);
  await Promise.all([Meldung.syncIndexes(), Sitzung.syncIndexes()]);
}

export async function trenne() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function leere() {
  await Promise.all([Meldung.deleteMany({}), Sitzung.deleteMany({})]);
}

export function testKonfig(aenderungen = {}) {
  const konfig = ladeKonfig({ OM_VERWALTUNG_SCHLUESSEL: SCHLUESSEL, OM_COOKIE_SECURE: '0' });
  konfig.grenzen = { meldenJe10Minuten: 1000, anmeldenJe15Minuten: 1000, lesenJeMinute: 100000 };
  return { ...konfig, ...aenderungen };
}

export const testApp = (aenderungen) => baueApp({ konfig: testKonfig(aenderungen), stadt });

export function gueltigeMeldung(aenderungen = {}) {
  return {
    kategorie: 'licht',
    beschreibung: 'Die Laterne flackert.',
    lng: MARKT.lng,
    lat: MARKT.lat,
    ...aenderungen,
  };
}

/** Writes a report straight to the database, with dates chosen by the test. */
export async function legeAn(aenderungen = {}) {
  const { lng = MARKT.lng, lat = MARKT.lat, ortName = 'Marktplatz', ...rest } = aenderungen;
  const eingegangenAm = rest.eingegangenAm ?? new Date();
  const [meldung] = await Meldung.insertMany(
    [
      {
        vorgangscode: neuerVorgangscode(randomBytes),
        kategorie: 'licht',
        beschreibung: 'Die Laterne flackert.',
        ort: { punkt: { type: 'Point', coordinates: [lng, lat] }, name: ortName },
        verlauf: [{ am: eingegangenAm, status: 'neu' }],
        eingegangenAm,
        geaendertAm: eingegangenAm,
        ...rest,
      },
    ],
    { timestamps: false },
  );
  return meldung;
}

/** A point the given number of metres north of the market place. */
export const noerdlichVomMarkt = (meter) => ({
  lng: MARKT.lng,
  lat: MARKT.lat + meter / 111195,
});
