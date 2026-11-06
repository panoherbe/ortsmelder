import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VerwaltungSeite from '../src/seiten/VerwaltungSeite.vue';
import { fetchAttrappe, montiere } from './hilfe.js';

const MELDUNG = {
  id: 'abc',
  version: 3,
  vorgangscode: 'ABCD-EFGH-JK',
  kategorie: 'licht',
  beschreibung: 'Die Laterne flackert.',
  ort: { name: 'Marktplatz', hinweis: 'vor Hausnummer 12', lng: 10.45, lat: 51.161 },
  status: 'neu',
  antwort: null,
  eingegangenAm: '2026-03-07T09:00:00Z',
  erledigtAm: null,
  verlauf: [{ am: '2026-03-07T09:00:00Z', status: 'neu' }],
};
const ZWEITE = {
  ...MELDUNG,
  id: 'def',
  kategorie: 'muell',
  beschreibung: 'Der Papierkorb quillt über.',
  status: 'erledigt',
  ort: { name: 'Stadtpark', hinweis: null, lng: 10.46, lat: 51.16 },
};
const DETAIL = {
  ...MELDUNG,
  umkreisMeter: 250,
  umkreis: [
    {
      id: 'def',
      kategorie: 'muell',
      status: 'in_arbeit',
      ortName: 'Stadtpark',
      entfernungMeter: 90,
    },
  ],
};
const KENNZAHLEN = {
  nachStatus: { neu: 4, in_arbeit: 2, erledigt: 3 },
  nachKategorie: [{ kategorie: 'licht', anzahl: 4 }],
  schwerpunkte: [{ ort: 'Marktplatz', anzahl: 3 }],
  bearbeitung: { medianStunden: 72, anzahl: 3 },
};

function routen(ergaenzung = {}) {
  return {
    'GET /api/verwaltung/sitzung': [204],
    'GET /api/verwaltung/kennzahlen': [200, KENNZAHLEN],
    'GET /api/verwaltung/meldungen': [
      200,
      { eintraege: [MELDUNG, ZWEITE], gesamt: 2, seite: 1, seiten: 1 },
    ],
    'GET /api/verwaltung/meldungen/abc': [200, DETAIL],
    ...ergaenzung,
  };
}

const oeffne = (ergaenzung) => {
  const aufrufe = fetchAttrappe(routen(ergaenzung));
  return montiere(VerwaltungSeite, { pfad: '/verwaltung' }).then((r) => ({ ...r, aufrufe }));
};

async function waehleErste(wrapper) {
  await wrapper.find('.eintrag').trigger('click');
  await flushPromises();
}

afterEach(() => vi.unstubAllGlobals());

