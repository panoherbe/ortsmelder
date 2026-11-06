import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { kennzahlen } from '../../src/abfragen.js';
import { fuelleDemoDaten } from '../../src/demo.js';
import { Meldung } from '../../src/modelle/meldung.js';
import { legeAn, leere, stadt, trenne, verbinde } from '../hilfe.js';

const STUNDE = 3600000;

function erledigtNach(stunden) {
  const eingegangenAm = new Date('2026-10-01T08:00:00Z');
  return {
    status: 'erledigt',
    eingegangenAm,
    erledigtAm: new Date(eingegangenAm.getTime() + stunden * STUNDE),
  };
}

describe('Kennzahlen aus der Aggregation', () => {
  beforeAll(() => verbinde('kennzahlen'));
  afterAll(trenne);
  beforeEach(leere);

  it('kommt mit einer leeren Datenbank zurecht', async () => {
    expect(await kennzahlen()).toEqual({
      nachStatus: {},
      nachKategorie: [],
      schwerpunkte: [],
      bearbeitung: null,
    });
  });

  it('zählt je Status', async () => {
    await legeAn({ status: 'neu' });
    await legeAn({ status: 'neu' });
    await legeAn({ status: 'in_arbeit' });
    await legeAn(erledigtNach(5));
    const { nachStatus } = await kennzahlen();
    expect(nachStatus).toEqual({ neu: 2, in_arbeit: 1, erledigt: 1 });
  });

  it('rechnet den Median der Bearbeitungszeit, nicht den Mittelwert', async () => {
    await legeAn(erledigtNach(24));
    await legeAn(erledigtNach(48));
    await legeAn(erledigtNach(240));
    await legeAn({ status: 'neu' });
    const { bearbeitung } = await kennzahlen();
    expect(bearbeitung).toEqual({ medianStunden: 48, anzahl: 3 });
  });

  it('rechnet die Bearbeitungszeit genau, nicht nach Stundengrenzen', async () => {
    const eingegangenAm = new Date('2026-10-01T10:59:00Z');
    await legeAn({
      status: 'erledigt',
      eingegangenAm,
      erledigtAm: new Date('2026-10-01T11:01:00Z'),
    });
    const { bearbeitung } = await kennzahlen();
    expect(bearbeitung.medianStunden).toBeCloseTo(2 / 60, 5);
  });

  it('nennt Schwerpunkte nur aus offenen Meldungen, größte zuerst, höchstens fünf', async () => {
    for (const [ort, anzahl] of [
      ['Marktplatz', 3],
      ['Stadtpark', 2],
      ['Schulweg', 1],
      ['Sportplatz', 1],
      ['Mühlenweg', 1],
      ['Gartenstraße', 1],
    ]) {
      for (let i = 0; i < anzahl; i += 1) await legeAn({ ortName: ort });
    }
    await legeAn({ ...erledigtNach(1), ortName: 'Lindenallee' });
    await legeAn({ ...erledigtNach(1), ortName: 'Lindenallee' });
    await legeAn({ ...erledigtNach(1), ortName: 'Lindenallee' });
    await legeAn({ ...erledigtNach(1), ortName: 'Lindenallee' });
    const { schwerpunkte } = await kennzahlen();
    expect(schwerpunkte).toHaveLength(5);
    expect(schwerpunkte[0]).toEqual({ ort: 'Marktplatz', anzahl: 3 });
    expect(schwerpunkte[1]).toEqual({ ort: 'Stadtpark', anzahl: 2 });
    expect(schwerpunkte.map((s) => s.ort)).not.toContain('Lindenallee');
  });

  it('zählt offene Meldungen je Kategorie', async () => {
    await legeAn({ kategorie: 'muell' });
    await legeAn({ kategorie: 'muell' });
    await legeAn({ kategorie: 'licht' });
    await legeAn({ ...erledigtNach(1), kategorie: 'gruen' });
    const { nachKategorie } = await kennzahlen();
    expect(nachKategorie).toEqual([
      { kategorie: 'muell', anzahl: 2 },
      { kategorie: 'licht', anzahl: 1 },
    ]);
  });
});

describe('Demo-Daten', () => {
  beforeAll(() => verbinde('demo'));
  afterAll(trenne);
  beforeEach(leere);

  it('füllt eine leere Datenbank mit gültigen Meldungen', async () => {
    const angelegt = await fuelleDemoDaten(stadt);
    expect(angelegt).toBeGreaterThan(20);
    expect(await Meldung.countDocuments()).toBe(angelegt);
    for (const meldung of await Meldung.find()) await meldung.validate();
  });

  it('rührt vorhandene Daten beim Neustart nicht an', async () => {
    await legeAn({ beschreibung: 'Von einem Menschen eingegeben' });
    expect(await fuelleDemoDaten(stadt)).toBe(0);
    expect(await Meldung.countDocuments()).toBe(1);
  });

  it('liefert alle Stände für die Vorführung und lässt Datumsangaben stimmen', async () => {
    await fuelleDemoDaten(stadt);
    expect((await Meldung.distinct('status')).sort()).toEqual([
      'erledigt',
      'in_arbeit',
      'neu',
      'weitergeleitet',
    ]);
    const erledigt = await Meldung.find({ status: 'erledigt' });
    for (const m of erledigt)
      expect(m.erledigtAm.getTime()).toBeGreaterThan(m.eingegangenAm.getTime());
    const { bearbeitung } = await kennzahlen();
    expect(bearbeitung.anzahl).toBe(erledigt.length);
  });
});
