import { expect, fuelleFormularAus, meldeAn, pruefeAxe, pruefeBreite, test } from './hilfe.js';

const FENSTER = [
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Telefon', width: 390, height: 780 },
];

for (const { name, width, height } of FENSTER) {
  test.describe(`axe, ${name}`, () => {
    test.use({ viewport: { width, height } });

    test('Meldeformular, leer', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await pruefeAxe(page, 'melden-leer');
    });

    test('Meldeformular, mit Fehlern', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Meldung absenden' }).click();
      await expect(page.getByText('Bitte wählen Sie eine Kategorie.')).toBeVisible();
      await pruefeAxe(page, 'melden-fehler');
    });

    test('Meldeformular, mit Ort und Bekanntem in der Nähe', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('Ort aus der Liste').selectOption('Marktplatz');
      await expect(page.getByTestId('nahe')).toBeVisible();
      await pruefeAxe(page, 'melden-nahe');
    });

    test('Danke-Seite und Stand', async ({ page }) => {
      await page.goto('/');
      await fuelleFormularAus(page, 'Prüfung der Danke-Seite');
      await page.getByRole('button', { name: 'Meldung absenden' }).click();
      await expect(page.getByTestId('vorgangscode')).toBeVisible();
      await pruefeAxe(page, 'danke');
    });

    test('Stand prüfen', async ({ page }) => {
      await page.goto('/stand');
      await expect(page.getByLabel('Ihr Code')).toBeVisible();
      await pruefeAxe(page, 'stand');
    });

    test('Anmelden, mit Fehler', async ({ page }) => {
      await page.goto('/verwaltung/anmelden');
      await page.getByLabel('Schlüssel').fill('falscher-schluessel');
      await page.getByRole('button', { name: 'Anmelden' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await pruefeAxe(page, 'anmelden-fehler');
    });

    test('Verwaltung, Übersicht', async ({ page }) => {
      await meldeAn(page);
      await expect(page.locator('.k-pin').first()).toBeVisible();
      await pruefeAxe(page, 'verwaltung');
    });

    test('Verwaltung, Meldung geöffnet und Verlauf aufgeklappt', async ({ page }) => {
      await meldeAn(page);
      await page.getByTestId('liste').getByRole('button').first().click();
      await expect(page.getByTestId('detail')).toBeVisible();
      await page.getByTestId('detail').getByText('Verlauf').click();
      await pruefeAxe(page, 'verwaltung-detail');
    });

    test('Unbekannte Adresse', async ({ page }) => {
      await page.goto('/gibt/es/nicht');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await pruefeAxe(page, 'nicht-gefunden');
    });
  });
}

for (const width of [320, 390, 414]) {
  test(`Kein waagerechtes Scrollen bei ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await pruefeBreite(page);
    await page.goto('/stand');
    await expect(page.getByLabel('Ihr Code')).toBeVisible();
    await pruefeBreite(page);
    await meldeAn(page);
    await expect(page.locator('.eintrag').first()).toBeVisible();
    await pruefeBreite(page);
    await page.locator('.eintrag').first().click();
    await expect(page.getByTestId('detail')).toBeVisible();
    await pruefeBreite(page);
  });
}

test('Das Formular geht komplett ohne Maus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();

  // Brand and three navigation links, then the first category.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Straße und Gehweg' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Beleuchtung' })).toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('application', { name: /Karte von Musterstadt/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Ort aus der Liste')).toBeFocused();
  await page.keyboard.type('Stadtpark');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/Genauer Hinweis/)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Was ist zu sehen?')).toBeFocused();
  await page.keyboard.type('Bedienung nur mit der Tastatur');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Meldung absenden' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Danke! Ihre Meldung ist da.' })).toBeVisible();
});

test('Nach einem Seitenwechsel liegt der Fokus im Inhalt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Stand prüfen' }).click();
  await expect(page.locator('main')).toBeFocused();
  await expect(page).toHaveTitle('Stand prüfen · Ortsmelder');
});

test('Der Fokus springt nach dem Öffnen einer Meldung ins Detail', async ({ page }) => {
  await meldeAn(page);
  await page.getByTestId('liste').getByRole('button').first().click();
  await expect(page.getByTestId('detail').getByRole('heading', { level: 2 })).toBeFocused();
});
