import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { Fehler } from './fehler.js';
import { oeffentlicheRouten } from './routen/oeffentlich.js';
import { verwaltungsRouten } from './routen/verwaltung.js';

export function baueApp({ konfig, stadt }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', konfig.proxyStufen);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: konfig.cookieSecure,
      // Browsers refuse this header on plain HTTP and log an error for it.
      crossOriginOpenerPolicy: konfig.cookieSecure,
    }),
  );

  app.get('/api/gesund', async (_req, res) => {
    const bereit = mongoose.connection.readyState === 1;
    if (!bereit) return res.status(503).json({ status: 'wartet auf Datenbank' });
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ok' });
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: konfig.grenzen.lesenJeMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { fehler: 'Einen Moment bitte, das waren gerade sehr viele Anfragen.' },
    }),
  );
  app.use('/api', express.json({ limit: '20kb' }));
  // Cross-site forms cannot send JSON without a preflight, which this server never answers.
  app.use('/api', (req, _res, next) => {
    const schreibend = req.method !== 'GET' && req.method !== 'HEAD';
    if (schreibend && req.headers['content-length'] > 0 && !req.is('application/json')) {
      throw new Fehler(415, 'Bitte als JSON senden.');
    }
    next();
  });
  app.use('/api/verwaltung', verwaltungsRouten({ konfig }));
  app.use('/api', oeffentlicheRouten({ konfig, stadt }));
  app.use('/api', (_req, _res, next) => next(new Fehler(404, 'Nicht gefunden.')));

  const web = konfig.webVerzeichnis && resolve(konfig.webVerzeichnis);
  if (web && existsSync(join(web, 'index.html'))) {
    app.use(
      '/assets',
      express.static(join(web, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(web, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(web, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars -- Express recognises error handlers by their four parameters
  app.use((fehler, _req, res, _next) => {
    if (fehler instanceof Fehler) {
      return res.status(fehler.status).json({ fehler: fehler.message, felder: fehler.felder });
    }
    if (fehler.status && fehler.status < 500) {
      return res.status(fehler.status).json({ fehler: 'Diese Anfrage konnten wir nicht lesen.' });
    }
    console.error(fehler);
    res.status(500).json({ fehler: 'Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.' });
  });

  return app;
}
