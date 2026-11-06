import { flushPromises, mount } from '@vue/test-utils';
import { vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import stadt from '../../api/stadt/musterstadt.json';
import { setzeGrundlagen } from '../src/grundlagen.js';
import { erstelleRouter } from '../src/router.js';

export const GRUNDLAGEN = {
  stadt,
  demo: true,
  demoSchluessel: 'demo-verwaltung',
  kategorien: [
    { id: 'strasse', name: 'Straße und Gehweg' },
    { id: 'licht', name: 'Beleuchtung' },
    { id: 'muell', name: 'Müll und Sauberkeit' },
  ],
  status: [
    { id: 'neu', name: 'Eingegangen' },
    { id: 'in_arbeit', name: 'In Arbeit' },
    { id: 'weitergeleitet', name: 'Weitergeleitet' },
    { id: 'erledigt', name: 'Erledigt' },
  ],
};

/** Replaces fetch: routes maps "METHOD /path" (without query) to [status, body] or a function. */
export function fetchAttrappe(routen) {
  const aufrufe = [];
  const attrappe = vi.fn(async (url, optionen = {}) => {
    const methode = optionen.method ?? 'GET';
    const pfad = url.split('?')[0];
    const daten = optionen.body ? JSON.parse(optionen.body) : undefined;
    aufrufe.push({ methode, url, pfad, daten });
    const eintrag = routen[`${methode} ${pfad}`];
    if (!eintrag) return new Response('{"fehler":"nicht vorgesehen"}', { status: 500 });
    const [status, inhalt] = typeof eintrag === 'function' ? eintrag(daten, url) : eintrag;
    return new Response(inhalt === undefined ? null : JSON.stringify(inhalt), { status });
  });
  vi.stubGlobal('fetch', attrappe);
  return aufrufe;
}

export async function montiere(komponente, { pfad = '/', anhaengen = false, props } = {}) {
  setzeGrundlagen(GRUNDLAGEN);
  const router = erstelleRouter(createMemoryHistory());
  await router.push(pfad);
  await router.isReady();
  const wrapper = mount(komponente, {
    props,
    global: { plugins: [router] },
    attachTo: anhaengen ? document.body : undefined,
  });
  await flushPromises();
  return { wrapper, router };
}
