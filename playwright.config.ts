import { defineConfig, devices } from '@playwright/test';

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
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'laptop-1440',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'desktop-1920',
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 } },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'tablet-768',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, isMobile: true },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'tablet-820',
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: true },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'mobile-390',
      use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 } },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'mobile-412',
      use: { browserName: 'chromium', viewport: { width: 412, height: 915 }, isMobile: true },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'], browserName: 'webkit' },
      testMatch: /mobile-design-gate\\.spec\\.ts/,
    },
  ],
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
});
