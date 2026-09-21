import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const PASSWORD = 'Test1234!';
const EVIDENCE_ROOT = path.resolve('e2e/visual-evidence/visual-agent');

type AgentRole = {
  id: string;
  email: string;
  entry: RegExp;
  journeys: string[];
};

const ROLES: readonly AgentRole[] = [
  { id: 'owner', email: 'owner-a@test.com', entry: /\/ai(?:$|[?#])/, journeys: ['/ai','/diagnostics','/shop'] },
  { id: 'admin', email: 'admin-a@test.com', entry: /\/ai|\/crm/, journeys: ['/crm/patients','/crm/cashier','/diagnostics'] },
  { id: 'doctor', email: 'doctor-a@test.com', entry: /\/ai|\/crm/, journeys: ['/ai','/crm/dental-chart','/diagnostics/referrals'] },
  { id: 'assistant', email: 'assistant-a@test.com', entry: /\/ai|\/crm/, journeys: ['/crm/schedule','/crm/visits','/diagnostics/referrals'] },
  { id: 'manager', email: 'manager-a@test.com', entry: /\/ai|\/crm/, journeys: ['/ai','/crm/staff','/analytics'] },
  { id: 'regular', email: 'regular@test.com', entry: /\/ai$/, journeys: ['/school','/profile'] },
  { id: 'patient', email: 'patient@dentvision.kz', entry: /\/patient-portal/, journeys: ['/patient-portal','/shop'] },
  { id: 'diagnostic-owner', email: 'diagnostic-owner@test.com', entry: /\/diagnostics\/center/, journeys: ['/diagnostics/center','/diagnostics/results','/diagnostics/settings'] },
  { id: 'diagnostic-operator', email: 'diagnostic-operator@test.com', entry: /\/diagnostics\/center/, journeys: ['/diagnostics/center','/diagnostics/results'] },
  { id: 'medical-lab-owner', email: 'medical-lab-owner@test.com', entry: /\/diagnostics\/lab/, journeys: ['/diagnostics/lab','/diagnostics/results','/diagnostics/settings'] },
  { id: 'medical-lab-tech', email: 'medical-lab-tech@test.com', entry: /\/diagnostics\/lab/, journeys: ['/diagnostics/lab','/diagnostics/results'] },
  { id: 'dental-lab-owner', email: 'dental-lab-owner@test.com', entry: /\/diagnostics\/lab/, journeys: ['/diagnostics/lab','/diagnostics/results','/diagnostics/settings'] },
  { id: 'dental-technician', email: 'dental-technician@test.com', entry: /\/diagnostics\/lab/, journeys: ['/diagnostics/lab','/diagnostics/laboratories','/diagnostics/results'] },
  { id: 'superadmin', email: 'superadmin@test.com', entry: /\/admin|\/ai/, journeys: ['/admin','/security','/ai-governance'] },
  { id: 'support', email: 'support@test.com', entry: /\/ai$/, journeys: ['/support','/analytics','/settings'] },
  { id: 'laboratory', email: 'lab-a@test.com', entry: /\/ai|\/crm|\/diagnostics/, journeys: ['/diagnostics','/diagnostics/laboratories','/crm/lab'] },
];

const VIEWPORTS = [
  { id: 'desktop-1440', width: 1440, height: 900 },
  { id: 'tablet-820', width: 820, height: 1180 },
  { id: 'mobile-390', width: 390, height: 844 },
] as const;

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeEvidence(page: Page, role: AgentRole, viewportId: string, checkpoint: string) {
  const dir = path.join(EVIDENCE_ROOT, role.id, viewportId);
  await ensureDir(dir);
  const stem = safeName(checkpoint);
  await page.screenshot({ path: path.join(dir, stem + '.png'), fullPage: true });
  const snapshot = await page.locator('body').innerText().catch(() => '');
  await fs.writeFile(path.join(dir, stem + '.txt'), snapshot, 'utf8');
  const html = await page.locator('body').evaluate(el => el.outerHTML).catch(() => '');
  await fs.writeFile(path.join(dir, stem + '.html'), html, 'utf8');

  const geometry = await page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      const s = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    };
    const label = (el: Element) => {
      const h = el as HTMLElement;
      return (h.getAttribute('aria-label') || h.getAttribute('title') || h.getAttribute('placeholder') || h.innerText || '')
        .replace(/\\s+/g, ' ').trim().slice(0, 160);
    };
    const controls = Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]'))
      .filter(visible).map(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { label: label(el), x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible).map(label).filter(Boolean),
      controls,
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
    };
  });
  await fs.writeFile(path.join(dir, stem + '.json'), JSON.stringify(geometry, null, 2), 'utf8');
}

