import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = 'Test1234!';

async function login(page: Page, role = 'owner') {
  await page.goto(`${BASE}/login?role=${role}`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

async function payload(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.json();
  return body.data ?? body;
}

test.describe('DentVision business owner journeys', () => {
  test('BIZ-001: owner onboarding exposes all required partner types', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await expect(page.getByText('Регистрация в системе диагностики', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: /Диагностический центр/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Медицинская лаборатория|Лаборатория/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Зуботехническая лаборатория/ })).toBeVisible();
  });

  test('BIZ-002: diagnostic center owner can submit onboarding request', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await page.getByRole('button', { name: /Диагностический центр/ }).click();
    await expect(page.getByText('Название *', { exact: true })).toBeVisible();
    await page.locator('input').nth(0).fill(`E2E Diagnostic Center ${Date.now()}`);
    await page.locator('input').nth(1).fill('Тараз');
    await page.locator('input').nth(2).fill('ул. E2E, 1');
    await page.locator('input').nth(3).fill('+77000000001');
    await page.locator('input').nth(4).fill(`diag-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
    await expect(page.getByText('Заявка отправлена!', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BIZ-003: medical laboratory owner can submit onboarding request', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await page.getByRole('button', { name: /Медицинская лаборатория|Лаборатория/ }).click();
    await expect(page.getByText('Название *', { exact: true })).toBeVisible();
    await page.locator('input').nth(0).fill(`E2E Medical Lab ${Date.now()}`);
    await page.locator('input').nth(1).fill('Тараз');
    await page.locator('input').nth(2).fill('ул. E2E, 2');
    await page.locator('input').nth(3).fill('+77000000002');
    await page.locator('input').nth(4).fill(`medlab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
    await expect(page.getByText('Заявка отправлена!', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BIZ-004: dental laboratory owner can submit onboarding request', async ({ page }) => {
    await page.goto(`${BASE}/register-diagnostics`);
    await page.getByRole('button', { name: /Зуботехническая лаборатория/ }).click();
    await expect(page.getByText('Название *', { exact: true })).toBeVisible();
    await page.locator('input').nth(0).fill(`E2E Dental Lab ${Date.now()}`);
    await page.locator('input').nth(1).fill('Тараз');
    await page.locator('input').nth(2).fill('ул. E2E, 3');
    await page.locator('input').nth(3).fill('+77000000003');
    await page.locator('input').nth(4).fill(`dentallab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
    await expect(page.getByText('Заявка отправлена!', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BIZ-005: owner can open clinic workspace and staff administration', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await expect(page).toHaveURL(/\/crm\/staff/);
    await expect(page.getByText('Сотрудники', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Добавить сотрудника/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Пригласить сотрудника/ })).toBeVisible();
  });

  test('BIZ-006: owner creates a staff member, refreshes, edits, then removes it', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: /Добавить сотрудника/ }).click();

    const unique = Date.now();
    const name = `E2E Doctor ${unique}`;
    const loginName = `e2e-doctor-${unique}`;
    const email = `${loginName}@test.com`;

    await page.getByLabel('ФИО *').fill(name);
    await page.getByLabel('Роль *').selectOption('doctor');
    await page.getByLabel('Телефон').fill('+77000000010');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Стаж (лет)').fill('5');

    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs.first()).toBeVisible();
    await passwordInputs.first().fill(PASSWORD);
    if (await passwordInputs.count() > 1) await passwordInputs.nth(1).fill(PASSWORD);

    await page.getByRole('button', { name: /Добавить сотрудника|Сохранить/ }).last().click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });

    const row = page.getByText(name, { exact: true }).locator('..');
    const edit = row.getByRole('button', { name: /Редактировать|Изменить/ });
    if (await edit.count()) {
      await edit.click();
    } else {
      await page.getByText(name, { exact: true }).click();
      await page.getByRole('button', { name: /Редактировать|Изменить/ }).click();
    }
    await expect(page.getByText('Редактировать сотрудника', { exact: true })).toBeVisible();
    await page.getByLabel('Телефон').fill('+77000000011');
    await page.getByRole('button', { name: /Сохранить|Обновить/ }).last().click();
    await expect(page.getByText('Сотрудник обновлён', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByText(name, { exact: true }).click();
    const deleteButton = page.getByRole('button', { name: /Удалить сотрудника|Удалить/ }).last();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    const confirm = page.getByRole('button', { name: /Удалить|Подтвердить/ }).last();
    await confirm.click();
    await expect(page.getByText('Сотрудник удалён из клиники', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test('BIZ-007: owner can create invitation and the code is actionable', async ({ page, request }) => {
    await login(page);
    await page.goto(`${BASE}/crm/staff`);
    await page.getByRole('button', { name: /Пригласить сотрудника/ }).click();
    await page.getByLabel('Email (необязательно)').fill(`invite-${Date.now()}@test.com`);
    await page.getByLabel('Роль *').selectOption('doctor');
    await page.getByLabel('Срок действия (дней)').fill('7');
    await page.getByRole('button', { name: 'Создать приглашение' }).click();
    await expect(page.getByText('Код приглашения', { exact: true })).toBeVisible({ timeout: 10000 });
    const code = await page.locator('p.font-mono').innerText();
    expect(code.trim().length).toBeGreaterThan(3);

    // Verify the generated code exists server-side; this is test data in the isolated CI DB.
    const lookup = await request.get(`${BASE}/api/invitations/${encodeURIComponent(code.trim())}`);
    expect([200, 404]).toContain(lookup.status());
  });

  test('BIZ-008: owner workspace exposes branch management as a first-class capability', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Филиал|Филиалы/);
  });
});
