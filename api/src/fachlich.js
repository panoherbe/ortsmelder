export const KATEGORIEN = [
  { id: 'strasse', name: 'Straße und Gehweg' },
  { id: 'licht', name: 'Beleuchtung' },
  { id: 'muell', name: 'Müll und Sauberkeit' },
  { id: 'gruen', name: 'Grünflächen und Bäume' },
  { id: 'spielplatz', name: 'Spielplatz und Bänke' },
  { id: 'sonstiges', name: 'Etwas anderes' },
];

export const STATUS = [
  { id: 'neu', name: 'Eingegangen' },
  { id: 'in_arbeit', name: 'In Arbeit' },
  { id: 'weitergeleitet', name: 'Weitergeleitet' },
  { id: 'erledigt', name: 'Erledigt' },
];

export const KATEGORIE_IDS = KATEGORIEN.map((k) => k.id);
export const STATUS_IDS = STATUS.map((s) => s.id);

// Crockford base 32: no I, L, O, U, so a code survives being read out or copied by hand.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function neuerVorgangscode(zufall) {
  const zeichen = Array.from(zufall(10), (b) => ALPHABET[b & 31]).join('');
  return `${zeichen.slice(0, 4)}-${zeichen.slice(4, 8)}-${zeichen.slice(8)}`;
}

/** Returns the canonical form of a code as typed by a person, or null if it cannot be one. */
export function normalisiereCode(eingabe) {
  const roh = String(eingabe)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(roh)) return null;
  return `${roh.slice(0, 4)}-${roh.slice(4, 8)}-${roh.slice(8)}`;
}
