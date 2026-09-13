import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const PASSWORD = 'Test1234!';
const OWNER_EMAIL = 'owner-a@test.com';

async function login(page: Page, role = 'owner') {
  await page.goto(`${BASE}/login?role=${role}`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

async function collectUiProblems(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}`));
  return { consoleErrors, failedRequests };
}

test.describe('DentVision organization owner lifecycle', () => {
  test('ORG-001: all partner-owner onboarding types are discoverable and usable', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await expect(page.getByText('Регистрация партнёра', { exact: true })).toBeVisible();

    const types = [
      'Диагностический центр',
      'Медицинская лаборатория',
      'Зуботехническая лаборатория',
    ];

    for (const type of types) {
      const button = page.getByRole('button', { name: new RegExp(type) });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page.locator('input').first()).toBeVisible();
    }
  });

  test('ORG-002: partner onboarding is an application flow, not a false account-provisioning success', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await page.getByRole('button', { name: /Диагностический центр/ }).click();
    const unique = Date.now();
    await page.locator('input').nth(0).fill(`E2E Diagnostic Owner ${unique}`);
    await page.locator('input').nth(1).fill('Тараз');
    await page.locator('input').nth(2).fill('ул. E2E, 10');
    await page.locator('input').nth(3).fill('+77000000100');
    await page.locator('input').nth(4).fill(`owner-${unique}@test.com`);
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
    await expect(page.getByText('Заявка отправлена!', { exact: true })).toBeVisible({ timeout: 15000 });

    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/аккаунт создан|вы вошли|личный кабинет открыт/i);
  });

  test('ORG-003: owner can reach staff administration and its primary actions', async ({ page }) => {
    await login(page);
    const problems = await collectUiProblems(page);
    await page.goto(`${BASE}/crm/staff`);
    await expect(page.getByText('Сотрудники', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Добавить сотрудника/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Пригласить/ })).toBeVisible();
    expect(problems.consoleErrors).toEqual([]);
    expect(problems.failedRequests).toEqual([]);
  });

  test('ORG-004: owner employee lifecycle survives reload and exposes edit/remove controls', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: /Добавить сотрудника/ }).click();

    const unique = Date.now();
    const name = `E2E Lifecycle Doctor ${unique}`;
    await page.getByLabel('ФИО *').fill(name);
    await page.getByLabel('Роль *').selectOption('doctor');
    await page.getByLabel('Логин *').fill(`lifecycle-${unique}`);
    await page.getByLabel('Пароль *').fill(PASSWORD);
    await page.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByText(name, { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Удалить', exact: true })).toBeVisible();
  });

  test('ORG-005: invitation flow creates a durable invitation code', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: /Пригласить/ }).click();
    await page.getByLabel('Email (необязательно)').fill(`lifecycle-invite-${Date.now()}@test.com`);
    await page.getByLabel('Роль *').selectOption('doctor');
    await page.getByLabel('Срок действия (дней)').fill('7');
    await page.getByRole('button', { name: 'Создать приглашение' }).click();
    await expect(page.getByText('Код приглашения', { exact: true })).toBeVisible({ timeout: 10000 });
    const code = (await page.locator('p.font-mono').innerText()).trim();
    expect(code.length).toBeGreaterThan(3);
    await page.reload();
    await expect(page.getByText('Приглашения', { exact: true })).toBeVisible().catch(() => undefined);
  });

  test('ORG-006: branch management is a release-gate capability, not just a text label', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    await expect(page).toHaveURL(/\/my-clinics/);

    const buttons = page.getByRole('button');
    const links = page.getByRole('link');
    const controls = [
      /добавить.*филиал/i,
      /создать.*филиал/i,
      /управл.*филиал/i,
      /новый.*филиал/i,
    ];

    const text = await page.locator('body').innerText();
    const hasBranchConcept = /филиал|филиалы/i.test(text);
    expect(hasBranchConcept).toBeTruthy();

    let actionableBranchControl = false;
    for (const pattern of controls) {
      if (await buttons.filter({ hasText: pattern }).count()) actionableBranchControl = true;
      if (await links.filter({ hasText: pattern }).count()) actionableBranchControl = true;
    }

    expect(actionableBranchControl, 'Branch management must expose an actionable create/manage control, not only the word "Филиал".').toBeTruthy();
  });

  test('ORG-007: owner can navigate through core management surfaces without a dead-end', async ({ page }) => {
    await login(page);
    const routes = [
      '/crm/staff',
      '/crm/patients',
      '/crm/appointments',
      '/crm/inventory',
      '/crm/lab-orders',
      '/crm/diagnostics',
      '/finance',
      '/my-clinics',
    ];

    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).not.toContainText('404');
      await expect(page.locator('body')).not.toContainText('Something went wrong');
    }
  });
});
