import { defineConfig } from '@playwright/test';

const AUSGABE = process.env.OM_PRUEFUNG ?? '../pruefung';

export default defineConfig({
  testDir: './tests',
  outputDir: `${AUSGABE}/e2e-artefakte`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['json', { outputFile: `${AUSGABE}/e2e.json` }]],
  use: {
    baseURL: process.env.OM_URL ?? 'http://localhost:8080',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },
});
