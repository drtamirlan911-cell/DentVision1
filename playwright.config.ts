import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
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
