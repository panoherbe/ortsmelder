import { expect, fuelleFormularAus, meldeAn, test } from './hilfe.js';

test('Eine Meldung geht vom Formular bis zur Antwort durch das ganze System', async ({ page }) => {
  const text = `Laterne flackert, Fall ${Date.now()}`;

  await page.goto('/');
  await fuelleFormularAus(page, text);
  await page.getByRole('button', { name: 'Meldung absenden' }).click();
  await expect(page.getByRole('heading', { name: 'Danke! Ihre Meldung ist da.' })).toBeVisible();
  const code = await page.getByTestId('vorgangscode').innerText();
  expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
  await expect(page.getByTestId('status')).toHaveText('Eingegangen');

  await meldeAn(page);
  await page.getByTestId('suche').fill(text.split(', ')[1].replace('Fall ', ''));
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByTestId('anzahl')).toContainText('1 Meldung');
  await page.getByTestId('liste').getByRole('button').first().click();
  await expect(page.getByTestId('detail')).toContainText(text);
  await page.getByRole('radio', { name: 'In Arbeit' }).check({ force: true });
  await page.getByTestId('antwort-feld').fill('Danke! Wir tauschen die Laterne morgen.');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('rueckmeldung')).toContainText('Gespeichert');
  await expect(page.getByTestId('detail-status')).toHaveText('In Arbeit');

  await page.goto('/stand');
  await page.getByLabel('Ihr Code').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Stand anzeigen' }).click();
  await expect(page.getByTestId('status')).toHaveText('In Arbeit');
  await expect(page.getByTestId('antwort')).toContainText('Wir tauschen die Laterne morgen.');
  await expect(page.locator('body')).not.toContainText(text);
});

test('Der Ort lässt sich per Klick auf die Karte setzen und zeigt Bekanntes in der Nähe', async ({
  page,
}) => {
  await page.goto('/');
  const karte = page.getByRole('application', { name: /Karte von Musterstadt/ });
  await expect(page.getByTestId('markierung')).toHaveCount(0);
  await karte.scrollIntoViewIfNeeded();
  const flaeche = await karte.boundingBox();
  // Marktplatz sits at 50 % of the width and 49 % of the height of the map.
  await page.mouse.click(flaeche.x + flaeche.width * 0.5, flaeche.y + flaeche.height * 0.49);
  await expect(page.getByTestId('markierung')).toHaveCount(1);
  await expect(page.getByTestId('ort-wahl')).toContainText('Marktplatz');
  await expect(page.getByTestId('nahe')).toContainText('entfernt');
});

test('Der Ort lässt sich auch nur mit der Tastatur setzen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('application', { name: /Karte von Musterstadt/ }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('markierung')).toHaveCount(1);
  await expect(page.getByTestId('ort-wahl')).toContainText('Gewählt: bei');
  await expect(page.getByLabel('Ort aus der Liste')).toHaveValue('');
});

test('Ein Pin auf der Karte öffnet dieselbe Meldung wie die Liste', async ({ page }) => {
  await meldeAn(page);
  await page.locator('.k-pin[aria-label*="Bahnhofsvorplatz"]').click();
  const name = await page.locator('.k-pin.gewaehlt').getAttribute('aria-label');
  const [kategorie] = name.split(' bei ');
  await expect(page.getByTestId('detail').getByRole('heading', { level: 2 })).toHaveText(kategorie);
  await expect(page.locator('.eintrag.gewaehlt')).toHaveCount(1);
});

test('Filter und deutsche Suche grenzen die Liste ein', async ({ page }) => {
  await meldeAn(page);
  const gesamt = await page.getByTestId('anzahl').innerText();
  await page.getByTestId('kennzahl-erledigt').click();
  await expect(page.getByTestId('anzahl')).not.toHaveText(gesamt);
  await page.getByRole('button', { name: 'Alle zeigen' }).click();
  await expect(page.getByTestId('anzahl')).toHaveText(gesamt);

  await page.getByTestId('suche').fill('Laterne');
  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByTestId('liste')).toContainText('Laternen');
});

test('Die Verwaltung bleibt ohne Sitzung zu, auch nach dem Abmelden', async ({ page }) => {
  await page.goto('/verwaltung');
  await expect(page).toHaveURL(/verwaltung\/anmelden/);

  await page.getByLabel('Schlüssel').fill('falscher-schluessel');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('alert')).toHaveText('Dieser Schlüssel passt nicht.');

  await meldeAn(page);
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/verwaltung\/anmelden/);
  await page.goto('/verwaltung');
  await expect(page).toHaveURL(/verwaltung\/anmelden/);
});

test('Der Server liefert die strenge CSP aus, und die Seite läuft unter ihr', async ({ page }) => {
  const antwort = await page.goto('/');
  const csp = antwort.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('Die Seite lädt nichts von fremden Servern', async ({ page, baseURL }) => {
  const fremd = [];
  page.on('request', (anfrage) => {
    const url = anfrage.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:')) fremd.push(url);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await meldeAn(page);
  await page.waitForLoadState('networkidle');
  expect(fremd).toEqual([]);
});
