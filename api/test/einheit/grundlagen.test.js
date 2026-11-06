import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { baueApp } from '../../src/app.js';
import { neuerVorgangscode, normalisiereCode } from '../../src/fachlich.js';
import { ladeKonfig } from '../../src/konfig.js';
import { abstandMeter, ladeStadt, liegtInStadt, naechsterOrt } from '../../src/stadt.js';

const stadt = ladeStadt();

function app(aenderungen = {}) {
  const konfig = { ...ladeKonfig({ OM_DEMO: '1' }), ...aenderungen };
  return baueApp({ konfig, stadt });
}

describe('Vorgangscode', () => {
  it('hat das Format XXXX-XXXX-XX und nur eindeutig lesbare Zeichen', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(neuerVorgangscode(randomBytes)).toMatch(
        /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/,
      );
    }
  });

  it('wiederholt sich in 10.000 Ziehungen nicht', () => {
    const codes = new Set(Array.from({ length: 10000 }, () => neuerVorgangscode(randomBytes)));
    expect(codes.size).toBe(10000);
  });

  it('nutzt das ganze Alphabet, also die vollen 50 Bit', () => {
    const zeichen = new Set();
    for (let i = 0; i < 2000; i += 1) {
      for (const z of neuerVorgangscode(randomBytes).replaceAll('-', '')) zeichen.add(z);
    }
    expect(zeichen.size).toBe(32);
  });

  it('verzeiht Schreibweisen, wie sie von Hand entstehen', () => {
    expect(normalisiereCode('abcd-efgh-jk')).toBe('ABCD-EFGH-JK');
    expect(normalisiereCode(' ABCD EFGH JK ')).toBe('ABCD-EFGH-JK');
    expect(normalisiereCode('o0il-1234-56')).toBe('0011-1234-56');
  });

  it('lehnt alles andere ab', () => {
    for (const eingabe of ['', 'ABC', 'ABCD-EFGH-JKM', 'ABCD-EFGH-J$', '$ne']) {
      expect(normalisiereCode(eingabe)).toBeNull();
    }
  });
});

describe('Konfiguration', () => {
  it('startet ohne Demo nicht mit fehlendem oder kurzem Schlüssel', () => {
    expect(() => ladeKonfig({})).toThrow(/OM_VERWALTUNG_SCHLUESSEL/);
    expect(() => ladeKonfig({ OM_VERWALTUNG_SCHLUESSEL: 'zu-kurz' })).toThrow(/mindestens/);
  });

  it('erzwingt im Betrieb sichere Cookies und zeigt keinen Schlüssel', () => {
    const konfig = ladeKonfig({ OM_VERWALTUNG_SCHLUESSEL: 'ein-langer-echter-schluessel' });
    expect(konfig.cookieSecure).toBe(true);
    expect(konfig.demoSchluesselZeigen).toBe(false);
    expect(konfig.demo).toBe(false);
  });

  it('zeigt den Demo-Schlüssel nur, solange kein eigener gesetzt ist', () => {
    expect(ladeKonfig({ OM_DEMO: '1' }).demoSchluesselZeigen).toBe(true);
    const eigener = ladeKonfig({ OM_DEMO: '1', OM_VERWALTUNG_SCHLUESSEL: 'eigener' });
    expect(eigener.demoSchluesselZeigen).toBe(false);
    expect(eigener.verwaltungSchluessel).toBe('eigener');
  });

  it('weist unlesbare Zahlen ab', () => {
    expect(() => ladeKonfig({ OM_DEMO: '1', OM_GRENZE_MELDEN: 'viele' })).toThrow(/Zahl/);
  });
});

