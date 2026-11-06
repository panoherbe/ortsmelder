export class ApiFehler extends Error {
  constructor(status, inhalt) {
    super(inhalt?.fehler ?? 'Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.');
    this.status = status;
    this.felder = inhalt?.felder ?? {};
  }
}

async function anfrage(pfad, { methode = 'GET', daten } = {}) {
  let antwort;
  try {
    antwort = await fetch(`/api${pfad}`, {
      method: methode,
      headers: daten === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: daten === undefined ? undefined : JSON.stringify(daten),
    });
  } catch {
    throw new ApiFehler(0, {
      fehler: 'Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.',
    });
  }
  const text = await antwort.text();
  let inhalt = null;
  try {
    inhalt = text ? JSON.parse(text) : null;
  } catch {
    inhalt = null;
  }
  if (!antwort.ok) throw new ApiFehler(antwort.status, inhalt);
  return inhalt;
}

function alsQuery(werte) {
  const parameter = new URLSearchParams();
  for (const [name, wert] of Object.entries(werte)) {
    if (wert !== undefined && wert !== null && wert !== '') parameter.set(name, wert);
  }
  const text = parameter.toString();
  return text ? `?${text}` : '';
}

export const api = {
  grundlagen: () => anfrage('/grundlagen'),
  melde: (daten) => anfrage('/meldungen', { methode: 'POST', daten }),
  stand: (code) => anfrage(`/meldungen/${encodeURIComponent(code)}`),
  nahe: (lng, lat) => anfrage(`/meldungen/nahe${alsQuery({ lng, lat })}`),
  anmelden: (schluessel) =>
    anfrage('/verwaltung/anmelden', { methode: 'POST', daten: { schluessel } }),
  abmelden: () => anfrage('/verwaltung/abmelden', { methode: 'POST' }),
  sitzung: () => anfrage('/verwaltung/sitzung'),
  kennzahlen: () => anfrage('/verwaltung/kennzahlen'),
  meldungen: (filter) => anfrage(`/verwaltung/meldungen${alsQuery(filter)}`),
  meldung: (id) => anfrage(`/verwaltung/meldungen/${id}`),
  aendere: (id, daten) => anfrage(`/verwaltung/meldungen/${id}`, { methode: 'PATCH', daten }),
};