async function login(page: Page, role: AgentRole) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[autocomplete="username"]').fill(role.email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(700);
  expect(page.url(), role.id + ': unexpected post-login entry').toMatch(role.entry);
}

async function inspect(page: Page, role: AgentRole, route: string, viewportId: string) {
  const problems = await page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText,
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    empty: document.body.innerText.trim().length < 20,
    unnamed: Array.from(document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"]')).filter(el => {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      const s = getComputedStyle(h);
      if (r.width <= 0 || r.height <= 0 || s.display === 'none' || s.visibility === 'hidden' || Number.parseFloat(s.opacity || '1') === 0) return false;
      return !(h.getAttribute('aria-label') || h.getAttribute('title') || h.innerText || '').trim();
    }).length,
    smallControls: Array.from(document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"]')).filter(el => {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      const s = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number.parseFloat(s.opacity || '1') > 0 && (r.width < 36 || r.height < 36);
    }).length,
  }));
  expect(problems.empty, role.id + ' ' + route + ': visually empty screen').toBeFalsy();
  expect(problems.overflow, role.id + ' ' + route + ': horizontal overflow').toBeFalsy();
  expect(problems.unnamed, role.id + ' ' + route + ': unnamed interactive controls').toBe(0);
  expect(problems.smallControls, role.id + ' ' + route + ': undersized interactive controls').toBe(0);
  expect(/Application error|ChunkLoadError|Failed to fetch dynamically imported module|Something went wrong/i.test(problems.text), role.id + ' ' + route + ': application error').toBeFalsy();
  await writeEvidence(page, role, viewportId, '01_' + route);
}

async function exerciseHands(page: Page, role: AgentRole, route: string, viewportId: string) {
  const before = page.url();
  const candidates = page.locator('button:visible, a:visible, [role="button"]:visible').filter({ hasText: /.+/ });
  const count = await candidates.count();
  if (count > 0) {
    const first = candidates.nth(0);
    const label = ((await first.innerText().catch(() => '')) || '').trim();
    if (label && !/^(Выйти|Logout|Удалить|Delete)$/i.test(label)) {
      await first.hover().catch(() => {});
      await writeEvidence(page, role, viewportId, '02_' + route + '_hover');
      if (await first.isVisible().catch(() => false)) await first.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      await writeEvidence(page, role, viewportId, '03_' + route + '_after_action');
      expect(page.url(), role.id + ' ' + route + ': action produced an unexpected external navigation').toMatch(/^https?:\/\/localhost:3000\//);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  await page.mouse.wheel(0, Math.min(900, Math.max(350, await page.evaluate(() => document.documentElement.scrollHeight / 2))));
  await page.waitForTimeout(150);
  await writeEvidence(page, role, viewportId, '04_' + route + '_scrolled');
  await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(300);
  await writeEvidence(page, role, viewportId, '05_' + route + '_restored');
  expect(page.url()).toContain(new URL(route, BASE_URL).pathname);
  void before;
}

for (const viewport of VIEWPORTS) {
  test.describe('visual-agent ' + viewport.id, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      // Trace is configured at the project level; per-describe trace forces a new worker.
    });

    for (const role of ROLES) {
      test(role.id + ' visual hands/eyes', async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const failedRequests: string[] = [];
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('requestfailed', request => failedRequests.push(request.method() + ' ' + request.url() + ' :: ' + (request.failure()?.errorText || 'failed')));

        await login(page, role);
        await writeEvidence(page, role, viewport.id, '00_entry');

        for (const route of role.journeys) {
          await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(500);
          await inspect(page, role, route, viewport.id);
          await exerciseHands(page, role, route, viewport.id);
        }

        await fs.writeFile(
          path.join(EVIDENCE_ROOT, role.id, viewport.id, 'runtime.json'),
          JSON.stringify({ role: role.id, viewport, consoleErrors, pageErrors, failedRequests }, null, 2),
          'utf8',
        );
        expect(consoleErrors, role.id + ' ' + viewport.id + ': console errors').toEqual([]);
        expect(pageErrors, role.id + ' ' + viewport.id + ': page errors').toEqual([]);
        expect(failedRequests, role.id + ' ' + viewport.id + ': failed requests').toEqual([]);
      });
    }
  });
}
