import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STANDARD = fileURLToPath(new URL('../stadt/musterstadt.json', import.meta.url));
const ERDRADIUS_M = 6371008.8;

export function ladeStadt(datei) {
  return JSON.parse(readFileSync(datei || STANDARD, 'utf8'));
}

export function liegtInStadt(stadt, lng, lat) {
  const { west, ost, sued, nord } = stadt.grenzen;
  return lng >= west && lng <= ost && lat >= sued && lat <= nord;
}

export function abstandMeter([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * ERDRADIUS_M * Math.asin(Math.sqrt(a));
}

/** The named place closest to a point; it labels a report in lists and groups the focus areas. */
export function naechsterOrt(stadt, lng, lat) {
  let bester = stadt.orte[0];
  let besterAbstand = Infinity;
  for (const ort of stadt.orte) {
    const abstand = abstandMeter([lng, lat], [ort.lng, ort.lat]);
    if (abstand < besterAbstand) {
      bester = ort;
      besterAbstand = abstand;
    }
  }
  return bester.name;
}
