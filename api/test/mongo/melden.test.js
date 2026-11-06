import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Meldung } from '../../src/modelle/meldung.js';
import {
  gueltigeMeldung,
  legeAn,
  leere,
  MARKT,
  noerdlichVomMarkt,
  stadt,
  testApp,
  trenne,
  verbinde,
} from '../hilfe.js';

describe('Melden und Stand', () => {
  const app = testApp();
  beforeAll(() => verbinde('melden'));
  afterAll(trenne);
  beforeEach(leere);

  it('speichert eine Meldung als GeoJSON, Länge vor Breite', async () => {
    const antwort = await request(app).post('/api/meldungen').send(gueltigeMeldung()).expect(201);
    expect(antwort.body.vorgangscode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
    const gespeichert = await Meldung.findOne({ vorgangscode: antwort.body.vorgangscode }).lean();
    expect(gespeichert.ort.punkt).toEqual({
      type: 'Point',
      coordinates: [MARKT.lng, MARKT.lat],
    });
    expect(gespeichert.status).toBe('neu');
    expect(gespeichert.verlauf).toHaveLength(1);
  });

  it('bestimmt den nächsten benannten Ort auf dem Server', async () => {
    const { lng, lat } = noerdlichVomMarkt(10);
    const antwort = await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ lng, lat }))
      .expect(201);
    const gespeichert = await Meldung.findOne({ vorgangscode: antwort.body.vorgangscode });
    expect(gespeichert.ort.name).toBe('Marktplatz');
  });

  it('nennt fehlende Angaben je Feld', async () => {
    const antwort = await request(app).post('/api/meldungen').send({}).expect(422);
    expect(Object.keys(antwort.body.felder).sort()).toEqual(['beschreibung', 'kategorie', 'ort']);
    expect(await Meldung.countDocuments()).toBe(0);
  });

  it('nimmt einen Text unter fünf Zeichen nicht an, auch nicht mit Leerzeichen', async () => {
    const antwort = await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ beschreibung: '  a b   ' }))
      .expect(422);
    expect(antwort.body.felder.beschreibung).toBeTruthy();
  });

  it('zählt unsichtbare Zeichen nicht als Text', async () => {
    await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ beschreibung: '\u200b\u200b\u200b\u200b\u200b\u200b' }))
      .expect(422);
  });

  it('nimmt keinen Text über 1.000 Zeichen an', async () => {
    await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ beschreibung: 'x'.repeat(1001) }))
      .expect(422);
  });

  it.each([
    ['östlich', { lng: stadt.grenzen.ost + 0.001 }],
    ['westlich', { lng: stadt.grenzen.west - 0.001 }],
    ['nördlich', { lat: stadt.grenzen.nord + 0.001 }],
    ['südlich', { lat: stadt.grenzen.sued - 0.001 }],
  ])('nimmt keinen Ort %s der Stadt an', async (_name, ort) => {
    const antwort = await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung(ort))
      .expect(422);
    expect(antwort.body.felder.ort).toBeTruthy();
  });

  it('nimmt keine Datenbank-Operatoren als Eingabe an', async () => {
    await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ kategorie: { $ne: 'x' } }))
      .expect(422);
    await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ beschreibung: { $gt: '' } }))
      .expect(422);
    expect(await Meldung.countDocuments()).toBe(0);
  });

  it('weist ein ausgefülltes Köderfeld ab', async () => {
    await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ website: 'http://werbung.example' }))
      .expect(422);
    expect(await Meldung.countDocuments()).toBe(0);
  });

  it('ignoriert vom Absender gesetzten Status und Antworttext', async () => {
    const antwort = await request(app)
      .post('/api/meldungen')
      .send(gueltigeMeldung({ status: 'erledigt', antwort: 'selbst erledigt' }))
      .expect(201);
    const gespeichert = await Meldung.findOne({ vorgangscode: antwort.body.vorgangscode });
    expect(gespeichert.status).toBe('neu');
    expect(gespeichert.antwort).toBeUndefined();
  });

  it('begrenzt das Meldeformular und meldet das freundlich', async () => {
    const begrenzt = testApp({
      grenzen: { meldenJe10Minuten: 2, anmeldenJe15Minuten: 1000, lesenJeMinute: 100000 },
    });
    await request(begrenzt).post('/api/meldungen').send(gueltigeMeldung()).expect(201);
    await request(begrenzt).post('/api/meldungen').send(gueltigeMeldung()).expect(201);
    const dritte = await request(begrenzt)
      .post('/api/meldungen')
      .send(gueltigeMeldung())
      .expect(429);
    expect(dritte.body.fehler).toContain('Danke');
    expect(dritte.headers['retry-after']).toBeTruthy();
    expect(await Meldung.countDocuments()).toBe(2);
  });

  it('zählt abgewiesene Eingaben nicht gegen die Grenze', async () => {
    const begrenzt = testApp({
      grenzen: { meldenJe10Minuten: 1, anmeldenJe15Minuten: 1000, lesenJeMinute: 100000 },
    });
    await request(begrenzt).post('/api/meldungen').send({}).expect(422);
    await request(begrenzt).post('/api/meldungen').send({}).expect(422);
    await request(begrenzt).post('/api/meldungen').send(gueltigeMeldung()).expect(201);
    await request(begrenzt).post('/api/meldungen').send(gueltigeMeldung()).expect(429);
  });

  it('lässt sich ohne Proxy nicht mit einem gefälschten X-Forwarded-For umgehen', async () => {
    const begrenzt = testApp({
      grenzen: { meldenJe10Minuten: 1, anmeldenJe15Minuten: 1000, lesenJeMinute: 100000 },
    });
    const sende = (ip) =>
      request(begrenzt).post('/api/meldungen').set('X-Forwarded-For', ip).send(gueltigeMeldung());
    await sende('203.0.113.1').expect(201);
    await sende('203.0.113.2').expect(429);
  });

  it('zählt beim Begrenzen hinter einem Proxy je Adresse', async () => {
    const begrenzt = testApp({
      proxyStufen: 1,
      grenzen: { meldenJe10Minuten: 1, anmeldenJe15Minuten: 1000, lesenJeMinute: 100000 },
    });
    const sende = (ip) =>
      request(begrenzt).post('/api/meldungen').set('X-Forwarded-For', ip).send(gueltigeMeldung());
    await sende('203.0.113.1').expect(201);
    await sende('203.0.113.1').expect(429);
    await sende('203.0.113.2').expect(201);
  });

  it('zeigt den Stand zum Code, ohne interne Felder und ohne den Freitext', async () => {
    const meldung = await legeAn({
      status: 'in_arbeit',
      antwort: 'Wir kümmern uns.',
      beschreibung: 'Vertraulicher Freitext',
      ort: {
        punkt: { type: 'Point', coordinates: [MARKT.lng, MARKT.lat] },
        name: 'Marktplatz',
        hinweis: 'Vertraulicher Hinweis',
      },
      verlauf: [
        { am: new Date(), status: 'neu' },
        { am: new Date(), status: 'in_arbeit', antwort: 'Vertrauliche alte Antwort' },
      ],
    });
    const antwort = await request(app).get(`/api/meldungen/${meldung.vorgangscode}`).expect(200);
    expect(antwort.body.status).toBe('in_arbeit');
    expect(antwort.body.antwort).toBe('Wir kümmern uns.');
    expect(Object.keys(antwort.body).sort()).toEqual([
      'antwort',
      'eingegangenAm',
      'kategorie',
      'ort',
      'status',
      'verlauf',
      'vorgangscode',
    ]);
    expect(antwort.body.ort).toEqual({ name: 'Marktplatz' });
    expect(Object.keys(antwort.body.verlauf[1]).sort()).toEqual(['am', 'status']);
    expect(JSON.stringify(antwort.body)).not.toContain('Vertraulich');
  });

  it('findet den Code auch kleingeschrieben und ohne Bindestriche', async () => {
    const meldung = await legeAn();
    const eingabe = meldung.vorgangscode.replaceAll('-', '').toLowerCase();
    await request(app).get(`/api/meldungen/${eingabe}`).expect(200);
  });

  it('antwortet auf einen unbekannten Code mit 404', async () => {
    await request(app).get('/api/meldungen/0000-0000-00').expect(404);
    await request(app).get('/api/meldungen/nicht-gueltig').expect(404);
  });
});
