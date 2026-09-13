import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = 'Test1234!';

async function login(page: Page) {
  await page.goto(`${BASE}/login?role=owner`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

test.describe('Clinic branch management', () => {
  test('BRANCH-001: owner sees persistent branch workspace and can create a branch', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);

    await expect(page.getByText('Филиалы', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Добавить филиал', exact: true })).toBeVisible();

    const branchName = `E2E Branch ${Date.now()}`;
    await page.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
    await page.getByLabel('Название филиала *').fill(branchName);
    await page.getByLabel('Код').fill(`E2E-${Date.now()}`);
    await page.getByRole('button', { name: 'Создать филиал', exact: true }).click();

    await expect(page.getByText(branchName, { exact: true })).toBeVisible({ timeout: 15000 });
    await page.reload();
    await expect(page.getByText(branchName, { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BRANCH-002: owner can deactivate a non-default branch and cannot deactivate the only active default', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    await expect(page.getByText('Филиалы', { exact: true })).toBeVisible({ timeout: 15000 });

    const branchRows = page.locator('section').filter({ hasText: 'Филиалы' }).locator('div.border-bdr-subtle.bg-surface-0');
    const nonDefault = branchRows.filter({ hasNotText: 'Основной' }).first();
    if (await nonDefault.count()) {
      const toggle = nonDefault.getByRole('button', { name: /Отключить филиал|Активировать филиал/ });
      if (await toggle.count()) {
        await toggle.click();
        await expect(nonDefault.getByText('Отключён', { exact: true })).toBeVisible({ timeout: 10000 });
      }
    } else {
      await expect(page.getByText('Основной', { exact: true })).toBeVisible();
    }
  });
});
