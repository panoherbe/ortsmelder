import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { legeAn, leere, MARKT, noerdlichVomMarkt, testApp, trenne, verbinde } from '../hilfe.js';

describe('Umkreissuche über $geoNear', () => {
  const app = testApp();
  beforeAll(() => verbinde('nahe'));
  afterAll(trenne);
  beforeEach(leere);

  const frage = () =>
    request(app).get('/api/meldungen/nahe').query({ lng: MARKT.lng, lat: MARKT.lat });

  it('liefert Treffer nach Entfernung sortiert, auf 10 m gerundet', async () => {
    await legeAn({ ...noerdlichVomMarkt(120), kategorie: 'muell' });
    await legeAn({ ...noerdlichVomMarkt(40), kategorie: 'licht' });
    const { body } = await frage().expect(200);
    expect(body.treffer.map((t) => t.kategorie)).toEqual(['licht', 'muell']);
    expect(body.treffer[0].entfernungMeter).toBe(40);
    expect(body.treffer[1].entfernungMeter).toBe(120);
  });

  it('lässt aus, was weiter als 150 m entfernt ist', async () => {
    await legeAn(noerdlichVomMarkt(149));
    await legeAn(noerdlichVomMarkt(151));
    const { body } = await frage().expect(200);
    expect(body.treffer).toHaveLength(1);
  });

  it('lässt Erledigtes aus', async () => {
    await legeAn({ ...noerdlichVomMarkt(10), status: 'erledigt' });
    const { body } = await frage().expect(200);
    expect(body.treffer).toEqual([]);
  });

  it('gibt keinen Freitext und keinen Code an Fremde', async () => {
    await legeAn({ beschreibung: 'Vertraulicher Freitext', hinweis: 'x' });
    const { body } = await frage().expect(200);
    expect(JSON.stringify(body)).not.toContain('Vertraulicher');
    expect(Object.keys(body.treffer[0]).sort()).toEqual([
      'entfernungMeter',
      'kategorie',
      'ortName',
      'status',
    ]);
  });

  it('zeigt höchstens fünf Treffer', async () => {
    for (let i = 0; i < 7; i += 1) await legeAn(noerdlichVomMarkt(i * 5));
    const { body } = await frage().expect(200);
    expect(body.treffer).toHaveLength(5);
  });

  it('antwortet auf unlesbare Koordinaten mit 400', async () => {
    await request(app).get('/api/meldungen/nahe').query({ lng: 'x', lat: 1 }).expect(400);
    await request(app).get('/api/meldungen/nahe').query({ lng: 500, lat: 1 }).expect(400);
    await request(app).get('/api/meldungen/nahe').expect(400);
    await request(app).get('/api/meldungen/nahe?lng=&lat=').expect(400);
    await request(app).get('/api/meldungen/nahe').query({ lng: '0x10', lat: 51 }).expect(400);
  });

  it('nennt außerhalb der Stadt keine Treffer und keine genaue Lage', async () => {
    await legeAn({ ...noerdlichVomMarkt(3) });
    const { body } = await frage().expect(200);
    expect(body.treffer[0].entfernungMeter).toBe(10);
    const aussen = await request(app)
      .get('/api/meldungen/nahe')
      .query({ lng: 8, lat: 50 })
      .expect(200);
    expect(aussen.body.treffer).toEqual([]);
  });
});
