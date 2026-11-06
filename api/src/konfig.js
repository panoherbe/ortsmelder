const DEMO_SCHLUESSEL = 'demo-verwaltung';
const MINDESTLAENGE_SCHLUESSEL = 16;

function ganzzahl(wert, standard) {
  if (wert === undefined || wert === '') return standard;
  const zahl = Number(wert);
  if (!Number.isInteger(zahl) || zahl < 0) throw new Error(`Keine gültige Zahl: ${wert}`);
  return zahl;
}

/** Reads the environment. Live operation refuses to start without a real key. */
export function ladeKonfig(env = process.env) {
  const demo = env.OM_DEMO === '1';
  const eigenerSchluessel = env.OM_VERWALTUNG_SCHLUESSEL || '';
  if (!demo && eigenerSchluessel.length < MINDESTLAENGE_SCHLUESSEL) {
    throw new Error(
      `OM_VERWALTUNG_SCHLUESSEL braucht mindestens ${MINDESTLAENGE_SCHLUESSEL} Zeichen (oder OM_DEMO=1).`,
    );
  }
  return {
    port: ganzzahl(env.OM_API_PORT, 8080),
    mongoUrl: env.OM_MONGO_URL || 'mongodb://127.0.0.1:27017/ortsmelder',
    demo,
    verwaltungSchluessel: eigenerSchluessel || DEMO_SCHLUESSEL,
    demoSchluesselZeigen: demo && !eigenerSchluessel,
    cookieSecure: env.OM_COOKIE_SECURE ? env.OM_COOKIE_SECURE === '1' : !demo,
    proxyStufen: ganzzahl(env.OM_PROXY_STUFEN, 0),
    webVerzeichnis: env.OM_WEB_VERZEICHNIS || null,
    stadtDatei: env.OM_STADT_DATEI || null,
    sitzungStunden: ganzzahl(env.OM_SITZUNG_STUNDEN, 8),
    grenzen: {
      meldenJe10Minuten: ganzzahl(env.OM_GRENZE_MELDEN, 5),
      anmeldenJe15Minuten: ganzzahl(env.OM_GRENZE_ANMELDEN, 10),
      lesenJeMinute: ganzzahl(env.OM_GRENZE_LESEN, 300),
    },
  };
}
