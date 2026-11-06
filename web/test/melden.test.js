import { flushPromises } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MeldenSeite from '../src/seiten/MeldenSeite.vue';
import { fetchAttrappe, montiere } from './hilfe.js';

const ORT = 'Marktplatz';

async function fuelleAus(wrapper) {
  await wrapper.find('input[value="licht"]').setValue(true);
  await wrapper.find('[data-testid="ort-liste"]').setValue(ORT);
  await wrapper.find('#beschreibung').setValue('Die Laterne flackert.');
}

describe('Meldeformular', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('nennt fehlende Angaben, sendet nichts und setzt den Fokus', async () => {
    const aufrufe = fetchAttrappe({});
    const { wrapper } = await montiere(MeldenSeite, { anhaengen: true });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(aufrufe).toEqual([]);
    expect(wrapper.text()).toContain('Bitte wählen Sie eine Kategorie.');
    expect(wrapper.text()).toContain('Bitte wählen Sie einen Ort.');
    expect(wrapper.text()).toContain('Bitte beschreiben Sie kurz');
    expect(wrapper.find('#beschreibung').attributes('aria-invalid')).toBe('true');
    expect(document.activeElement?.tagName).toBe('INPUT');
    wrapper.unmount();
  });

  it('nimmt Fehler zurück, sobald das Feld korrigiert wird', async () => {
    fetchAttrappe({});
    const { wrapper } = await montiere(MeldenSeite);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await wrapper.find('input[value="licht"]').setValue(true);
    expect(wrapper.text()).not.toContain('Bitte wählen Sie eine Kategorie.');
    await wrapper.find('#beschreibung').setValue('Die Laterne flackert.');
    expect(wrapper.find('#beschreibung').attributes('aria-invalid')).toBeUndefined();
  });

  it('sendet die Meldung und zeigt danach den Stand', async () => {
    const aufrufe = fetchAttrappe({
      'POST /api/meldungen': [201, { vorgangscode: 'ABCD-EFGH-JK' }],
      'GET /api/meldungen/nahe': [200, { treffer: [], umkreisMeter: 150 }],
      'GET /api/meldungen/ABCD-EFGH-JK': [404, { fehler: 'x' }],
    });
    const { wrapper, router } = await montiere(MeldenSeite);
    await fuelleAus(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const gesendet = aufrufe.find((a) => a.methode === 'POST');
    expect(gesendet.daten).toMatchObject({
      kategorie: 'licht',
      beschreibung: 'Die Laterne flackert.',
    });
    expect(typeof gesendet.daten.lng).toBe('number');
    expect(gesendet.daten).not.toHaveProperty('hinweis');
    expect(router.currentRoute.value.fullPath).toBe('/meldung/ABCD-EFGH-JK?neu=1');
  });

  it('sendet den freiwilligen Hinweis mit', async () => {
    const aufrufe = fetchAttrappe({
      'POST /api/meldungen': [201, { vorgangscode: 'ABCD-EFGH-JK' }],
      'GET /api/meldungen/nahe': [200, { treffer: [] }],
      'GET /api/meldungen/ABCD-EFGH-JK': [404, { fehler: 'x' }],
    });
    const { wrapper } = await montiere(MeldenSeite);
    await fuelleAus(wrapper);
    await wrapper.find('input[type="text"]:not([name="website"])').setValue('vor Hausnummer 12');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(aufrufe.find((a) => a.methode === 'POST').daten.hinweis).toBe('vor Hausnummer 12');
  });

  it('zeigt den gewählten Ort und was dort schon bekannt ist', async () => {
    fetchAttrappe({
      'GET /api/meldungen/nahe': [
        200,
        { treffer: [{ kategorie: 'licht', status: 'in_arbeit', entfernungMeter: 40 }] },
      ],
    });
    const { wrapper } = await montiere(MeldenSeite);
    await wrapper.find('[data-testid="ort-liste"]').setValue(ORT);
    expect(wrapper.find('[data-testid="ort-wahl"]').text()).toBe('Gewählt: bei Marktplatz');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    const nahe = wrapper.find('[data-testid="nahe"]');
    expect(nahe.text()).toContain('Beleuchtung, rund 40 m entfernt');
    expect(nahe.text()).toContain('In Arbeit');
  });

  it('bleibt bedienbar, wenn die Umkreissuche ausfällt', async () => {
    fetchAttrappe({ 'GET /api/meldungen/nahe': [500, { fehler: 'x' }] });
    const { wrapper } = await montiere(MeldenSeite);
    await wrapper.find('[data-testid="ort-liste"]').setValue(ORT);
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.find('[data-testid="nahe"]').exists()).toBe(false);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('übernimmt Feldfehler des Servers', async () => {
    fetchAttrappe({
      'POST /api/meldungen': [
        422,
        {
          fehler: 'Da fehlt noch etwas.',
          felder: { ort: 'Bitte wählen Sie einen Ort auf der Karte.' },
        },
      ],
      'GET /api/meldungen/nahe': [200, { treffer: [] }],
    });
    const { wrapper } = await montiere(MeldenSeite);
    await fuelleAus(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Bitte wählen Sie einen Ort auf der Karte.');
    expect(wrapper.find('[role="alert"]').text()).toBe('Da fehlt noch etwas.');
  });

  it('meldet die Aufrufbegrenzung freundlich und behält die Eingaben', async () => {
    fetchAttrappe({
      'POST /api/meldungen': [429, { fehler: 'Danke für Ihren Einsatz!' }],
      'GET /api/meldungen/nahe': [200, { treffer: [] }],
    });
    const { wrapper } = await montiere(MeldenSeite);
    await fuelleAus(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Danke für Ihren Einsatz!');
    expect(wrapper.find('#beschreibung').element.value).toBe('Die Laterne flackert.');
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('meldet eine fehlende Verbindung verständlich', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { wrapper } = await montiere(MeldenSeite);
    await fuelleAus(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('Keine Verbindung');
  });

  it('versteckt das Köderfeld vor Menschen und Hilfstechnik', async () => {
    fetchAttrappe({});
    const { wrapper } = await montiere(MeldenSeite);
    const koeder = wrapper.find('input[name="website"]');
    expect(koeder.attributes('aria-hidden')).toBe('true');
    expect(koeder.attributes('tabindex')).toBe('-1');
  });

  it('hat in der Struktur keine axe-Verstöße', async () => {
    vi.useRealTimers();
    fetchAttrappe({});
    const { wrapper } = await montiere(MeldenSeite, { anhaengen: true });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    // jsdom draws nothing, so contrast is checked in the real browser (e2e).
    const ergebnis = await axe.run(wrapper.element.parentElement, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(ergebnis.violations.map((v) => v.id)).toEqual([]);
    wrapper.unmount();
  });
});
