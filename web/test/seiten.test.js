import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnmeldenSeite from '../src/seiten/AnmeldenSeite.vue';
import StandSeite from '../src/seiten/StandSeite.vue';
import StatusSeite from '../src/seiten/StatusSeite.vue';
import { fetchAttrappe, GRUNDLAGEN, montiere } from './hilfe.js';
import { setzeGrundlagen } from '../src/grundlagen.js';

const MELDUNG = {
  vorgangscode: 'ABCD-EFGH-JK',
  kategorie: 'licht',
  ort: { name: 'Marktplatz' },
  status: 'in_arbeit',
  antwort: 'Wir kümmern uns.',
  eingegangenAm: '2026-03-07T09:00:00Z',
  verlauf: [
    { am: '2026-03-07T09:00:00Z', status: 'neu' },
    { am: '2026-03-08T09:00:00Z', status: 'in_arbeit' },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('Stand einer Meldung', () => {
  it('zeigt Kategorie, Ort, Stand, Antwort und Verlauf', async () => {
    fetchAttrappe({ 'GET /api/meldungen/ABCD-EFGH-JK': [200, MELDUNG] });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/ABCD-EFGH-JK' });
    expect(wrapper.find('h1').text()).toBe('Ihre Meldung');
    expect(wrapper.text()).toContain('Beleuchtung');
    expect(wrapper.text()).toContain('bei Marktplatz, Musterstadt');
    expect(wrapper.find('[data-testid="status"]').text()).toBe('In Arbeit');
    expect(wrapper.find('[data-testid="antwort"]').text()).toContain('Wir kümmern uns.');
    expect(wrapper.findAll('.zeitlauf li')).toHaveLength(2);
    expect(wrapper.find('.zeitlauf').text()).toContain('07.03.2026');
  });

  it('bedankt sich direkt nach dem Melden und zeigt den Code groß', async () => {
    fetchAttrappe({
      'GET /api/meldungen/ABCD-EFGH-JK': [200, { ...MELDUNG, antwort: null, status: 'neu' }],
    });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/ABCD-EFGH-JK?neu=1' });
    expect(wrapper.find('h1').text()).toBe('Danke! Ihre Meldung ist da.');
    expect(wrapper.find('[data-testid="vorgangscode"]').text()).toBe('ABCD-EFGH-JK');
    expect(wrapper.find('[data-testid="antwort"]').exists()).toBe(false);
  });

  it('kopiert den Code und sagt es', async () => {
    const schreibe = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText: schreibe } });
    fetchAttrappe({ 'GET /api/meldungen/ABCD-EFGH-JK': [200, MELDUNG] });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/ABCD-EFGH-JK?neu=1' });
    await wrapper.find('.danke button').trigger('click');
    await flushPromises();
    expect(schreibe).toHaveBeenCalledWith('ABCD-EFGH-JK');
    expect(wrapper.find('.danke').text()).toContain('Code kopiert.');
  });

  it.each([
    ['ohne Zwischenablage', {}],
    [
      'bei verweigerter Zwischenablage',
      { clipboard: { writeText: () => Promise.reject(new Error('nein')) } },
    ],
  ])('behauptet %s nicht, kopiert zu haben', async (_name, navigatorAttrappe) => {
    vi.stubGlobal('navigator', navigatorAttrappe);
    fetchAttrappe({ 'GET /api/meldungen/ABCD-EFGH-JK': [200, MELDUNG] });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/ABCD-EFGH-JK?neu=1' });
    await wrapper.find('.danke button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.danke').text()).not.toContain('Code kopiert.');
    expect(wrapper.find('.danke').text()).toContain('von Hand');
  });

  it('nennt einen Ausfall nicht „nicht gefunden“ und bietet einen neuen Versuch', async () => {
    let fehlschlaege = 1;
    fetchAttrappe({
      'GET /api/meldungen/ABCD-EFGH-JK': () =>
        fehlschlaege-- > 0 ? [500, { fehler: 'Gerade nicht erreichbar.' }] : [200, MELDUNG],
    });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/ABCD-EFGH-JK' });
    expect(wrapper.find('h1').text()).toBe('Gleich geht es weiter');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('h1').text()).toBe('Ihre Meldung');
  });

  it('hilft bei einem unbekannten Code weiter', async () => {
    fetchAttrappe({
      'GET /api/meldungen/XXXX': [
        404,
        { fehler: 'Zu diesem Code haben wir keine Meldung gefunden.' },
      ],
    });
    const { wrapper } = await montiere(StatusSeite, { pfad: '/meldung/XXXX' });
    expect(wrapper.text()).toContain('Zu diesem Code haben wir keine Meldung gefunden.');
    expect(wrapper.find('a').attributes('href')).toBe('/stand');
  });
});

describe('Code eingeben', () => {
  it('führt zur Meldung', async () => {
    fetchAttrappe({ 'GET /api/meldungen/ABCD-EFGH-JK': [200, MELDUNG] });
    const { wrapper, router } = await montiere(StandSeite, { pfad: '/stand' });
    await wrapper.find('input').setValue(' ABCD-EFGH-JK ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/meldung/ABCD-EFGH-JK');
  });

  it('bittet um den Code, wenn das Feld leer ist', async () => {
    fetchAttrappe({});
    const { wrapper, router } = await montiere(StandSeite, { pfad: '/stand' });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Bitte geben Sie Ihren Code ein.');
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true');
    expect(router.currentRoute.value.path).toBe('/stand');
  });
});

describe('Anmelden', () => {
  it('zeigt den Demo-Schlüssel nur im Demo-Modus', async () => {
    fetchAttrappe({});
    const demo = await montiere(AnmeldenSeite, { pfad: '/verwaltung/anmelden' });
    expect(demo.wrapper.find('[data-testid="demo-hinweis"]').text()).toContain('demo-verwaltung');
    demo.wrapper.unmount();
  });

  it('zeigt im Betrieb keinen Schlüssel', async () => {
    fetchAttrappe({});
    const { wrapper } = await montiere(AnmeldenSeite, { pfad: '/verwaltung/anmelden' });
    setzeGrundlagen({ ...GRUNDLAGEN, demoSchluessel: null });
    await flushPromises();
    expect(wrapper.find('[data-testid="demo-hinweis"]').exists()).toBe(false);
  });

  it('meldet einen falschen Schlüssel und setzt den Fokus zurück ins Feld', async () => {
    fetchAttrappe({
      'POST /api/verwaltung/anmelden': [401, { fehler: 'Dieser Schlüssel passt nicht.' }],
    });
    const { wrapper } = await montiere(AnmeldenSeite, {
      pfad: '/verwaltung/anmelden',
      anhaengen: true,
    });
    await wrapper.find('input').setValue('falsch');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Dieser Schlüssel passt nicht.');
    expect(document.activeElement).toBe(wrapper.find('input').element);
    wrapper.unmount();
  });

  it('führt nach der Anmeldung in die Verwaltung', async () => {
    const aufrufe = fetchAttrappe({
      'POST /api/verwaltung/anmelden': [204],
      'GET /api/verwaltung/sitzung': [401, { fehler: 'x' }],
    });
    const { wrapper, router } = await montiere(AnmeldenSeite, { pfad: '/verwaltung/anmelden' });
    await wrapper.find('input').setValue('richtig');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(aufrufe[0].daten).toEqual({ schluessel: 'richtig' });
    expect(router.currentRoute.value.name).toBe('verwaltung');
  });
});
