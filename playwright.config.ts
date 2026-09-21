import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180000,
  retries: 1,
  workers: 1,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || './e2e/test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'e2e-core',
      // The main E2E suite is API-contract/tenant/business logic coverage.
      // Keep its request fixture on the backend; browser-facing gates below
      // explicitly target the Vite frontend on port 3000.
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, baseURL: process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001' },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /mobile-design-gate\.spec\.ts|role-design-gate\.spec\.ts/,
    },
    {
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'laptop-1440',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'desktop-1920',
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'tablet-768',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'tablet-820',
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'mobile-390',
      use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'mobile-412',
      use: { browserName: 'chromium', viewport: { width: 412, height: 915 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'], browserName: 'webkit', baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /mobile-design-gate\.spec\.ts/,
    },
    {
      name: 'role-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-mobile',
      use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 390, height: 844 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-1920',
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 }, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-tablet-768',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-tablet-820',
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-mobile-412',
      use: { browserName: 'chromium', viewport: { width: 412, height: 915 }, isMobile: true, baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
    {
      name: 'role-mobile-safari',
      use: { ...devices['iPhone 14'], browserName: 'webkit', baseURL: process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000' },
      testMatch: /role-design-gate\.spec\.ts/,
    },
  ],
  reporter: [
    ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report', open: 'never' }],
    ['list'],
  ],
});
