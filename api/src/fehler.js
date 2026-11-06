export class Fehler extends Error {
  constructor(status, meldung, felder) {
    super(meldung);
    this.status = status;
    this.felder = felder;
  }
}

/** Turns a zod error into the first message per field, as the form shows them. */
export function eingabeFehler(zodFehler) {
  const felder = {};
  for (const fehler of zodFehler.issues) {
    const feld = fehler.path[0] ?? 'eingabe';
    const name = feld === 'lng' || feld === 'lat' ? 'ort' : feld;
    felder[name] ??= fehler.message;
  }
  return new Fehler(422, 'Da fehlt noch etwas.', felder);
}
