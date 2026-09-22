import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const VISUAL_EVIDENCE_ROOT = process.env.VISUAL_EVIDENCE_DIR || 'e2e/visual-evidence';
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

async function gotoStable(page: Page, url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transientNavigation = /Navigation to .* is interrupted by another navigation|Frame load interrupted|net::ERR_ABORTED/i.test(message);
      if (!transientNavigation || attempt === attempts) throw error;
      await page.waitForTimeout(250 * attempt);
    }
  }
  throw lastError;
}

async function login(page: Page) {
  await gotoStable(page, `${BASE_URL}/login?role=owner`);
  await page.locator('input[autocomplete="username"]').fill(E2E_USER);
  await page.locator('input[autocomplete="current-password"]').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 30000 });
}

async function waitForVisualReady(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    if (!root) return false;
    const text = (root.innerText || '').trim();
    if (text.length < 20) return false;
    const children = Array.from(root.children);
    const hasFullscreenSpinner = children.some((child) => {
      const element = child as HTMLElement;
      const rect = element.getBoundingClientRect();
      const spinner = element.querySelector('.animate-spin');
      return Boolean(spinner)
        && rect.width >= window.innerWidth * 0.85
        && rect.height >= window.innerHeight * 0.75
        && element.innerText.trim().length < 20;
    });
    return !hasFullscreenSpinner;
  }, { timeout: 10000 });
  await page.waitForTimeout(250);
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
          width: Math.ceil(r.width),
          height: Math.ceil(r.height),
        };
      });

    const clipped = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"]'))
      .filter(visible)
      .map((el) => {
        const node = el as HTMLElement;
        const parentScroller = node.closest<HTMLElement>('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]');
        return {
          name: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          intentionalHorizontalScroll: !!parentScroller,
        };
      })
      .filter((x) => x.name && x.scrollWidth > x.clientWidth + 2 && !x.intentionalHorizontalScroll)
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

  const safeRouteEvidence = route.replace(/[\\/?#:%*|"<>]/g, '_') || '_home';
  const evidenceBucket = route === '/' || route.startsWith('/login') ? 'welcome' :
    route.startsWith('/ai') ? 'ai' :
    route.startsWith('/crm/lab') ? 'lab' :
    route.startsWith('/crm/') ? 'crm' :
    route.startsWith('/diagnostics/') ? 'diagnostics' :
    route.startsWith('/shop') ? 'shop' :
    route.startsWith('/school') ? 'academy' :
    'responsive';
  const evidenceDir = VISUAL_EVIDENCE_ROOT + '/responsive/' + evidenceBucket;
  await fs.mkdir(evidenceDir, { recursive: true });
  const evidenceBase = evidenceDir + '/' + device + safeRouteEvidence;
  await page.screenshot({ path: evidenceBase + '.png', fullPage: true });
  await fs.writeFile(evidenceBase + '.json', JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(evidenceBase + '.html', await page.locator('body').evaluate((el) => el.outerHTML).catch(() => ''), 'utf8');
  expect(result.visibleContent, `${device} ${route}: no visible page content`).toBeTruthy();
  expect(result.scrollWidth, `${device} ${route}: horizontal overflow ${result.scrollWidth}px > ${result.clientWidth}px`).toBeLessThanOrEqual(result.clientWidth + 2);
  expect(result.bodyWidth, `${device} ${route}: body overflow ${result.bodyWidth}px > ${result.clientWidth}px`).toBeLessThanOrEqual(result.clientWidth + 2);

  const undersized = result.interactive.filter((x) => x.width < 36 || x.height < 36);
  expect(undersized, `${device} ${route}: interactive target(s) below 36px: ${JSON.stringify(undersized)}`).toEqual([]);
  expect(result.clipped, `${device} ${route}: visible text/control clipping: ${JSON.stringify(result.clipped)}`).toEqual([]);

  const safeRoute = route.replace(/[\\/?#:%*|"<>]/g, '_') || '_home';
  const bucket = route === '/' || route.startsWith('/login') ? 'welcome' :
    route.startsWith('/ai') ? 'ai' :
    route.startsWith('/crm/lab') ? 'lab' :
    route.startsWith('/crm/') ? 'crm' :
    route.startsWith('/diagnostics/') ? 'diagnostics' :
    route.startsWith('/shop') ? 'shop' :
    route.startsWith('/school') ? 'academy' :
    'responsive';
  await page.screenshot({
    path: `${VISUAL_EVIDENCE_ROOT}/responsive/${bucket}/${device}${safeRoute}.png`,
    fullPage: true,
  });
}

test.describe('DentVision responsive design release gate', () => {
  test.describe.configure({ mode: 'serial' });

  test('public welcome and login are responsive', async ({ page }, testInfo) => {
    const device = testInfo.project.name;
    await gotoStable(page, BASE_URL);
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
      await gotoStable(page, `${BASE_URL}${route}`);
      await page.waitForTimeout(400);
      await waitForVisualReady(page);

      if (new URL(page.url()).pathname === '/login') {
        await login(page);
        await gotoStable(page, `${BASE_URL}${route}`);
        await page.waitForTimeout(400);
        await waitForVisualReady(page);
      }

      expect(new URL(page.url()).pathname, `${device} ${route}: unexpectedly redirected to login`).not.toBe('/login');
      await auditLayout(page, route, device);
    }
  });
});
