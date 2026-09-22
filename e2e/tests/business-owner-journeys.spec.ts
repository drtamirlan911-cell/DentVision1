import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = 'Test1234!';

async function login(page: Page, role = 'owner') {
  await page.goto(`${BASE}/login?role=${role}`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

test.describe('DentVision business owner journeys', () => {
  test('BIZ-001: owner onboarding exposes all required partner types', async ({ page }) => {
    await login(page);
    const variants = [
      ['center', 'Создать диагностический центр'],
      ['laboratory', 'Создать медицинскую лабораторию'],
      ['dental_laboratory', 'Создать зуботехническую лабораторию'],
    ] as const;
    for (const [type, title] of variants) {
      await page.goto(`${BASE}/register-diagnostics?type=${type}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Создать и открыть workspace' })).toBeVisible();
    }
  });

  test('BIZ-002: diagnostic center owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/register-diagnostics?type=center`);
    await page.getByLabel('Название *').fill(`E2E Diagnostic Center ${Date.now()}`);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 1');
    await page.getByLabel('Телефон').fill('+77000000001');
    await page.getByLabel('Email').fill(`diag-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/center/, { timeout: 20000 });
  });

  test('BIZ-003: medical laboratory owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/register-diagnostics?type=laboratory`);
    await page.getByLabel('Название *').fill(`E2E Medical Lab ${Date.now()}`);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 2');
    await page.getByLabel('Телефон').fill('+77000000002');
    await page.getByLabel('Email').fill(`medlab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab\?workspace=medical-lab/, { timeout: 20000 });
  });

  test('BIZ-004: dental laboratory owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/register-diagnostics?type=dental_laboratory`);
    await page.getByLabel('Название *').fill(`E2E Dental Lab ${Date.now()}`);
    await page.getByLabel('Город *').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 3');
    await page.getByLabel('Телефон').fill('+77000000003');
    await page.getByLabel('Email').fill(`dentallab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab(?:$|[?#])/, { timeout: 20000 });
  });


  test('BIZ-009: partner onboarding forms are connected to real registration endpoints', async ({ page }) => {
    await login(page);
    for (const [type, emailPrefix] of [
      ['center', 'diag-full'],
      ['laboratory', 'medlab-full'],
      ['dental_laboratory', 'dental-full'],
    ] as const) {
      await page.goto(`${BASE}/register-diagnostics?type=${type}`);
      const unique = Date.now();
      await page.getByLabel('Название *').fill(`E2E lifecycle ${emailPrefix} ${unique}`);
      await page.getByLabel('Город *').fill('Тараз');
      await page.getByLabel('Адрес').fill(`ул. E2E lifecycle ${unique}`);
      await page.getByLabel('Телефон').fill('+77000000020');
      await page.getByLabel('Email').fill(`${emailPrefix}-${unique}@test.com`);
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/organizations/self-service') && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    }
  });

  test('BIZ-005: owner can open clinic workspace and staff administration', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await expect(page).toHaveURL(/\/crm\/staff/);
    await expect(page.getByText('Сотрудники', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Добавить вручную/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Пригласить', exact: true }).first()).toBeVisible();
  });

  test('BIZ-006: owner creates a staff member, refreshes, edits, then removes it', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: /Добавить вручную/ }).click();

    const unique = Date.now();
    const name = `E2E Doctor ${unique}`;
    const loginName = `e2e-doctor-${unique}`;
    const email = `${loginName}@test.com`;

    await page.getByLabel('ФИО *').fill(name);
    await page.getByLabel('Роль *', { exact: true }).selectOption('doctor');
    await page.getByLabel('Телефон').fill('+77000000010');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Стаж (лет)').fill('5');
    await page.getByLabel('Логин *').fill(loginName);
    await page.getByLabel('Пароль *').fill(PASSWORD);
    await page.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByText(name, { exact: true }).click();
    const profile = page.getByRole('dialog', { name: 'Профиль сотрудника' });
    await expect(profile).toBeVisible();
    await profile.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(page.getByText('Редактировать сотрудника', { exact: true })).toBeVisible();
    await page.getByLabel('Телефон').fill('+77000000011');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Сотрудник обновлён', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByText(name, { exact: true }).click();
    await page.getByRole('dialog', { name: 'Профиль сотрудника' }).getByRole('button', { name: 'Удалить', exact: true }).click();
    await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
    await expect(page.getByText('Сотрудник удалён из клиники', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test('BIZ-007: owner can create an employee invitation', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: 'Пригласить', exact: true }).first().click();
    await page.getByLabel('Email (необязательно)').fill(`invite-${Date.now()}@test.com`);
    await page.getByLabel('Роль *', { exact: true }).selectOption('doctor');
    await page.getByLabel('Срок действия (дней)').fill('7');
    await page.getByRole('button', { name: 'Создать приглашение' }).click();
    await expect(page.getByText('Код приглашения', { exact: true })).toBeVisible({ timeout: 10000 });
    const code = await page.locator('p.font-mono').innerText();
    expect(code.trim().length).toBeGreaterThan(3);
  });

  test('BIZ-008: owner workspace exposes organization management entry point', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    await expect(page.getByText('Ваши организации', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Создать клинику/ })).toBeVisible();
  });
});
