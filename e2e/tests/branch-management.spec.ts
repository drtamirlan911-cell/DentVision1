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

async function openBranchManagement(page: Page) {
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Организация', exact: true }).click();
  await expect(page.getByText('Организация и филиалы', { exact: true })).toBeVisible({ timeout: 15000 });
}

async function createBranch(page: Page, name: string) {
  await page.getByRole('button', { name: 'Новый филиал', exact: true }).click();
  await page.getByLabel('Название *', { exact: true }).fill(name);
  await page.getByLabel('Код', { exact: true }).fill(`E2E-${Date.now()}`);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });

  const response = await page.request.get('/api/branches');
  expect(response.ok()).toBeTruthy();
  const raw = await response.json();
  const branches = Array.isArray(raw) ? raw : raw?.data ?? [];
  const branch = branches.find((item: { name?: string }) => item.name === name);
  expect(branch?.id).toBeTruthy();
  return branch.id as string;
}

test.describe('Canonical organization branch management', () => {
  test('BRANCH-004: branch code uniqueness is a recoverable conflict for create and edit', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const firstName = `E2E Code A ${Date.now()}`;
    const secondName = `E2E Code B ${Date.now()}`;
    await createBranch(page, firstName);
    await createBranch(page, secondName);

    const raw = await page.request.get('/api/branches');
    expect(raw.ok()).toBeTruthy();
    const payload = await raw.json();
    const branches = Array.isArray(payload) ? payload : payload?.data ?? [];
    const first = branches.find((item: { name?: string }) => item.name === firstName);
    const second = branches.find((item: { name?: string }) => item.name === secondName);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(first?.code).toBeTruthy();
    expect(second?.code).toBeTruthy();

    const duplicateCreate = await page.request.post('/api/branches', {
      data: {
        organizationId: first.organizationId,
        clinicId: first.clinicId,
        code: first.code,
        name: `E2E Duplicate Code ${Date.now()}`,
      },
    });
    expect(duplicateCreate.status()).toBe(409);
    const duplicateCreateBody = await duplicateCreate.json();
    expect(duplicateCreateBody.code || duplicateCreateBody.data?.code).toBe('BRANCH_CODE_CONFLICT');

    const duplicateEdit = await page.request.patch(`/api/branches/${second.id}`, {
      data: { code: first.code },
    });
    expect(duplicateEdit.status()).toBe(409);
    const duplicateEditBody = await duplicateEdit.json();
    expect(duplicateEditBody.code || duplicateEditBody.data?.code).toBe('BRANCH_CODE_CONFLICT');
  });


  test('BRANCH-001: owner creates a persistent branch from Settings → Organization', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const branchName = `E2E Branch ${Date.now()}`;
    await createBranch(page, branchName);

    await page.reload();
    await expect(page.getByText(branchName, { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BRANCH-002: owner archives a non-default branch without deleting its record', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const branchName = `E2E Archive ${Date.now()}`;
    const branchId = await createBranch(page, branchName);

    await page.getByText(branchName, { exact: true }).click();
    await page.getByRole('button', { name: 'Архивировать', exact: true }).click();
    await expect(page.getByText(branchName, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Архив', { exact: true })).toBeVisible({ timeout: 10000 });

    const raw = await page.request.get('/api/branches');
    const payload = await raw.json();
    const branches = Array.isArray(payload) ? payload : payload?.data ?? [];
    const archived = branches.find((item: { id?: string }) => item.id === branchId);
    expect(archived?.active).toBe(false);
  });

  test('BRANCH-003: workspace switcher selects a branch and propagates branch scope', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const branchName = `E2E Switch ${Date.now()}`;
    const branchId = await createBranch(page, branchName);

    await page.goto(`${BASE}/ai`);
    const trigger = page.getByTestId('workspace-switcher-trigger');
    await expect(trigger).toBeVisible({ timeout: 15000 });
    await trigger.click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeVisible();

    const branchRequest = page.waitForRequest(
      (request) => request.url().includes('/api/') && request.headers()['x-dentvision-branch-id'] === branchId,
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: branchName, exact: true }).click();
    await branchRequest;

    // The picker is driven by the same workspace read-model that feeds
    // downstream navigation. It must reflect the newly active branch
    // immediately, not only after a full page reload/refetch.
    await expect(trigger).toContainText(branchName);

    await page.reload();
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(branchName);
  });
});
