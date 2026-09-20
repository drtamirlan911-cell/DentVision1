import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const PASSWORD = 'Test1234!';

const ROLES = [
  { id: 'owner', email: 'owner-a@test.com', label: 'Руководитель' },
  { id: 'admin', email: 'admin-a@test.com', label: 'Администратор' },
  { id: 'doctor', email: 'doctor-a@test.com', label: 'Врач' },
  { id: 'assistant', email: 'assistant-a@test.com', label: 'Ассистент' },
  { id: 'manager', email: 'manager-a@test.com', label: 'Менеджер' },
  { id: 'regular', email: 'regular@test.com', label: 'Пользователь' },
  { id: 'patient', email: 'patient@dentvision.kz', label: 'Пациент' },
  { id: 'diagnostic-owner', email: 'diagnostic-owner@test.com', label: 'Владелец диагностического центра' },
  { id: 'diagnostic-operator', email: 'diagnostic-operator@test.com', label: 'Оператор диагностического центра' },
  { id: 'medical-lab-owner', email: 'medical-lab-owner@test.com', label: 'Владелец медицинской лаборатории' },
  { id: 'medical-lab-tech', email: 'medical-lab-tech@test.com', label: 'Лаборант' },
  { id: 'dental-lab-owner', email: 'dental-lab-owner@test.com', label: 'Владелец зуботехнической лаборатории' },
  { id: 'dental-technician', email: 'dental-technician@test.com', label: 'Зубной техник' },
] as const;

const CONTEXT_ROUTES = [
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
  '/profile',
  '/settings',
];

const ROLE_CONTEXT_ROUTES: Record<string, string[]> = {
  'diagnostic-owner': ['/diagnostics/center', '/diagnostics/results', '/diagnostics/calendar', '/diagnostics/settings', '/profile'],
  'diagnostic-operator': ['/diagnostics/center', '/diagnostics/results', '/diagnostics/calendar', '/profile'],
  'medical-lab-owner': ['/diagnostics/lab?workspace=medical-lab', '/diagnostics/results', '/diagnostics/calendar', '/diagnostics/settings', '/profile'],
  'medical-lab-tech': ['/diagnostics/lab?workspace=medical-lab', '/diagnostics/results', '/profile'],
  'dental-lab-owner': ['/diagnostics/lab', '/diagnostics/results', '/diagnostics/settings', '/profile'],
  'dental-technician': ['/diagnostics/lab', '/diagnostics/results', '/profile'],
};

const ROLE_FORBIDDEN_ROUTES: Record<string, string[]> = {
  'diagnostic-operator': ['/diagnostics/settings'],
  'medical-lab-tech': ['/diagnostics/settings'],
  'dental-technician': ['/diagnostics/settings'],
};

async function login(page: Page, email: string) {
  await page.goto(`${BASE_URL}/login?role=owner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/(?:ai|patient-portal)(?:$|[?#])/, { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function collectRuntimeProblems(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}`));
  return { consoleErrors, pageErrors, failedRequests };
}

