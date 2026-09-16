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

async function createBranch(page: Page, name: string) {
  await page.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await page.getByLabel('Название филиала *').fill(name);
  await page.getByLabel('Код').fill(`E2E-${Date.now()}`);
  await page.getByRole('button', { name: 'Создать филиал', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });
}

test.describe('Clinic branch management', () => {
  test('BRANCH-001: owner sees persistent branch workspace and can create a branch', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);

    await expect(page.getByText('Филиалы', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Добавить филиал', exact: true })).toBeVisible();

    const branchName = `E2E Branch ${Date.now()}`;
    await createBranch(page, branchName);
    await page.reload();
    await expect(page.getByText(branchName, { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BRANCH-002: owner can deactivate a non-default branch', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    await expect(page.getByText('Филиалы', { exact: true })).toBeVisible({ timeout: 15000 });

    const branchName = `E2E Deactivation ${Date.now()}`;
    await createBranch(page, branchName);

    const branchRow = page.getByText(branchName, { exact: true }).locator('../..').locator('..');
    await expect(branchRow).toContainText('Активен');
    await expect(branchRow).not.toContainText('Основной');

    const toggle = branchRow.getByRole('button', { name: /Отключить филиал/, exact: false });
    await expect(toggle).toHaveCount(1);
    await toggle.click();
    await expect(branchRow.getByText('Отключён', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