describe('Stadt', () => {
  it('erkennt die Stadtgrenzen', () => {
    const { west, nord, ost, sued } = stadt.grenzen;
    expect(liegtInStadt(stadt, west, nord)).toBe(true);
    expect(liegtInStadt(stadt, ost + 0.001, sued)).toBe(false);
    expect(liegtInStadt(stadt, west, sued - 0.001)).toBe(false);
  });

  it('misst Abstände auf der Kugel', () => {
    expect(abstandMeter([10, 51], [10, 52])).toBeCloseTo(111195, -2);
  });

  it('findet den nächsten benannten Ort', () => {
    for (const ort of stadt.orte) {
      expect(naechsterOrt(stadt, ort.lng, ort.lat)).toBe(ort.name);
    }
  });

  it('lässt alle Orte innerhalb der Grenzen liegen', () => {
    for (const ort of stadt.orte) expect(liegtInStadt(stadt, ort.lng, ort.lat)).toBe(true);
  });
});

describe('HTTP-Schicht', () => {
  it('setzt strenge Sicherheits-Header', async () => {
    const { headers } = await request(app()).get('/api/grundlagen').expect(200);
    const csp = headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers).not.toHaveProperty('x-powered-by');
  });

  it('nennt den Demo-Schlüssel in den Grundlagen nur im Demo-Modus', async () => {
    const demo = await request(app()).get('/api/grundlagen').expect(200);
    expect(demo.body.demoSchluessel).toBe('demo-verwaltung');
    const betrieb = await request(
      baueApp({
        konfig: ladeKonfig({ OM_VERWALTUNG_SCHLUESSEL: 'ein-langer-echter-schluessel' }),
        stadt,
      }),
    )
      .get('/api/grundlagen')
      .expect(200);
    expect(betrieb.body.demoSchluessel).toBeNull();
    expect(JSON.stringify(betrieb.body)).not.toContain('ein-langer-echter-schluessel');
  });

  it('nimmt Schreibzugriffe nur als JSON an', async () => {
    await request(app())
      .post('/api/meldungen')
      .type('form')
      .send({ kategorie: 'licht' })
      .expect(415);
  });

  it('weist kaputtes und zu großes JSON ohne Stack-Trace ab', async () => {
    const kaputt = await request(app())
      .post('/api/meldungen')
      .set('Content-Type', 'application/json')
      .send('{kaputt')
      .expect(400);
    expect(JSON.stringify(kaputt.body)).not.toContain('at ');
    await request(app())
      .post('/api/meldungen')
      .send({ beschreibung: 'x'.repeat(30000) })
      .expect(413);
  });

  it('begrenzt auch alle übrigen API-Aufrufe', async () => {
    const begrenzt = app();
    const konfig = { ...ladeKonfig({ OM_DEMO: '1' }) };
    konfig.grenzen = { ...konfig.grenzen, lesenJeMinute: 2 };
    const eng = baueApp({ konfig, stadt });
    await request(eng).get('/api/grundlagen').expect(200);
    await request(eng).get('/api/grundlagen').expect(200);
    await request(eng).get('/api/grundlagen').expect(429);
    await request(begrenzt).get('/api/grundlagen').expect(200);
  });

  it('meldet 503, solange die Datenbank nicht da ist', async () => {
    await request(app()).get('/api/gesund').expect(503);
  });

  it('antwortet auf unbekannte API-Pfade mit JSON-404', async () => {
    const { body } = await request(app()).get('/api/gibtsnicht').expect(404);
    expect(body.fehler).toBeTruthy();
  });

  it('liefert die Oberfläche auch für tiefe Links', async () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'om-web-'));
    writeFileSync(join(verzeichnis, 'index.html'), '<title>Test</title>');
    const mitWeb = app({ webVerzeichnis: verzeichnis });
    const antwort = await request(mitWeb).get('/meldung/ABCD-EFGH-JK').expect(200);
    expect(antwort.text).toContain('<title>Test</title>');
    await request(mitWeb).head('/').expect(200);
  });

  it('kennt die Beispielstadt mit Karte', () => {
    expect(stadt.name).toBe('Musterstadt');
    expect(stadt.karte.strassen.length).toBeGreaterThan(5);
  });
});
