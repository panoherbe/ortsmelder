import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { kennzahlen, meldungenImUmkreis, UMKREIS_VERWALTUNG_M } from '../abfragen.js';
import { KATEGORIE_IDS, STATUS_IDS } from '../fachlich.js';
import { eingabeFehler, Fehler } from '../fehler.js';
import { Meldung } from '../modelle/meldung.js';
import { Sitzung } from '../modelle/sitzung.js';

const COOKIE = 'om_sitzung';
const SEITENGROESSE = 100;

const filter = z
  .object({
    status: z.enum(STATUS_IDS).optional(),
    kategorie: z.enum(KATEGORIE_IDS).optional(),
    ort: z.string().trim().max(80).optional(),
    suche: z.string().trim().max(80).optional(),
    seite: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();

const aenderung = z
  .object({
    version: z.number().int().min(0),
    status: z.enum(STATUS_IDS).optional(),
    antwort: z.string().trim().max(1000, 'Höchstens 1.000 Zeichen.').optional(),
  })
  .refine((d) => d.status !== undefined || d.antwort !== undefined, {
    message: 'Keine Änderung angegeben.',
    path: ['eingabe'],
  });

const hash = (wert) => createHash('sha256').update(wert).digest();

function liesCookie(req) {
  for (const teil of (req.headers.cookie ?? '').split(';')) {
    const [name, wert] = teil.trim().split('=');
    if (name === COOKIE && wert) return wert;
  }
  return null;
}

function verwaltungsSicht(meldung) {
  return {
    id: meldung._id,
    version: meldung.__v,
    vorgangscode: meldung.vorgangscode,
    kategorie: meldung.kategorie,
    beschreibung: meldung.beschreibung,
    ort: {
      name: meldung.ort.name,
      hinweis: meldung.ort.hinweis ?? null,
      lng: meldung.ort.punkt.coordinates[0],
      lat: meldung.ort.punkt.coordinates[1],
    },
    status: meldung.status,
    antwort: meldung.antwort ?? null,
    eingegangenAm: meldung.eingegangenAm,
    erledigtAm: meldung.erledigtAm ?? null,
    verlauf: meldung.verlauf,
  };
}

function ladeId(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new Fehler(404, 'Meldung nicht gefunden.');
  return new mongoose.Types.ObjectId(req.params.id);
}

export function verwaltungsRouten({ konfig }) {
  const router = Router();
  const erwarteterHash = hash(konfig.verwaltungSchluessel);
  // Keyed with the admin key: changing the key ends every session at once.
  const tokenHash = (token) =>
    createHmac('sha256', konfig.verwaltungSchluessel).update(token).digest('hex');

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const anmeldeGrenze = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: konfig.grenzen.anmeldenJe15Minuten,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { fehler: 'Zu viele Versuche. Bitte warten Sie ein paar Minuten.' },
  });

  async function nurAngemeldet(req, _res, next) {
    const token = liesCookie(req);
    const sitzung =
      token &&
      (await Sitzung.findOne({
        tokenHash: tokenHash(token),
        abgelaufenAm: { $gt: new Date() },
      }));
    if (!sitzung) throw new Fehler(401, 'Bitte melden Sie sich an.');
    next();
  }

  router.post('/anmelden', anmeldeGrenze, async (req, res) => {
    const eingabe = typeof req.body?.schluessel === 'string' ? req.body.schluessel : '';
    if (!timingSafeEqual(hash(eingabe), erwarteterHash)) {
      throw new Fehler(401, 'Dieser Schlüssel passt nicht.');
    }
    const token = randomBytes(32).toString('base64url');
    const dauerMs = konfig.sitzungStunden * 60 * 60 * 1000;
    await Sitzung.create({
      tokenHash: tokenHash(token),
      abgelaufenAm: new Date(Date.now() + dauerMs),
    });
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: konfig.cookieSecure,
      maxAge: dauerMs,
      path: '/api/verwaltung',
    });
    res.status(204).end();
  });

  router.post('/abmelden', async (req, res) => {
    const token = liesCookie(req);
    if (token) await Sitzung.deleteOne({ tokenHash: tokenHash(token) });
    res.clearCookie(COOKIE, { path: '/api/verwaltung' });
    res.status(204).end();
  });

  router.use(nurAngemeldet);

  router.get('/sitzung', (_req, res) => {
    res.status(204).end();
  });

  router.get('/kennzahlen', async (_req, res) => {
    res.json(await kennzahlen());
  });

  router.get('/meldungen', async (req, res) => {
    const daten = filter.safeParse(req.query);
    if (!daten.success) throw new Fehler(400, 'Filter nicht lesbar.');
    const { status, kategorie, ort, suche, seite } = daten.data;
    const bedingung = {};
    if (status) bedingung.status = status;
    if (kategorie) bedingung.kategorie = kategorie;
    if (ort) bedingung['ort.name'] = ort;
    if (suche) bedingung.$text = { $search: suche };
    const [meldungen, gesamt] = await Promise.all([
      Meldung.find(bedingung)
        .sort({ eingegangenAm: -1, _id: -1 })
        .skip((seite - 1) * SEITENGROESSE)
        .limit(SEITENGROESSE),
      Meldung.countDocuments(bedingung),
    ]);
    res.json({
      eintraege: meldungen.map(verwaltungsSicht),
      gesamt,
      seite,
      seiten: Math.max(1, Math.ceil(gesamt / SEITENGROESSE)),
    });
  });

  router.get('/meldungen/:id', async (req, res) => {
    const id = ladeId(req);
    const meldung = await Meldung.findById(id);
    if (!meldung) throw new Fehler(404, 'Meldung nicht gefunden.');
    const [lng, lat] = meldung.ort.punkt.coordinates;
    const umkreis = await meldungenImUmkreis({
      lng,
      lat,
      meter: UMKREIS_VERWALTUNG_M,
      grenze: 5,
      ohneId: id,
    });
    res.json({
      ...verwaltungsSicht(meldung),
      umkreisMeter: UMKREIS_VERWALTUNG_M,
      umkreis: umkreis.map((u) => ({
        id: u._id,
        kategorie: u.kategorie,
        status: u.status,
        ortName: u.ort.name,
        entfernungMeter: u.entfernungMeter,
      })),
    });
  });

  router.patch('/meldungen/:id', async (req, res) => {
    const id = ladeId(req);
    const daten = aenderung.safeParse(req.body);
    if (!daten.success) throw eingabeFehler(daten.error);
    const { version, status, antwort } = daten.data;
    const bisher = await Meldung.findById(id);
    if (!bisher) throw new Fehler(404, 'Meldung nicht gefunden.');

    const jetzt = new Date();
    const neuerStatus = status ?? bisher.status;
    const neueAntwort = antwort === undefined ? bisher.antwort : antwort || undefined;
    if (neuerStatus === bisher.status && neueAntwort === bisher.antwort) {
      if (bisher.__v !== version) {
        throw new Fehler(409, 'Diese Meldung wurde gerade von jemand anderem geändert.');
      }
      return res.json(verwaltungsSicht(bisher));
    }
    const set = { status: neuerStatus, geaendertAm: jetzt };
    const unset = {};
    if (neueAntwort) set.antwort = neueAntwort;
    else unset.antwort = 1;
    if (neuerStatus === 'erledigt' && bisher.status !== 'erledigt') set.erledigtAm = jetzt;
    if (neuerStatus !== 'erledigt') unset.erledigtAm = 1;

    const eintrag = { am: jetzt, status: neuerStatus };
    if (neueAntwort && neueAntwort !== bisher.antwort) eintrag.antwort = neueAntwort;

    // The version in the filter makes this atomic: of two people saving at once, one gets a 409.
    const aktualisiert = await Meldung.findOneAndUpdate(
      { _id: id, __v: version },
      { $set: set, $unset: unset, $inc: { __v: 1 }, $push: { verlauf: eintrag } },
      { new: true, timestamps: false },
    );
    if (!aktualisiert) {
      throw new Fehler(409, 'Diese Meldung wurde gerade von jemand anderem geändert.');
    }
    res.json(verwaltungsSicht(aktualisiert));
  });

  return router;
}
