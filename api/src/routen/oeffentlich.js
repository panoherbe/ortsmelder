import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { meldungenImUmkreis, UMKREIS_BUERGER_M } from '../abfragen.js';
import {
  KATEGORIE_IDS,
  KATEGORIEN,
  STATUS,
  neuerVorgangscode,
  normalisiereCode,
} from '../fachlich.js';
import { Meldung } from '../modelle/meldung.js';
import { liegtInStadt, naechsterOrt } from '../stadt.js';
import { eingabeFehler, Fehler } from '../fehler.js';

const hatInhalt = (text) => text.replace(/[\p{Cf}\s]/gu, '').length >= 5;

const neueMeldung = z.object({
  kategorie: z.enum(KATEGORIE_IDS, { message: 'Bitte wählen Sie eine Kategorie.' }),
  beschreibung: z
    .string({ message: 'Bitte beschreiben Sie kurz, was Ihnen aufgefallen ist.' })
    .trim()
    .max(1000, 'Bitte fassen Sie sich etwas kürzer (höchstens 1.000 Zeichen).')
    .refine(hatInhalt, 'Ein paar Worte mehr helfen uns weiter.'),
  lng: z.number({ message: 'Bitte wählen Sie einen Ort.' }),
  lat: z.number({ message: 'Bitte wählen Sie einen Ort.' }),
  hinweis: z.string().trim().max(120, 'Höchstens 120 Zeichen.').optional(),
  // Stays empty for people: the field is hidden. Bots fill it in.
  website: z.string().max(0, 'Dieses Feld bleibt leer.').optional(),
});

const koordinate = (grenze) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?$/)
    .transform(Number)
    .pipe(z.number().min(-grenze).max(grenze));

const position = z.object({ lng: koordinate(180), lat: koordinate(90) });

// Coarse on purpose: nobody can triangulate the exact spot of a report that no one has read yet.
const grobeMeter = (meter) => Math.max(10, Math.round(meter / 10) * 10);

function oeffentlicheSicht(meldung) {
  return {
    vorgangscode: meldung.vorgangscode,
    kategorie: meldung.kategorie,
    ort: { name: meldung.ort.name },
    status: meldung.status,
    antwort: meldung.antwort ?? null,
    eingegangenAm: meldung.eingegangenAm,
    verlauf: meldung.verlauf
      .filter((v, i, alle) => i === 0 || v.status !== alle[i - 1].status)
      .map((v) => ({ am: v.am, status: v.status })),
  };
}

export function oeffentlicheRouten({ konfig, stadt }) {
  const router = Router();

  const meldeGrenze = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: konfig.grenzen.meldenJe10Minuten,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipFailedRequests: true, // a typo in the form must not use up someone's allowance
    message: {
      fehler: 'Danke für Ihren Einsatz! Bitte senden Sie Ihre nächste Meldung in ein paar Minuten.',
    },
  });

  router.get('/grundlagen', (_req, res) => {
    res.json({
      stadt,
      kategorien: KATEGORIEN,
      status: STATUS,
      demo: konfig.demo,
      demoSchluessel: konfig.demoSchluesselZeigen ? konfig.verwaltungSchluessel : null,
    });
  });

  router.post('/meldungen', meldeGrenze, async (req, res) => {
    const daten = neueMeldung.safeParse(req.body);
    if (!daten.success) throw eingabeFehler(daten.error);
    const { kategorie, beschreibung, lng, lat, hinweis } = daten.data;
    if (!liegtInStadt(stadt, lng, lat)) {
      throw new Fehler(422, `Dieser Ort liegt außerhalb von ${stadt.name}.`, {
        ort: 'Bitte wählen Sie einen Ort auf der Karte.',
      });
    }
    const jetzt = new Date();
    const meldung = await Meldung.create({
      vorgangscode: neuerVorgangscode(randomBytes),
      kategorie,
      beschreibung,
      ort: {
        punkt: { type: 'Point', coordinates: [lng, lat] },
        name: naechsterOrt(stadt, lng, lat),
        hinweis: hinweis || undefined,
      },
      verlauf: [{ am: jetzt, status: 'neu' }],
    });
    res.status(201).json({ vorgangscode: meldung.vorgangscode });
  });

  router.get('/meldungen/nahe', async (req, res) => {
    const daten = position.safeParse(req.query);
    if (!daten.success) throw new Fehler(400, 'Ort nicht lesbar.');
    const { lng, lat } = daten.data;
    const treffer = liegtInStadt(stadt, lng, lat)
      ? await meldungenImUmkreis({ lng, lat, meter: UMKREIS_BUERGER_M, grenze: 5 })
      : [];
    // Only category and state: the free text has not been read by anyone yet.
    res.json({
      umkreisMeter: UMKREIS_BUERGER_M,
      treffer: treffer.map((t) => ({
        kategorie: t.kategorie,
        status: t.status,
        ortName: t.ort.name,
        entfernungMeter: grobeMeter(t.entfernungMeter),
      })),
    });
  });

  router.get('/meldungen/:code', async (req, res) => {
    const code = normalisiereCode(req.params.code);
    const meldung = code && (await Meldung.findOne({ vorgangscode: code }));
    if (!meldung) throw new Fehler(404, 'Zu diesem Code haben wir keine Meldung gefunden.');
    res.json(oeffentlicheSicht(meldung));
  });

  return router;
}
