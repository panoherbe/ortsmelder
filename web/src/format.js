const DATUM = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const DATUM_ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const ZAHL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export const datum = (wert) => DATUM.format(new Date(wert));
export const datumZeit = (wert) => `${DATUM_ZEIT.format(new Date(wert))} Uhr`;
export const zahl = (wert) => ZAHL.format(wert);

export function dauer(stunden) {
  if (stunden < 1) return 'unter 1 Stunde';
  if (stunden < 48) return `${zahl(stunden)} ${stunden === 1 ? 'Stunde' : 'Stunden'}`;
  return `${zahl(stunden / 24)} Tage`;
}

export function vorKurzem(wert, jetzt = Date.now()) {
  const tage = Math.floor((jetzt - new Date(wert).getTime()) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

export const meter = (wert) => `${zahl(wert)} m`;
