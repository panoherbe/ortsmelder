import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { meldungenImUmkreis } from '../../src/abfragen.js';
import { Meldung } from '../../src/modelle/meldung.js';
import { Sitzung } from '../../src/modelle/sitzung.js';
import { MARKT, trenne, verbinde } from '../hilfe.js';

describe('MongoDB selbst', () => {
  beforeAll(() => verbinde('grundlage'));
  afterAll(trenne);

  it('läuft als echter Server in Version 7', async () => {
    const info = await mongoose.connection.db.admin().serverInfo();
    expect(info.version).toMatch(/^7\./);
  });

  it('hat den 2dsphere-Index auf dem GeoJSON-Punkt', async () => {
    const indizes = await Meldung.collection.indexes();
    expect(indizes.some((i) => i.key['ort.punkt'] === '2dsphere')).toBe(true);
  });

  it('nutzt diesen Index für die Umkreissuche', async () => {
    const plan = await meldungenImUmkreis({
      lng: MARKT.lng,
      lat: MARKT.lat,
      meter: 100,
      grenze: 5,
    }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toContain('GEO_NEAR_2DSPHERE');
  });

  it('hat den deutschen Volltextindex', async () => {
    const indizes = await Meldung.collection.indexes();
    const suche = indizes.find((i) => i.name === 'suche');
    expect(suche.default_language).toBe('german');
  });

  it('räumt Sitzungen über einen TTL-Index selbst ab', async () => {
    const indizes = await Sitzung.collection.indexes();
    const ttl = indizes.find((i) => i.key.abgelaufenAm === 1);
    expect(ttl.expireAfterSeconds).toBe(0);
  });

  it('weist einen ungültigen GeoJSON-Punkt ab', async () => {
    await expect(
      Meldung.collection.insertOne({
        vorgangscode: 'KAPUTTER-CODE',
        ort: { punkt: { type: 'Point', coordinates: [500, 500] }, name: 'x' },
      }),
    ).rejects.toThrow(/geo/i);
  });

  it('hält den Vorgangscode eindeutig', async () => {
    const felder = {
      vorgangscode: 'AAAA-BBBB-CC',
      kategorie: 'licht',
      beschreibung: 'Erster Eintrag',
      ort: { punkt: { type: 'Point', coordinates: [MARKT.lng, MARKT.lat] }, name: 'Marktplatz' },
    };
    await Meldung.create(felder);
    await expect(Meldung.create(felder)).rejects.toThrow(/E11000/);
  });
});
