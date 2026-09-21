import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const E2E_USER = 'owner-a@test.com';
const E2E_PASSWORD = 'Test1234!';

const CRITICAL_ROUTES = [
  '/ai',
  '/crm/patients',
  '/crm/schedule',
  '/crm/dental-chart',
  '/crm/treatment-plans',
  '/crm/lab',
  '/crm/inventory',
  '/crm/cashier',
  '/diagnostics',
  '/shop',
  '/school',
];

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login?role=owner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[autocomplete="username"]').fill(E2E_USER);
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 30000 });
}

async function auditLayout(page: Page, route: string, device: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const s = getComputedStyle(el as HTMLElement);
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && s.visibility !== 'hidden' && s.display !== 'none';
    };

    const interactive = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
      .filter(visible)
      .map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });

    const clipped = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"]'))
      .filter(visible)
      .map((el) => {
        const node = el as HTMLElement;
        return {
          name: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        };
      })
      .filter((x) => x.name && x.scrollWidth > x.clientWidth + 2)
      .slice(0, 20);

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyWidth: document.body.scrollWidth,
      visibleContent: Array.from(document.querySelectorAll('body *')).some(visible),
      interactive,
      clipped,
    };
  });

  expect(result.visibleContent, `${device} ${route}: no visible page content`).toBeTruthy();
  expect(result.scrollWidth, `${device} ${route}: horizontal overflow ${result.scrollWidth}px > ${result.clientWidth}px`).toBeLessThanOrEqual(result.clientWidth + 2);
  expect(result.bodyWidth, `${device} ${route}: body overflow ${result.bodyWidth}px > ${result.clientWidth}px`).toBeLessThanOrEqual(result.clientWidth + 2);

  const undersized = result.interactive.filter((x) => x.width < 36 || x.height < 36);
  expect(undersized, `${device} ${route}: interactive target(s) below 36px: ${JSON.stringify(undersized)}`).toEqual([]);
  expect(result.clipped, `${device} ${route}: visible text/control clipping: ${JSON.stringify(result.clipped)}`).toEqual([]);

  await page.screenshot({
    path: `e2e/test-results/design-gate/${device}${route.replaceAll('/', '_') || '_home'}.png`,
    fullPage: true,
  });
}

test.describe('DentVision responsive design release gate', () => {
  test.describe.configure({ mode: 'serial' });

  test('public welcome and login are responsive', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.getByText('DentVision', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await auditLayout(page, '/', device);
    await page.getByRole('button', { name: 'Я врач' }).click();
    await expect(page).toHaveURL(/\/login\?role=doctor/);
    await auditLayout(page, '/login?role=doctor', device);
  });

  test('critical authenticated screens are responsive', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    await login(page);

    for (const route of CRITICAL_ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);

      if (new URL(page.url()).pathname === '/login') {
        await login(page);
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(400);
      }

      expect(new URL(page.url()).pathname, `${device} ${route}: unexpectedly redirected to login`).not.toBe('/login');
      await auditLayout(page, route, device);
    }
  });
});
