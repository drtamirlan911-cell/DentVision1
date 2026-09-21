import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const PASSWORD = 'Test1234!';
const OWNER_EMAIL = 'owner-a@test.com';

async function login(page: Page) {
  await page.goto(BASE + '/login?role=owner');
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await expect(page).toHaveURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

test.describe('Welcome real-click and self-service organization onboarding', () => {
  test('WELCOME-001: every primary Welcome action performs a real navigation', async ({ page }) => {
    const homeButtons = [
      ['DentVision', /^\/$/],
      ['Войти', /\/login/],
      ['Попробовать DentVision AI', /\/ai/],
      ['Посмотреть тарифы', /\/pricing/],
      ['Записаться к врачу', /\/book\/discover/],
      ['Найти диагностику', /\/diagnostics\/discover/],
      ['Работать с лабораторией', /\/login\?role=lab/],
      ['Купить', /\/shop/],
      ['Учиться', /\/school/],
      ['Найти работу', /\/jobs/],
    ] as const;

    for (const [label, target] of homeButtons) {
      await page.goto(BASE + '/');
      await page.getByRole('button', { name: label, exact: true }).click();
      const currentUrl = new URL(page.url());
      const currentPath = currentUrl.pathname + currentUrl.search;
      expect(currentPath).toMatch(target);
      await expect(page.locator('body')).not.toContainText('404');
    }
  });

  test('WELCOME-002: every organization founder card reaches authenticated onboarding', async ({ page }) => {
    const roles = [
      ['Я врач', null],
      ['Я владелец клиники', '/my-clinics?create=clinic'],
      ['Я зуботехническая лаборатория', '/register-diagnostics?type=dental_laboratory'],
      ['Я медицинская лаборатория', '/register-diagnostics?type=laboratory'],
      ['Я диагностический центр', '/register-diagnostics?type=center'],
      ['Я поставщик', null],
      ['Я академия', null],
      ['Я лектор', null],
      ['Я сотрудник клиники', null],
    ] as const;

    for (const [label, expected] of roles) {
      await page.goto(BASE + '/');
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await expect(page).toHaveURL(/\/login\?/);
      if (expected) expect(new URL(page.url()).searchParams.get('returnUrl')).toBe(expected);
    }
  });

  test('WELCOME-003: authenticated owner creates a diagnostic center and lands in center workspace', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/register-diagnostics?type=center');
    const unique = Date.now();
    await page.getByLabel('Название *').fill('E2E Center ' + unique);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/center(?:$|[?#])/, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('WELCOME-004: authenticated owner creates a medical laboratory and lands in medical workspace', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/register-diagnostics?type=laboratory');
    const unique = Date.now();
    await page.getByLabel('Название *').fill('E2E Medical Lab ' + unique);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab\?workspace=medical-lab/, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('WELCOME-005: authenticated owner creates a dental laboratory and lands in dental workspace', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/register-diagnostics?type=dental_laboratory');
    const unique = Date.now();
    await page.getByLabel('Название *').fill('E2E Dental Lab ' + unique);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab(?:$|[?#])(?!.*workspace=medical-lab)/, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('WELCOME-006: authenticated owner creates a clinic and lands in CRM workspace', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/my-clinics?create=clinic');
    const unique = Date.now();
    await page.getByLabel('Название клиники *').fill('E2E Clinic ' + unique);
    await page.getByLabel('Город').fill('Тараз');
    await page.getByRole('button', { name: 'Создать клинику', exact: true }).click();
    await expect(page).toHaveURL(/\/crm\/schedule/, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('404');
  });
});
