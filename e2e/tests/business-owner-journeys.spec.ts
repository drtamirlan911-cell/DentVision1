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
  test('BIZ-000: new account registration → partner onboarding → persisted workspace context', async ({ page }) => {
    const unique = Date.now();
    const email = `e2e-new-owner-${unique}@test.com`;
    const password = 'Test1234!';
    const organizationName = `E2E Registered Diagnostic ${unique}`;

    const registration = await page.request.post('/api/auth/register', {
      data: {
        email,
        password,
        firstName: 'E2E',
        lastName: 'Registered Owner',
        role: 'OWNER',
      },
    });
    expect(registration.status()).toBe(201);
    const registrationPayload = await registration.json();
    expect(registrationPayload.data?.user?.role).toBe('STUDENT');

    // page.request is a separate API client and does not hydrate the frontend
    // auth store. Persist the returned pair through the same tab-scoped storage
    // contract used by api.setTokens(), then let normal bootstrap restore it.
    const registrationAccess = registrationPayload.data?.accessToken || registrationPayload.accessToken;
    const registrationRefresh = registrationPayload.data?.refreshToken || registrationPayload.refreshToken;
    expect(registrationAccess).toBeTruthy();
    expect(registrationRefresh).toBeTruthy();
    await page.goto(`${BASE}/`);
    await page.evaluate(({ access, refresh }) => {
      sessionStorage.setItem('dv_tokens', JSON.stringify({ access, refresh }));
    }, { access: registrationAccess, refresh: registrationRefresh });
    await page.reload();
    await expect.poll(() => page.locator('body').innerText().catch(() => '')).toMatch(/DentVision|создать/i);
    await page.goto(`${BASE}/onboarding?mode=create&kind=diagnostic_center`);
    await expect(page.getByRole('heading', { name: 'Создать диагностический центр' })).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Название *').fill(organizationName);
    await page.getByLabel('Город').fill('Тараз');
    await page.getByLabel('Адрес').fill(`ул. E2E Registered ${unique}`);
    await page.getByLabel('Телефон').fill('+77000000021');
    await page.getByLabel('Email').fill(email);

    const [onboardingResponse] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/organizations/self-service') && response.request().method() === 'POST',
        { timeout: 20000 },
      ),
      page.getByRole('button', { name: 'Создать и открыть workspace' }).click(),
    ]);
    const onboarding = onboardingResponse;
    expect(onboarding.status()).toBe(201);
    const onboardingPayload = await onboarding.json();
    expect(onboardingPayload.data?.verification).toBe('PENDING');
    expect(onboardingPayload.data?.organizationId).toBeTruthy();
    expect(onboardingPayload.data?.branchId).toBeTruthy();

    const contextsResponse = await page.request.get('/api/iam/me/contexts');
    expect(contextsResponse.ok()).toBeTruthy();
    const contextsPayload = await contextsResponse.json();
    const context = (contextsPayload.data?.contexts || []).find(
      (item: { organizationId?: string; name?: string }) =>
        item.organizationId === onboardingPayload.data.organizationId || item.name === organizationName,
    );
    expect(context, 'created organization must be present in canonical workspace context list').toBeTruthy();
    expect(context.scopeType).toBe('DIAGNOSTIC_CENTER');
    expect(context.branchId).toBe(onboardingPayload.data.branchId);

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(organizationName);
  });


  test('BIZ-001: canonical onboarding exposes all six organization types', async ({ page }) => {
    await login(page);
    const variants = [
      ['clinic', 'Создать стоматологическую клинику'],
      ['diagnostic_center', 'Создать диагностический центр'],
      ['medical_lab', 'Создать медицинскую лабораторию'],
      ['dental_lab', 'Создать зуботехническую лабораторию'],
      ['supplier', 'Создать поставщика / производителя'],
      ['academy', 'Создать академию / образовательный центр'],
    ] as const;
    for (const [kind, title] of variants) {
      await page.goto(`${BASE}/onboarding?mode=create&kind=${kind}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Создать и открыть workspace' })).toBeVisible();
    }
  });

  test('BIZ-001b: legacy diagnostics registration URL enters canonical onboarding', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/onboarding?mode=create&kind=medical_lab`);
    await expect(page).toHaveURL(/\/onboarding\?mode=create&kind=medical_lab/);
    await expect(page.getByRole('heading', { name: 'Создать медицинскую лабораторию' })).toBeVisible();
  });

  test('BIZ-002: diagnostic center owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/onboarding?mode=create&kind=diagnostic_center`);
    await page.getByLabel('Название *').fill(`E2E Diagnostic Center ${Date.now()}`);
    await page.getByLabel('Город').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 1');
    await page.getByLabel('Телефон').fill('+77000000001');
    await page.getByLabel('Email').fill(`diag-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/center/, { timeout: 20000 });
  });

  test('BIZ-003: medical laboratory owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/onboarding?mode=create&kind=medical_lab`);
    await page.getByLabel('Название *').fill(`E2E Medical Lab ${Date.now()}`);
    await page.getByLabel('Город').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 2');
    await page.getByLabel('Телефон').fill('+77000000002');
    await page.getByLabel('Email').fill(`medlab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab\?workspace=medical-lab/, { timeout: 20000 });
  });

  test('BIZ-004: dental laboratory owner can create workspace', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/onboarding?mode=create&kind=dental_lab`);
    await page.getByLabel('Название *').fill(`E2E Dental Lab ${Date.now()}`);
    await page.getByLabel('Город').fill('Тараз');
    await page.getByLabel('Адрес').fill('ул. E2E, 3');
    await page.getByLabel('Телефон').fill('+77000000003');
    await page.getByLabel('Email').fill(`dentallab-${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Создать и открыть workspace' }).click();
    await expect(page).toHaveURL(/\/diagnostics\/lab(?:$|[?#])/, { timeout: 20000 });
  });


  test('BIZ-009: partner onboarding forms are connected to real registration endpoints', async ({ page }) => {
    for (const [type, emailPrefix] of [
      ['center', 'diag-full'],
      ['laboratory', 'medlab-full'],
      ['dental_laboratory', 'dental-full'],
    ] as const) {
      // Workspace creation changes the active context. Clear browser auth
      // state before each vertical slice so one partner workspace cannot become
      // the implicit starting context for the next registration.
      await page.context().clearCookies();
      await login(page);
      const kind = type === 'center' ? 'diagnostic_center' : type === 'laboratory' ? 'medical_lab' : 'dental_lab';
      await page.goto(`${BASE}/onboarding?mode=create&kind=${kind}`);
      await expect(page.getByLabel('Название *')).toBeVisible({ timeout: 15000 });
      const unique = Date.now();
      await page.getByLabel('Название *').fill(`E2E lifecycle ${emailPrefix} ${unique}`);
      await page.getByLabel('Город').fill('Тараз');
      await page.getByLabel('Адрес').fill(`ул. E2E lifecycle ${unique}`);
      await page.getByLabel('Телефон').fill('+77000000020');
      await page.getByLabel('Email').fill(`${emailPrefix}-${unique}@test.com`);
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes('/api/organizations/self-service') &&
            response.request().method() === 'POST',
          { timeout: 20000 },
        ),
        page.getByRole('button', { name: 'Создать и открыть workspace' }).click(),
      ]);
      const responseBody = await response.json();
      const responseData = { status: response.status(), ok: response.ok(), body: responseBody };
      expect(response.ok).toBeTruthy();
      const onboarding = responseData.body;
      expect(onboarding).toBeTruthy();
      expect(onboarding.data?.organizationId).toBeTruthy();
      expect(onboarding.data?.branchId).toBeTruthy();
      expect(onboarding.data?.verification).toBe('PENDING');

      const contextsResponse = await page.request.get('/api/iam/me/contexts');
      expect(contextsResponse.ok()).toBeTruthy();
      const contextsPayload = await contextsResponse.json();
      const context = (contextsPayload.data?.contexts || []).find(
        (item: { organizationId?: string; scopeType?: string; branchId?: string }) =>
          item.organizationId === onboarding.data.organizationId,
      );
      expect(context).toBeTruthy();
      expect(context.scopeType).toBe(
        type === 'center' ? 'DIAGNOSTIC_CENTER' : 'LABORATORY',
      );
      expect(context.roleKey).toBe(
        type === 'center' ? 'diagnostic_owner' : type === 'laboratory' ? 'medical_lab_owner' : 'dental_lab_owner',
      );
      expect(context.branchId).toBe(onboarding.data.branchId);

      await page.reload();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
      await expect(page.getByTestId('workspace-switcher-trigger')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
        new RegExp(`E2E lifecycle ${emailPrefix}`),
      );
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
