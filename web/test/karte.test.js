import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import stadt from '../../api/stadt/musterstadt.json';
import {
  begrenze,
  erstelleProjektion,
  glattePfad,
  naechsterOrt,
  verschiebe,
} from '../src/karte.js';
import OrtsKarte from '../src/teile/OrtsKarte.vue';

const { grenzen } = stadt;

describe('Kartenrechnung', () => {
  it('bildet die Grenzen auf die Ecken ab und zurück', () => {
    const p = erstelleProjektion(grenzen);
    expect(p.x(grenzen.west)).toBe(0);
    expect(p.x(grenzen.ost)).toBe(1000);
    expect(p.y(grenzen.nord)).toBe(0);
    expect(p.y(grenzen.sued)).toBeCloseTo(p.hoehe);
    expect(p.lng(p.x(10.45))).toBeCloseTo(10.45, 8);
    expect(p.lat(p.y(51.16))).toBeCloseTo(51.16, 8);
  });

  it('hält das Seitenverhältnis der echten Entfernungen', () => {
    const p = erstelleProjektion(grenzen);
    const breitengrad = (((grenzen.sued + grenzen.nord) / 2) * Math.PI) / 180;
    const erwartet =
      ((grenzen.nord - grenzen.sued) / ((grenzen.ost - grenzen.west) * Math.cos(breitengrad))) *
      1000;
    expect(Math.abs(p.hoehe - erwartet)).toBeLessThan(1);
  });

  it('zeichnet eine glatte Linie durch alle Punkte', () => {
    const pfad = glattePfad([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(pfad.startsWith('M0.0 0.0')).toBe(true);
    expect(pfad.match(/C/g)).toHaveLength(2);
    expect(pfad.endsWith('20.0 0.0')).toBe(true);
  });

  it('verschiebt um Meter', () => {
    const start = { lng: 10.45, lat: 51.16 };
    expect(verschiebe(start, 0, 111.32).lat).toBeCloseTo(51.161, 6);
    expect(verschiebe(start, 100, 0).lng).toBeGreaterThan(start.lng);
  });

  it('bleibt in den Grenzen', () => {
    expect(begrenze({ lng: 99, lat: -99 }, grenzen)).toEqual({
      lng: grenzen.ost,
      lat: grenzen.sued,
    });
  });

  it('findet den nächsten Ort', () => {
    const ort = stadt.orte[2];
    expect(naechsterOrt(stadt.orte, { lng: ort.lng + 0.0001, lat: ort.lat }).name).toBe(ort.name);
  });
});

describe('OrtsKarte', () => {
  function zeige(props = {}) {
    return mount(OrtsKarte, { props: { stadt, waehlbar: true, ...props } });
  }

  function legeFlaecheFest(svg) {
    vi.spyOn(svg.element, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 500,
      height: 439,
    });
  }

  it('wandelt einen Klick in Koordinaten um', async () => {
    const wrapper = zeige();
    const svg = wrapper.find('svg');
    legeFlaecheFest(svg);
    await svg.trigger('click', { clientX: 350, clientY: 269.5 });
    const [wahl] = wrapper.emitted('waehle')[0];
    expect(wahl.lng).toBeCloseTo((grenzen.west + grenzen.ost) / 2, 6);
    expect(wahl.lat).toBeCloseTo((grenzen.sued + grenzen.nord) / 2, 3);
  });

  it('lässt sich mit den Pfeiltasten bedienen', async () => {
    const markierung = { lng: 10.45, lat: 51.16 };
    const wrapper = zeige({ markierung });
    await wrapper.find('svg').trigger('keydown', { key: 'ArrowUp' });
    await wrapper.find('svg').trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    const [hoch] = wrapper.emitted('waehle')[0];
    const [rechts] = wrapper.emitted('waehle')[1];
    expect(hoch.lat).toBeGreaterThan(markierung.lat);
    expect(hoch.lng).toBe(markierung.lng);
    expect(rechts.lng - markierung.lng).toBeGreaterThan((hoch.lat - markierung.lat) * 2);
  });

  it('startet die Pfeiltasten in der Mitte, wenn noch nichts gewählt ist', async () => {
    const wrapper = zeige();
    await wrapper.find('svg').trigger('keydown', { key: 'ArrowLeft' });
    const [wahl] = wrapper.emitted('waehle')[0];
    expect(wahl.lat).toBeCloseTo((grenzen.sued + grenzen.nord) / 2, 6);
  });

  it('ignoriert andere Tasten', async () => {
    const wrapper = zeige();
    await wrapper.find('svg').trigger('keydown', { key: 'a' });
    expect(wrapper.emitted('waehle')).toBeUndefined();
  });

  it('wählt auf der Übersichtskarte keine Orte', async () => {
    const wrapper = zeige({ waehlbar: false });
    const svg = wrapper.find('svg');
    legeFlaecheFest(svg);
    await svg.trigger('click', { clientX: 200, clientY: 200 });
    await svg.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.emitted('waehle')).toBeUndefined();
    expect(svg.attributes('tabindex')).toBeUndefined();
    expect(svg.attributes('role')).toBe('group');
  });

  it('macht Pins per Maus und Tastatur auswählbar und benennt sie', async () => {
    const pins = [{ id: 'a', lng: 10.45, lat: 51.16, status: 'neu', titel: 'Beleuchtung, neu' }];
    const wrapper = zeige({ waehlbar: false, pins });
    const pin = wrapper.find('.k-pin');
    expect(pin.attributes('aria-label')).toBe('Beleuchtung, neu');
    expect(pin.attributes('tabindex')).toBe('0');
    await pin.trigger('click');
    await pin.trigger('keydown', { key: 'Enter' });
    await pin.trigger('keydown', { key: ' ' });
    expect(wrapper.emitted('pin')).toEqual([['a'], ['a'], ['a']]);
  });

  it('zeichnet den ausgewählten Pin zuletzt, also obenauf', async () => {
    const pins = [
      { id: 'a', lng: 10.45, lat: 51.16, status: 'neu', titel: 'A' },
      { id: 'b', lng: 10.451, lat: 51.16, status: 'erledigt', titel: 'B' },
    ];
    const wrapper = zeige({ waehlbar: false, pins, ausgewaehlt: 'a' });
    await flushPromises();
    const alle = wrapper.findAll('.k-pin');
    expect(alle.at(-1).attributes('aria-label')).toBe('A');
    expect(alle.at(-1).attributes('aria-pressed')).toBe('true');
  });

  it('zeigt die Markierung nur, wenn ein Ort gewählt ist', () => {
    expect(zeige().find('[data-testid="markierung"]').exists()).toBe(false);
    const wrapper = zeige({ markierung: { lng: 10.45, lat: 51.16 } });
    expect(wrapper.find('[data-testid="markierung"]').exists()).toBe(true);
  });
});
