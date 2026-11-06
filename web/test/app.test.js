import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { setzeGrundlagen } from '../src/grundlagen.js';
import { erstelleRouter } from '../src/router.js';
import { fetchAttrappe, GRUNDLAGEN } from './hilfe.js';

async function starte(pfad = '/') {
  const router = erstelleRouter(createMemoryHistory());
  await router.push(pfad);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setzeGrundlagen(null);
  document.body.innerHTML = '';
});

describe('Rahmen', () => {
  it('bietet Sprunglink, Navigation und Hauptbereich', async () => {
    fetchAttrappe({ 'GET /api/grundlagen': [200, GRUNDLAGEN] });
    const { wrapper } = await starte();
    expect(wrapper.find('a.sprunglink').attributes('href')).toBe('#inhalt');
    expect(wrapper.find('nav').attributes('aria-label')).toBe('Hauptnavigation');
    expect(wrapper.find('main#inhalt').exists()).toBe(true);
    expect(wrapper.find('h1').exists()).toBe(true);
    wrapper.unmount();
  });

  it('setzt den Seitentitel und bewegt den Fokus beim Seitenwechsel', async () => {
    fetchAttrappe({ 'GET /api/grundlagen': [200, GRUNDLAGEN] });
    const { wrapper, router } = await starte();
    expect(document.title).toBe('Melden · Ortsmelder');
    expect(document.activeElement).not.toBe(wrapper.find('main').element);
    await router.push('/stand');
    await flushPromises();
    expect(document.title).toBe('Stand prüfen · Ortsmelder');
    expect(document.activeElement).toBe(wrapper.find('main').element);
    wrapper.unmount();
  });

  it('nennt die Beispieldaten nur im Demo-Modus', async () => {
    fetchAttrappe({ 'GET /api/grundlagen': [200, { ...GRUNDLAGEN, demo: false }] });
    const { wrapper } = await starte();
    expect(wrapper.find('footer').text()).toBe('Offener Code unter EUPL-1.2.');
    wrapper.unmount();
  });

  it('bietet bei einem Ausfall einen neuen Versuch an', async () => {
    let fehlschlaege = 1;
    fetchAttrappe({
      'GET /api/grundlagen': () =>
        fehlschlaege-- > 0 ? [503, { fehler: 'Gerade nicht erreichbar.' }] : [200, GRUNDLAGEN],
    });
    const { wrapper } = await starte();
    expect(wrapper.find('[role="alert"]').text()).toContain('Gerade nicht erreichbar.');
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('h1').text()).toContain('Etwas kaputt');
    wrapper.unmount();
  });

  it('zeigt unbekannte Adressen freundlich', async () => {
    fetchAttrappe({ 'GET /api/grundlagen': [200, GRUNDLAGEN] });
    const { wrapper } = await starte('/gibt/es/nicht');
    expect(wrapper.find('h1').text()).toBe('Diese Seite gibt es nicht');
    wrapper.unmount();
  });
});
