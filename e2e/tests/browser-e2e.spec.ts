import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80';
const TEST_LOGIN = process.env.TEST_USER_LOGIN || process.env.TEST_USER_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '';

const hasAuthFixture = Boolean(TEST_LOGIN && TEST_PASSWORD);

test.describe('DentVision entry and browser contract', () => {
  test('E2E-001: anonymous root renders public Welcome, not login', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('DentVision', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ваша стоматология.', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Я врач' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Я владелец клиники' })).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0);
  });

  test('E2E-002: doctor intent carries role context into login', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'Я врач' }).click();

    await expect(page).toHaveURL(/\/login\?role=doctor/);
    await expect(page.getByRole('heading', { name: 'Продолжить как врач' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Режим: doctor', { exact: true })).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  });

  test('E2E-003: owner and admin intents remain distinct', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?role=owner`);
    await expect(page.getByRole('heading', { name: 'Войти в клинику как владелец' })).toBeVisible({ timeout: 10000 });

    await page.goto(`${BASE_URL}/login?role=admin`);
    await expect(page.getByRole('heading', { name: 'Продолжить как администратор' })).toBeVisible({ timeout: 10000 });
  });

  test('E2E-004: registration preserves selected role context', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?role=doctor&register=1`);

    await expect(page.getByRole('heading', { name: 'Создать аккаунт врача' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Создать аккаунт', { exact: true }).last()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
  });

  test('E2E-005: protected deep link sends anonymous user to contextual login', async ({ page }) => {
    await page.goto(`${BASE_URL}/crm/patients`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  });

  test('E2E-006: public Shop and Academy remain browseable', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto(`${BASE_URL}/school`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('E2E-007: mobile Welcome has no horizontal overflow and primary actions fit', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Спросить DentVision AI' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Я врач' })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      innerWidth: window.innerWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.clientWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  });

  test.describe('authenticated path', () => {
    test.skip(!hasAuthFixture, 'Set TEST_USER_LOGIN/TEST_USER_PASSWORD for authenticated E2E checks');

    test('E2E-008: valid login enters AI Workspace', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?role=doctor`);
      await page.locator('input[autocomplete="username"]').fill(TEST_LOGIN);
      await page.locator('input[autocomplete="current-password"]').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Войти в DentVision' }).click();

      await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
      await expect(page.getByText('DentVision Intelligence OS', { exact: true })).toBeVisible({ timeout: 10000 });
    });

    test('E2E-009: authenticated root enters AI Workspace directly', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
      await expect(page.getByText('DentVision Intelligence OS', { exact: true })).toBeVisible({ timeout: 10000 });
    });
  });
});
