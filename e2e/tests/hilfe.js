import { appendFileSync } from 'node:fs';
import { expect, test as basis } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const SCHLUESSEL = 'demo-verwaltung';
const AXE_DATEI = `${process.env.OM_PRUEFUNG ?? '../pruefung'}/axe.jsonl`;

/** Every test fails on a console error or a CSP violation, wherever it happens. */
export const test = basis.extend({
  page: async ({ page }, nutze) => {
    const probleme = [];
    page.on('console', (nachricht) => {
      const text = nachricht.text();
      // A wrong key and a closed door are answers the pages handle, not faults.
      const erwartet = /status of 4\d\d/.test(text);
      if (nachricht.type() === 'error' && !erwartet) probleme.push(text);
    });
    page.on('pageerror', (fehler) => probleme.push(fehler.message));
    await nutze(page);
    expect(probleme).toEqual([]);
  },
});

export { expect };

export async function meldeAn(page) {
  await page.goto('/verwaltung/anmelden');
  await page.getByLabel('Schlüssel').fill(SCHLUESSEL);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { name: /Meldungen in/ })).toBeVisible();
}

/** Full WCAG 2.0-2.2 A/AA ruleset of axe, with the page really rendered (contrast included). */
export async function pruefeAxe(page, name) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const ergebnis = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  appendFileSync(
    AXE_DATEI,
    `${JSON.stringify({
      ansicht: name,
      breite: page.viewportSize().width,
      verstoesse: ergebnis.violations.map((v) => ({ id: v.id, knoten: v.nodes.length })),
      bestanden: ergebnis.passes.length,
    })}\n`,
  );
  expect(ergebnis.violations.map((v) => `${v.id}: ${v.nodes[0].target}`)).toEqual([]);
  // Guards against a run in which contrast silently was not measured.
  expect(ergebnis.passes.map((r) => r.id)).toContain('color-contrast');
}

export async function pruefeBreite(page) {
  const { breite, fenster } = await page.evaluate(() => ({
    breite: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
  }));
  expect(breite).toBeLessThanOrEqual(fenster);
}

export async function fuelleFormularAus(page, text) {
  await page.getByRole('radio', { name: 'Beleuchtung' }).check({ force: true });
  await page.getByLabel('Ort aus der Liste').selectOption('Schulweg');
  await page.getByLabel('Was ist zu sehen?').fill(text);
}
