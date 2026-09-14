import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Browser UX gates intentionally exercise the full authenticated route matrix.
  // 30s is enough for an individual smoke test but not for a serial route sweep;
  // keep the gate bounded while preventing false failures from the suite-level clock.
  timeout: 180000,
  retries: 1,
  workers: 1,
  outputDir: './e2e/test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
});
