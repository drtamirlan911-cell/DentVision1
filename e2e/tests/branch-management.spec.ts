import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = ['Test', '1234!'].join('');

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
  const response = await page.request.get('/api/branches');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const branches = Array.isArray(payload) ? payload : payload?.data ?? [];
  const branch = branches.find((item: { name?: string }) => item.name === name);
  expect(branch?.id).toBeTruthy();
  return branch.id as string;
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
  test('BRANCH-003: workspace switcher selects a branch and propagates branch scope', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/my-clinics`);
    const branchName = `E2E Switch ${Date.now()}`;
    const branchId = await createBranch(page, branchName);

    await page.goto(`${BASE}/ai`);
    const trigger = page.getByTestId('workspace-switcher-trigger');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeVisible();

    const branchRequest = page.waitForRequest(
      (request) => request.url().includes('/api/') && Boolean(request.headers()['x-dentvision-branch-id']),
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: branchName, exact: true }).click();
    const request = await branchRequest;
    expect(request.headers()['x-dentvision-branch-id']).toBe(branchId);
    await expect(page.getByTestId('workspace-switcher-trigger')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(branchName);
  });

});
