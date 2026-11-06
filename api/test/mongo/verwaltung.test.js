import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Meldung } from '../../src/modelle/meldung.js';
import { Sitzung } from '../../src/modelle/sitzung.js';
import {
  legeAn,
  leere,
  noerdlichVomMarkt,
  SCHLUESSEL,
  testApp,
  trenne,
  verbinde,
} from '../hilfe.js';

const tage = (n) => new Date(Date.now() - n * 86400000);
const tokenHash = (token) => createHmac('sha256', SCHLUESSEL).update(token).digest('hex');

describe('Verwaltung', () => {
  const app = testApp();
  beforeAll(() => verbinde('verwaltung'));
  afterAll(trenne);
  beforeEach(leere);

  async function angemeldet(ziel = app) {
    const agent = request.agent(ziel);
    await agent.post('/api/verwaltung/anmelden').send({ schluessel: SCHLUESSEL }).expect(204);
    return agent;
  }

  describe('Anmeldung', () => {
    it.each([
      ['get', '/api/verwaltung/sitzung'],
      ['get', '/api/verwaltung/meldungen'],
      ['get', '/api/verwaltung/kennzahlen'],
      ['get', '/api/verwaltung/meldungen/650000000000000000000000'],
      ['patch', '/api/verwaltung/meldungen/650000000000000000000000'],
    ])('sperrt %s %s ohne Sitzung', async (methode, pfad) => {
      await request(app)[methode](pfad).expect(401);
    });

    it('lehnt einen falschen Schlüssel ab und legt keine Sitzung an', async () => {
      await request(app)
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: 'falsch' })
        .expect(401);
      await request(app)
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: { $ne: 'x' } })
        .expect(401);
      expect(await Sitzung.countDocuments()).toBe(0);
    });

    it('setzt ein HttpOnly-Cookie mit SameSite=Strict', async () => {
      const antwort = await request(app)
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: SCHLUESSEL })
        .expect(204);
      const cookie = antwort.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/verwaltung');
    });

    it('setzt Secure, sobald der Betrieb es verlangt', async () => {
      const antwort = await request(testApp({ cookieSecure: true }))
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: SCHLUESSEL })
        .expect(204);
      expect(antwort.headers['set-cookie'][0]).toContain('Secure');
    });

    it('speichert nur den Hash des Tokens', async () => {
      const antwort = await request(app)
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: SCHLUESSEL })
        .expect(204);
      const token = antwort.headers['set-cookie'][0].split(';')[0].split('=')[1];
      const sitzung = await Sitzung.findOne().lean();
      expect(sitzung.tokenHash).toBe(tokenHash(token));
      expect(JSON.stringify(sitzung)).not.toContain(token);
    });

    it('akzeptiert keine abgelaufene Sitzung, auch bevor MongoDB sie abräumt', async () => {
      const token = 'abgelaufenes-token';
      await Sitzung.create({
        tokenHash: tokenHash(token),
        abgelaufenAm: new Date(Date.now() - 1000),
      });
      await request(app)
        .get('/api/verwaltung/sitzung')
        .set('Cookie', `om_sitzung=${token}`)
        .expect(401);
    });

    it('beendet alle Sitzungen, sobald der Schlüssel wechselt', async () => {
      const antwort = await request(app)
        .post('/api/verwaltung/anmelden')
        .send({ schluessel: SCHLUESSEL })
        .expect(204);
      const cookie = antwort.headers['set-cookie'][0].split(';')[0];
      await request(app).get('/api/verwaltung/sitzung').set('Cookie', cookie).expect(204);
      const neu = testApp({ verwaltungSchluessel: 'ein-ganz-anderer-schluessel' });
      await request(neu).get('/api/verwaltung/sitzung').set('Cookie', cookie).expect(401);
    });

    it('erlaubt Browsern kein Zwischenspeichern der Verwaltungsdaten', async () => {
      const agent = await angemeldet();
      const { headers } = await agent.get('/api/verwaltung/meldungen').expect(200);
      expect(headers['cache-control']).toBe('no-store');
    });

    it('beendet die Sitzung beim Abmelden auch auf dem Server', async () => {
      const agent = await angemeldet();
      await agent.get('/api/verwaltung/sitzung').expect(204);
      await agent.post('/api/verwaltung/abmelden').expect(204);
      await agent.get('/api/verwaltung/sitzung').expect(401);
      expect(await Sitzung.countDocuments()).toBe(0);
    });

    it('drosselt falsche Versuche, richtige zählen nicht', async () => {
      const begrenzt = testApp({
        grenzen: { meldenJe10Minuten: 1000, anmeldenJe15Minuten: 2, lesenJeMinute: 100000 },
      });
      const anmelden = (schluessel) =>
        request(begrenzt).post('/api/verwaltung/anmelden').send({ schluessel });
      await anmelden(SCHLUESSEL).expect(204);
      await anmelden(SCHLUESSEL).expect(204);
      await anmelden(SCHLUESSEL).expect(204);
      await anmelden('falsch').expect(401);
      await anmelden('falsch').expect(401);
      await anmelden('falsch').expect(429);
    });
  });

  describe('Liste', () => {
    it('sortiert das Neueste nach oben', async () => {
      await legeAn({ beschreibung: 'Ältere Meldung', eingegangenAm: tage(3) });
      await legeAn({ beschreibung: 'Neuere Meldung', eingegangenAm: tage(1) });
      const agent = await angemeldet();
      const { body } = await agent.get('/api/verwaltung/meldungen').expect(200);
      expect(body.eintraege.map((e) => e.beschreibung)).toEqual([
        'Neuere Meldung',
        'Ältere Meldung',
      ]);
      expect(body.gesamt).toBe(2);
    });

    it('filtert nach Status, Kategorie und Ort', async () => {
      await legeAn({ status: 'neu', kategorie: 'licht', ortName: 'Marktplatz' });
      await legeAn({ status: 'erledigt', kategorie: 'licht', ortName: 'Stadtpark' });
      await legeAn({ status: 'neu', kategorie: 'muell', ortName: 'Stadtpark' });
      const agent = await angemeldet();
      const zaehle = async (query) =>
        (await agent.get('/api/verwaltung/meldungen').query(query).expect(200)).body.gesamt;
      expect(await zaehle({ status: 'neu' })).toBe(2);
      expect(await zaehle({ kategorie: 'muell' })).toBe(1);
      expect(await zaehle({ ort: 'Stadtpark' })).toBe(2);
      expect(await zaehle({ status: 'neu', ort: 'Stadtpark' })).toBe(1);
    });

    it('findet über die deutsche Volltextsuche auch gebeugte Wörter', async () => {
      await legeAn({ beschreibung: 'Zwei Laternen sind dunkel' });
      await legeAn({ beschreibung: 'Der Papierkorb quillt über' });
      const agent = await angemeldet();
      const { body } = await agent
        .get('/api/verwaltung/meldungen')
        .query({ suche: 'Laterne' })
        .expect(200);
      expect(body.eintraege.map((e) => e.beschreibung)).toEqual(['Zwei Laternen sind dunkel']);
    });

    it('teilt lange Listen in Seiten', async () => {
      await Promise.all(Array.from({ length: 105 }, () => legeAn()));
      const agent = await angemeldet();
      const erste = await agent.get('/api/verwaltung/meldungen').expect(200);
      expect(erste.body.eintraege).toHaveLength(100);
      expect(erste.body.seiten).toBe(2);
      const zweite = await agent.get('/api/verwaltung/meldungen').query({ seite: 2 }).expect(200);
      expect(zweite.body.eintraege).toHaveLength(5);
    });

    it('weist Operatoren und unbekannte Werte im Filter ab', async () => {
      const agent = await angemeldet();
      await agent.get('/api/verwaltung/meldungen?status[$ne]=neu').expect(400);
      await agent.get('/api/verwaltung/meldungen?status=gibtsnicht').expect(400);
      await agent.get('/api/verwaltung/meldungen?ort[$gt]=').expect(400);
    });
  });

  describe('Bearbeiten', () => {
    it('zeigt im Detail die Nachbarn im Umkreis, ohne die Meldung selbst', async () => {
      const meldung = await legeAn();
      await legeAn({ ...noerdlichVomMarkt(100), kategorie: 'muell' });
      await legeAn({ ...noerdlichVomMarkt(400), kategorie: 'gruen' });
      const agent = await angemeldet();
      const { body } = await agent.get(`/api/verwaltung/meldungen/${meldung._id}`).expect(200);
      expect(body.umkreis.map((u) => u.kategorie)).toEqual(['muell']);
      expect(body.umkreis[0].entfernungMeter).toBeCloseTo(100, -1);
    });

    it('ändert Status und Antwort und schreibt den Verlauf', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const { body } = await agent
        .patch(`/api/verwaltung/meldungen/${meldung._id}`)
        .send({ version: 0, status: 'in_arbeit', antwort: 'Wir kümmern uns.' })
        .expect(200);
      expect(body.status).toBe('in_arbeit');
      expect(body.antwort).toBe('Wir kümmern uns.');
      expect(body.version).toBe(1);
      expect(body.verlauf.at(-1)).toMatchObject({
        status: 'in_arbeit',
        antwort: 'Wir kümmern uns.',
      });
      expect(body.verlauf).toHaveLength(2);
    });

    it('macht die Antwort über den Code öffentlich sichtbar', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      await agent
        .patch(`/api/verwaltung/meldungen/${meldung._id}`)
        .send({ version: 0, status: 'erledigt', antwort: 'Repariert.' })
        .expect(200);
      const { body } = await request(app).get(`/api/meldungen/${meldung.vorgangscode}`).expect(200);
      expect(body.status).toBe('erledigt');
      expect(body.antwort).toBe('Repariert.');
      expect(body.verlauf.map((v) => v.status)).toEqual(['neu', 'erledigt']);
    });

    it('setzt das Erledigt-Datum und nimmt es beim Wiedereröffnen zurück', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      const erledigt = await agent.patch(pfad).send({ version: 0, status: 'erledigt' }).expect(200);
      expect(erledigt.body.erledigtAm).toBeTruthy();
      const offen = await agent.patch(pfad).send({ version: 1, status: 'in_arbeit' }).expect(200);
      expect(offen.body.erledigtAm).toBeNull();
      expect((await Meldung.findById(meldung._id)).erledigtAm).toBeUndefined();
    });

    it('behält das erste Erledigt-Datum, wenn nur die Antwort ergänzt wird', async () => {
      const meldung = await legeAn({ status: 'erledigt', erledigtAm: tage(2) });
      const agent = await angemeldet();
      const { body } = await agent
        .patch(`/api/verwaltung/meldungen/${meldung._id}`)
        .send({ version: 0, antwort: 'Nachtrag' })
        .expect(200);
      expect(new Date(body.erledigtAm).getTime()).toBe(meldung.erledigtAm.getTime());
    });

    it('lässt die Antwort wieder leeren', async () => {
      const meldung = await legeAn({ antwort: 'Falscher Text' });
      const agent = await angemeldet();
      const { body } = await agent
        .patch(`/api/verwaltung/meldungen/${meldung._id}`)
        .send({ version: 0, antwort: '' })
        .expect(200);
      expect(body.antwort).toBeNull();
    });

    it('schreibt nichts, wenn sich nichts ändert', async () => {
      const meldung = await legeAn({ status: 'neu', antwort: 'Schon da' });
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      const { body } = await agent
        .patch(pfad)
        .send({ version: 0, status: 'neu', antwort: 'Schon da' })
        .expect(200);
      expect(body.version).toBe(0);
      expect(body.verlauf).toHaveLength(1);
      await agent.patch(pfad).send({ version: 7, status: 'neu' }).expect(409);
    });

    it('zeigt öffentlich nur echte Statuswechsel, keine reinen Textänderungen', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      await agent.patch(pfad).send({ version: 0, status: 'in_arbeit' }).expect(200);
      const intern = await agent
        .patch(pfad)
        .send({ version: 1, antwort: 'Erster Text' })
        .expect(200);
      expect(intern.body.verlauf.at(-1).antwort).toBe('Erster Text');
      await agent.patch(pfad).send({ version: 2, antwort: 'Zweiter Text' }).expect(200);
      const { body } = await request(app).get(`/api/meldungen/${meldung.vorgangscode}`).expect(200);
      expect(body.verlauf.map((v) => v.status)).toEqual(['neu', 'in_arbeit']);
      expect(body.antwort).toBe('Zweiter Text');
      expect(JSON.stringify(body)).not.toContain('Erster Text');
    });

    it('lehnt eine veraltete Version mit 409 ab', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      await agent.patch(pfad).send({ version: 0, status: 'in_arbeit' }).expect(200);
      await agent.patch(pfad).send({ version: 0, status: 'erledigt' }).expect(409);
      expect((await Meldung.findById(meldung._id)).status).toBe('in_arbeit');
    });

    it('lässt von zwei gleichzeitigen Änderungen genau eine durch', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      const antworten = await Promise.all(
        ['in_arbeit', 'erledigt', 'weitergeleitet', 'in_arbeit', 'erledigt'].map((status) =>
          agent.patch(pfad).send({ version: 0, status }),
        ),
      );
      const codes = antworten.map((a) => a.status).sort();
      expect(codes).toEqual([200, 409, 409, 409, 409]);
      const gespeichert = await Meldung.findById(meldung._id);
      expect(gespeichert.verlauf).toHaveLength(2);
      expect(gespeichert.__v).toBe(1);
    });

    it('weist unbekannte Status und leere Änderungen ab', async () => {
      const meldung = await legeAn();
      const agent = await angemeldet();
      const pfad = `/api/verwaltung/meldungen/${meldung._id}`;
      await agent.patch(pfad).send({ version: 0, status: 'kaputt' }).expect(422);
      await agent.patch(pfad).send({ version: 0 }).expect(422);
      await agent.patch(pfad).send({ status: 'erledigt' }).expect(422);
    });

    it('antwortet auf unbekannte oder unlesbare IDs mit 404', async () => {
      const agent = await angemeldet();
      await agent.get('/api/verwaltung/meldungen/650000000000000000000000').expect(404);
      await agent.get('/api/verwaltung/meldungen/keine-id').expect(404);
      await agent
        .patch('/api/verwaltung/meldungen/650000000000000000000000')
        .send({ version: 0, status: 'neu' })
        .expect(404);
    });
  });
});