async function auditRoleShell(page: Page, role: typeof ROLES[number]) {
  const result = await page.evaluate(() => {
    const visible = (el: Element) => {
      const node = el as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const interactive = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"]'))
      .filter(visible)
      .map(el => {
        const node = el as HTMLElement;
        const rect = node.getBoundingClientRect();
        return {
          name: (node.getAttribute('aria-label') || node.innerText || node.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
    const visibleText = document.body.innerText;
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(visibleText);
    const clipped = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"]'))
      .filter(visible)
      .map(el => {
        const node = el as HTMLElement;
        return { name: (node.innerText || '').replace(/\s+/g, ' ').trim(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      })
      .filter(x => x.name && x.scrollWidth > x.clientWidth + 2);
    return {
      visibleText,
      emoji,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      interactive,
      clipped,
    };
  });

  expect(result.visibleText).toContain(role.label);
  expect(result.emoji, `${role.id}: visible UI contains emoji glyphs`).toBeFalsy();
  expect(result.scrollWidth, `${role.id}: horizontal document overflow`).toBeLessThanOrEqual(result.clientWidth + 2);
  expect(result.bodyWidth, `${role.id}: horizontal body overflow`).toBeLessThanOrEqual(result.clientWidth + 2);
  expect(result.clipped, `${role.id}: clipped visible text/control`).toEqual([]);

  const undersized = result.interactive.filter(x => x.width < 36 || x.height < 36);
  expect(undersized, `${role.id}: interactive target below 36px: ${JSON.stringify(undersized)}`).toEqual([]);

  const unnamed = result.interactive.filter(x => !x.name && !/^(svg|path)$/i.test(x.name));
  expect(unnamed, `${role.id}: visible interactive control without accessible/name signal`).toEqual([]);
}

test.describe('DentVision role/context design release gate', () => {
  test.describe.configure({ mode: 'serial' });

  for (const role of ROLES) {
    test(`${role.id}: greeting, identity, navigation and context remain coherent`, async ({ page }, testInfo) => {
      const problems = await collectRuntimeProblems(page);
      await login(page, role.email);

      await expect(page.getByText('DentVision', { exact: true }).first()).toBeVisible({ timeout: 10000 });
      await auditRoleShell(page, role);

      if (role.id === 'patient') {
        await expect(page).toHaveURL(/\/patient-portal(?:$|[?#])/);
        await expect(page.getByText('Пациент', { exact: true }).first()).toBeVisible();
        const consentButtons = page.getByRole('button', { name: 'Принимаю', exact: true });
        for (let i = 0; i < await consentButtons.count(); i++) await consentButtons.nth(0).click();
        await expect(page.getByText('Прежде чем продолжить', { exact: true })).toHaveCount(0);
        for (const label of ['Приём', 'Лечение', 'Визиты', 'Оплата', 'Документы', 'Диагностика']) {
          await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
        }
        for (const forbidden of ['/crm/patients', '/crm/schedule', '/crm/cashier', '/crm/inventory', '/crm/staff', '/crm/lab', '/admin', '/audit', '/bi']) {
          await page.goto(BASE_URL + forbidden, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const path = new URL(page.url()).pathname;
          expect(path, 'patient ' + forbidden + ': privileged route must not be exposed').not.toBe(forbidden);
          expect(path).not.toMatch(/^\/crm(?:\/|$)|^\/(?:admin|audit|bi)(?:\/|$)/);
        }
        await page.goto(BASE_URL + '/patient-portal', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await expect(page).toHaveURL(/\/patient-portal/);
      }

      const body = await page.locator('body').innerText();
      expect(body).toContain(role.label);
      expect(body).not.toMatch(/Application error|ChunkLoadError|Something went wrong|Failed to fetch dynamically imported module/i);

      const roleRoutes = ROLE_CONTEXT_ROUTES[role.id] || CONTEXT_ROUTES;
      for (const route of roleRoutes) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(300);

        const path = new URL(page.url()).pathname;
        expect(path, `${role.id} ${route}: unexpected auth redirect`).not.toBe('/login');
        await expect(page.locator('body')).not.toContainText('Something went wrong');
        await expect(page.locator('body')).not.toContainText('Application error');

        const shell = await page.evaluate(() => ({
          hasDentVision: document.body.innerText.includes('DentVision'),
          width: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(shell.hasDentVision, `${role.id} ${route}: shell identity disappeared`).toBeTruthy();
        expect(shell.width).toBeLessThanOrEqual(shell.clientWidth + 2);
      }

      for (const route of (ROLE_FORBIDDEN_ROUTES[role.id] || [])) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(300);
        const path = new URL(page.url()).pathname;
        expect(path, `${role.id} ${route}: restricted partner setting exposed`).not.toBe(route);
        await expect(page.locator('body')).toContainText('DentVision');
        await expect(page.locator('body')).toContainText(role.label);
      }

      expect(problems.consoleErrors, `${role.id}: console errors`).toEqual([]);
      expect(problems.pageErrors, `${role.id}: page errors`).toEqual([]);
      expect(problems.failedRequests, `${role.id}: failed network requests`).toEqual([]);

      await page.screenshot({
        path: `e2e/test-results/design-gate/roles/${role.id}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
});