describe('Verwaltung', () => {
  it('schickt ohne Sitzung zur Anmeldung', async () => {
    const { router } = await oeffne({ 'GET /api/verwaltung/sitzung': [401, { fehler: 'x' }] });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('anmelden');
  });

  it('zeigt Kennzahlen deutsch formatiert', async () => {
    const { wrapper } = await oeffne();
    expect(wrapper.find('[data-testid="kennzahl-neu"]').text()).toContain('4');
    expect(wrapper.find('[data-testid="kennzahl-weitergeleitet"]').text()).toContain('0');
    expect(wrapper.find('[data-testid="kennzahl-dauer"]').text()).toContain('3 Tage');
  });

  it('kommt ohne erledigte Meldungen zurecht', async () => {
    const { wrapper } = await oeffne({
      'GET /api/verwaltung/kennzahlen': [200, { ...KENNZAHLEN, bearbeitung: null }],
    });
    expect(wrapper.find('[data-testid="kennzahl-dauer"]').text()).toContain('–');
  });

  it('listet Meldungen und setzt für jede einen Pin', async () => {
    const { wrapper } = await oeffne();
    expect(wrapper.findAll('.eintrag')).toHaveLength(2);
    expect(wrapper.findAll('.k-pin')).toHaveLength(2);
    expect(wrapper.find('.k-pin[aria-label*="Marktplatz"]').exists()).toBe(true);
    expect(wrapper.findAll('.k-pin').at(-1).classes()).toContain('pin-neu');
    expect(wrapper.find('[data-testid="anzahl"]').text()).toContain('2 Meldungen');
  });

  it('filtert per Kennzahl und nimmt den Filter beim zweiten Klick zurück', async () => {
    const { wrapper, aufrufe } = await oeffne();
    const kachel = wrapper.find('[data-testid="kennzahl-erledigt"]');
    await kachel.trigger('click');
    await flushPromises();
    expect(aufrufe.at(-1).url).toContain('status=erledigt');
    expect(kachel.attributes('aria-pressed')).toBe('true');
    await kachel.trigger('click');
    await flushPromises();
    expect(aufrufe.at(-1).url).not.toContain('status=');
  });

  it('sucht erst beim Absenden', async () => {
    const { wrapper, aufrufe } = await oeffne();
    const anzahl = aufrufe.length;
    await wrapper.find('[data-testid="suche"]').setValue('Laterne');
    await flushPromises();
    expect(aufrufe).toHaveLength(anzahl);
    await wrapper.find('form.filter').trigger('submit');
    await flushPromises();
    expect(aufrufe.at(-1).url).toContain('suche=Laterne');
  });

  it('filtert nach Schwerpunkt', async () => {
    const { wrapper, aufrufe } = await oeffne();
    await wrapper.find('.balken-knopf').trigger('click');
    await flushPromises();
    expect(aufrufe.at(-1).url).toContain('ort=Marktplatz');
  });

  it('öffnet das Detail über die Liste und über den Pin', async () => {
    const { wrapper } = await oeffne();
    expect(wrapper.find('[data-testid="detail"]').exists()).toBe(false);
    await wrapper.find('.k-pin[aria-label*="Marktplatz"]').trigger('click');
    await flushPromises();
    const detail = wrapper.find('[data-testid="detail"]');
    expect(detail.text()).toContain('Die Laterne flackert.');
    expect(detail.text()).toContain('vor Hausnummer 12');
    expect(detail.text()).toContain('ABCD-EFGH-JK');
    expect(wrapper.find('[data-testid="umkreis"]').text()).toContain('Müll und Sauberkeit, 90 m');
  });

  it('speichert Status und Antwort mit der geladenen Version und lädt neu', async () => {
    const { wrapper, aufrufe } = await oeffne({
      'PATCH /api/verwaltung/meldungen/abc': [200, { ...MELDUNG, status: 'in_arbeit' }],
    });
    await waehleErste(wrapper);
    await wrapper.find('input[name="status"][value="in_arbeit"]').setValue(true);
    await wrapper.find('[data-testid="antwort-feld"]').setValue('  Wir kümmern uns.  ');
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    const patch = aufrufe.find((a) => a.methode === 'PATCH');
    expect(patch.daten).toEqual({ version: 3, status: 'in_arbeit', antwort: 'Wir kümmern uns.' });
    const nach = aufrufe.slice(aufrufe.indexOf(patch) + 1).map((a) => a.pfad);
    expect(nach).toContain('/api/verwaltung/kennzahlen');
    expect(nach).toContain('/api/verwaltung/meldungen');
    expect(nach).toContain('/api/verwaltung/meldungen/abc');
  });

  it('sendet ohne Änderung nichts', async () => {
    const { wrapper, aufrufe } = await oeffne();
    await waehleErste(wrapper);
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    expect(aufrufe.some((a) => a.methode === 'PATCH')).toBe(false);
    expect(wrapper.find('[data-testid="rueckmeldung"]').text()).toBe('Alles schon gespeichert.');
  });

  it('übernimmt einen Textbaustein ins Antwortfeld', async () => {
    const { wrapper } = await oeffne();
    await waehleErste(wrapper);
    await wrapper.find('.baustein').trigger('click');
    expect(wrapper.find('[data-testid="antwort-feld"]').element.value).toContain('Danke');
  });

  it('erklärt einen Konflikt und zeigt den aktuellen Stand', async () => {
    const { wrapper, aufrufe } = await oeffne({
      'PATCH /api/verwaltung/meldungen/abc': [
        409,
        { fehler: 'Diese Meldung wurde gerade von jemand anderem geändert.' },
      ],
    });
    await waehleErste(wrapper);
    const vorher = aufrufe.filter((a) => a.pfad.endsWith('/abc') && a.methode === 'GET').length;
    await wrapper.find('input[name="status"][value="erledigt"]').setValue(true);
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[data-testid="detail"] [role="alert"]').text()).toContain(
      'gerade von jemand anderem',
    );
    const nachher = aufrufe.filter((a) => a.pfad.endsWith('/abc') && a.methode === 'GET').length;
    expect(nachher).toBe(vorher + 1);
  });

  it('überschreibt nach einem Konflikt nichts: das Formular zeigt den fremden Stand', async () => {
    let geaendert = false;
    const { wrapper, aufrufe } = await oeffne({
      'GET /api/verwaltung/meldungen/abc': () => [
        200,
        geaendert
          ? { ...DETAIL, version: 4, status: 'erledigt', antwort: 'Antwort der anderen Person' }
          : DETAIL,
      ],
      'PATCH /api/verwaltung/meldungen/abc': () => {
        geaendert = true;
        return [409, { fehler: 'Diese Meldung wurde gerade von jemand anderem geändert.' }];
      },
    });
    await waehleErste(wrapper);
    await wrapper.find('input[name="status"][value="in_arbeit"]').setValue(true);
    await wrapper.find('[data-testid="antwort-feld"]').setValue('Meine Antwort');
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('input[name="status"][value="erledigt"]').element.checked).toBe(true);
    expect(wrapper.find('[data-testid="antwort-feld"]').element.value).toBe(
      'Antwort der anderen Person',
    );
    const zahl = aufrufe.filter((a) => a.methode === 'PATCH').length;
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    expect(aufrufe.filter((a) => a.methode === 'PATCH')).toHaveLength(zahl);
    expect(wrapper.find('[data-testid="rueckmeldung"]').text()).toBe('Alles schon gespeichert.');
  });

  it('zeigt einen Ausfall der Sitzungsprüfung und erholt sich beim neuen Versuch', async () => {
    let fehlschlaege = 1;
    const { wrapper } = await oeffne({
      'GET /api/verwaltung/sitzung': () =>
        fehlschlaege-- > 0 ? [500, { fehler: 'Gerade nicht erreichbar.' }] : [204],
    });
    expect(wrapper.find('[role="alert"]').text()).toContain('Gerade nicht erreichbar.');
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.findAll('.eintrag')).toHaveLength(2);
  });

  it('hängt „Mehr laden“ an die Liste an und lädt bei einem Doppelklick nur einmal', async () => {
    const { wrapper, aufrufe } = await oeffne({
      'GET /api/verwaltung/meldungen': (_d, url) =>
        url.includes('seite=2')
          ? [200, { eintraege: [{ ...ZWEITE, id: 'ghi' }], gesamt: 3, seite: 2, seiten: 2 }]
          : [200, { eintraege: [MELDUNG, ZWEITE], gesamt: 3, seite: 1, seiten: 2 }],
    });
    expect(wrapper.find('[data-testid="karte-hinweis"]').text()).toContain('2 neuesten von 3');
    const knopf = wrapper.find('[data-testid="mehr-laden"]');
    await knopf.trigger('click');
    knopf.element.disabled = false;
    await knopf.element.dispatchEvent(new Event('click'));
    await flushPromises();
    expect(wrapper.findAll('.eintrag')).toHaveLength(3);
    expect(aufrufe.filter((a) => a.url.includes('seite=2'))).toHaveLength(1);
    expect(wrapper.find('[data-testid="karte-hinweis"]').exists()).toBe(false);
  });

  it('geht bei abgelaufener Sitzung auch von „Mehr laden“ zur Anmeldung', async () => {
    const { wrapper, router } = await oeffne({
      'GET /api/verwaltung/meldungen': (_d, url) =>
        url.includes('seite=2')
          ? [401, { fehler: 'x' }]
          : [200, { eintraege: [MELDUNG], gesamt: 2, seite: 1, seiten: 2 }],
    });
    await wrapper.find('[data-testid="mehr-laden"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('anmelden');
  });

  it('lässt eine langsame alte Antwort keinen neueren Filter überschreiben', async () => {
    let gibLangsameFrei;
    const langsam = new Promise((fertig) => {
      gibLangsameFrei = fertig;
    });
    fetchAttrappe(routen());
    const schnell = globalThis.fetch;
    vi.stubGlobal('fetch', async (url, optionen) => {
      if (url.includes('status=erledigt')) {
        await langsam;
        return new Response(
          JSON.stringify({ eintraege: [ZWEITE], gesamt: 1, seite: 1, seiten: 1 }),
          { status: 200 },
        );
      }
      if (url.includes('status=neu')) {
        return new Response(
          JSON.stringify({ eintraege: [MELDUNG], gesamt: 1, seite: 1, seiten: 1 }),
          { status: 200 },
        );
      }
      return schnell(url, optionen);
    });
    const { wrapper } = await montiere(VerwaltungSeite, { pfad: '/verwaltung' });
    await wrapper.find('[data-testid="kennzahl-erledigt"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="kennzahl-neu"]').trigger('click');
    await flushPromises();
    gibLangsameFrei();
    await flushPromises();
    await flushPromises();
    expect(wrapper.findAll('.eintrag')).toHaveLength(1);
    expect(wrapper.find('.eintrag').text()).toContain('Die Laterne flackert.');
  });

  it('geht bei abgelaufener Sitzung zur Anmeldung', async () => {
    const { wrapper, router } = await oeffne({
      'PATCH /api/verwaltung/meldungen/abc': [401, { fehler: 'x' }],
    });
    await waehleErste(wrapper);
    await wrapper.find('input[name="status"][value="erledigt"]').setValue(true);
    await wrapper.find('[data-testid="detail"] form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('anmelden');
  });

  it('meldet ab und führt zur Anmeldung', async () => {
    const { wrapper, router, aufrufe } = await oeffne({
      'POST /api/verwaltung/abmelden': [204],
    });
    await wrapper.find('.verwaltung-kopf button').trigger('click');
    await flushPromises();
    expect(aufrufe.some((a) => a.pfad === '/api/verwaltung/abmelden')).toBe(true);
    expect(router.currentRoute.value.name).toBe('anmelden');
  });
});
