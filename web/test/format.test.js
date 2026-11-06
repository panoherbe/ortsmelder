import { describe, expect, it } from 'vitest';
import { datum, datumZeit, dauer, meter, vorKurzem, zahl } from '../src/format.js';

describe('deutsche Formate', () => {
  it('schreibt Daten als TT.MM.JJJJ', () => {
    expect(datum('2026-03-07T12:00:00')).toBe('07.03.2026');
  });

  it('schreibt die Uhrzeit dazu', () => {
    expect(datumZeit('2026-03-07T09:05:00')).toMatch(/^07\.03\.2026, 09:05 Uhr$/);
  });

  it('schreibt Zahlen mit Komma und Tausenderpunkt', () => {
    expect(zahl(1.5)).toBe('1,5');
    expect(zahl(1234)).toBe('1.234');
    expect(meter(150)).toBe('150 m');
  });

  it('nennt kurze Dauern in Stunden, längere in Tagen', () => {
    expect(dauer(0.03)).toBe('unter 1 Stunde');
    expect(dauer(1)).toBe('1 Stunde');
    expect(dauer(36)).toBe('36 Stunden');
    expect(dauer(48)).toBe('2 Tage');
    expect(dauer(84)).toBe('3,5 Tage');
  });

  it('sagt heute, gestern und vor n Tagen', () => {
    const jetzt = new Date('2026-03-10T12:00:00').getTime();
    expect(vorKurzem('2026-03-10T08:00:00', jetzt)).toBe('heute');
    expect(vorKurzem('2026-03-09T10:00:00', jetzt)).toBe('gestern');
    expect(vorKurzem('2026-03-05T10:00:00', jetzt)).toBe('vor 5 Tagen');
  });
});
