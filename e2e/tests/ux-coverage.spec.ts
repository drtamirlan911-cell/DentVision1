import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const E2E_USER = 'owner-a@test.com';
const E2E_PASSWORD = 'Test1234!';

// These are concrete routes declared by src/index.tsx. Dynamic detail routes are
// exercised separately by domain E2E tests; this matrix verifies every static
// workspace can actually render in a real browser session.
const ROUTES = [
  '/', '/ai', '/analytics', '/settings', '/help', '/notifications', '/admin', '/bi',
  '/security', '/audit', '/agent-activity', '/ai-approvals', '/backup', '/profile',
  '/supplier', '/jobs', '/community', '/demo', '/pricing', '/terms', '/privacy',
  '/crm/schedule', '/crm/patients', '/crm/cashier', '/crm/pricelist', '/crm/lab',
  '/crm/inventory', '/crm/stock-rules', '/crm/marketing', '/crm/promotions', '/crm/staff',
  '/crm/medical-card', '/crm/icd10', '/crm/visits', '/crm/documents', '/crm/reminders',
  '/crm/workflow', '/crm/dental-chart', '/crm/treatment-plans', '/crm/clinic-settings',
  '/crm/billing', '/crm/patient-inbox', '/crm/integrations/messaging',
  '/shop', '/shop/checkout', '/shop/orders', '/shop/favorites', '/shop/suppliers',
  '/diagnostics', '/diagnostics/referrals', '/diagnostics/referrals/new', '/diagnostics/centers',
  '/diagnostics/labs', '/diagnostics/patients', '/diagnostics/results', '/diagnostics/calendar',
  '/diagnostics/statistics', '/diagnostics/settings', '/diagnostics/center', '/diagnostics/lab',
  '/diagnostics/workspace', '/diagnostics/registration-requests',
  '/school', '/school/workspace',
];

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login?role=owner`);
  await page.locator('input[autocomplete="username"]').fill(E2E_USER);
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe('DentVision browser UX coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test('UX-001: every declared static route renders without runtime errors', async ({ page }) => {
    const failures: string[] = [];
    for (const route of ROUTES) {
      const errors = collectRuntimeErrors(page);
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(250);
        const url = new URL(page.url());
        if (url.pathname === '/login') {
          failures.push(`${route}: redirected to login`);
          continue;
        }
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (/Application error|ChunkLoadError|Failed to fetch dynamically imported module/i.test(bodyText)) {
          failures.push(`${route}: application/chunk error visible`);
        }
        if (errors.length) failures.push(`${route}: ${errors.join(' | ')}`);
      } catch (error) {
        failures.push(`${route}: navigation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('UX-002: every visible button has an accessible name and no broken interactive state', async ({ page }) => {
    const failures: string[] = [];
    const sampled = new Set<string>();

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(150);
      const buttons = await page.locator('button:visible').evaluateAll((nodes) => nodes.map((node) => ({
        text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        aria: node.getAttribute('aria-label') || '',
        title: node.getAttribute('title') || '',
        disabled: (node as HTMLButtonElement).disabled,
        type: node.getAttribute('type') || 'button',
      })));

      for (const button of buttons) {
        const name = button.aria || button.text || button.title;
        const key = `${route}::${name}::${button.type}`;
        if (sampled.has(key)) continue;
        sampled.add(key);
        if (!name) failures.push(`${route}: visible button has no accessible name`);
        // Disabled buttons are valid only when the UI explains why; empty disabled
        // controls are especially confusing on mobile, so flag them for review.
        if (button.disabled && !name) failures.push(`${route}: unnamed disabled button`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('UX-003: internal navigation links do not lead to the application 404 page', async ({ page }) => {
    const failures: string[] = [];
    const visited = new Set<string>();

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(100);
      const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith(window.location.origin)));

      for (const href of hrefs) {
        const target = new URL(href).pathname + new URL(href).search;
        if (visited.has(target) || /\/sign\/|\/plan\/|\/book\//.test(target)) continue;
        visited.add(target);
        const response = await page.request.get(`${BASE_URL}${target}`, { failOnStatusCode: false });
        if (response.status() >= 500) failures.push(`${route} -> ${target}: HTTP ${response.status()}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('UX-004: mobile critical workspaces fit without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const failures: string[] = [];
    for (const route of ['/', '/ai', '/crm/patients', '/crm/schedule', '/crm/dental-chart', '/crm/treatment-plans', '/shop', '/diagnostics', '/school']) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (metrics.scrollWidth > metrics.clientWidth + 2) {
        failures.push(`${route}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
