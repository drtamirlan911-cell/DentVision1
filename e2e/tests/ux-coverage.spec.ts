import { test, expect, type Page, type ConsoleMessage, type Response } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001';
const E2E_USER = 'owner-a@test.com';
const E2E_PASSWORD = 'Test1234!';

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
  await page.goto(`${BASE_URL}/login?role=owner`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('input[autocomplete="username"]').fill(E2E_USER);
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
  await page.waitForTimeout(750);
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  const pendingConsoleDetails: Promise<void>[] = [];
  const onPageError = (error: Error) => errors.push(`pageerror: ${error.message}`);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const messageText = message.text();
    const index = errors.push(`console: ${messageText}`) - 1;

    // React supplies the component-owner stack as console arguments; text()
    // alone drops those %s arguments and hides the component that created the list.
    if (/Each child in a list should have a unique ["']key["'] prop/i.test(messageText)) {
      pendingConsoleDetails.push(
        Promise.all(message.args().map(async (argument) => {
          try {
            const value: unknown = await argument.jsonValue();
            if (typeof value === 'string') return value.slice(0, 1200);
            return JSON.stringify(value).slice(0, 1200);
          } catch {
            return '[console argument unavailable]';
          }
        })).then((details) => {
          const useful = details.filter((detail) => detail && detail !== 'undefined');
          if (useful.length) errors[index] = `${errors[index]} | React details: ${useful.join(' | ')}`;
        }),
      );
    }
  };
  const onResponse = (response: Response) => {
    const status = response.status();
    if (status < 400) return;
    let url: URL;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }
    if (!url.pathname.startsWith('/api/')) return;

    // Record the status/path synchronously so an incomplete response body can
    // never stall the route gate. Attach only bounded generic code/error fields
    // asynchronously; never serialize arbitrary response data or patient data.
    const index = errors.push(`http ${status}: ${url.pathname}${url.search}`) - 1;
    void response.json().then((payload: unknown) => {
      const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      const code = typeof record.code === 'string' ? record.code.slice(0, 80) : '';
      const message = typeof record.error === 'string' ? record.error.slice(0, 120) : '';
      const detail = [code, message].filter(Boolean).join(': ');
      if (detail) errors[index] = `${errors[index]} (${detail})`;
    }).catch(() => {});
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);
  return {
    errors,
    flush: async () => { await Promise.all(pendingConsoleDetails); },
    dispose: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('response', onResponse);
    },
  };
}

test.describe('DentVision browser UX coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test('UX-001: every declared static route renders without runtime errors', async ({ page }) => {
    const failures: string[] = [];
    for (const route of ROUTES) {
      const runtime = collectRuntimeErrors(page);
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
          timeout: 10000,
          message: `${route}: page did not render stable content`,
        }).toMatch(/.{20,}/s);
        await page.waitForTimeout(300);
        let url = new URL(page.url());
        if (url.pathname === '/login') {
          await login(page);
          await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
            timeout: 10000,
            message: `${route}: page did not render after re-authentication`,
          }).toMatch(/.{20,}/s);
          await page.waitForTimeout(300);
          url = new URL(page.url());
          if (url.pathname === '/login') {
            failures.push(`${route}: redirected to login after re-authentication`);
            continue;
          }
        }
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (/Application error|ChunkLoadError|Failed to fetch dynamically imported module/i.test(bodyText)) {
          failures.push(`${route}: application/chunk error visible`);
        }
        await runtime.flush();
        if (runtime.errors.length) failures.push(`${route}: ${runtime.errors.join(' | ')}`);
      } catch (error) {
        failures.push(`${route}: navigation failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        runtime.dispose();
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
      let hrefs: string[] = [];
      for (const delay of [100, 250, 500, 1000]) {
        await page.waitForTimeout(delay);
        try {
          hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => href.startsWith(window.location.origin)));
          break;
        } catch (error) {
          if (!/Execution context was destroyed|Target page, context or browser has been closed/i.test(String(error))) throw error;
        }
      }

      for (const href of hrefs) {
        const targetUrl = new URL(href);
        const target = targetUrl.pathname + targetUrl.search;
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