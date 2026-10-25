import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = ['Test', '1234!'].join('');
const prisma = new PrismaClient();
let ownerClinicId = '';

async function login(page: Page) {
  await page.goto(`${BASE}/login?role=owner`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

async function bearerHeaders(page: Page): Promise<{ Authorization: string }> {
  const token = await page.evaluate(() => {
    try {
      const stored = sessionStorage.getItem('dv_tokens');
      if (stored) {
        const parsed = JSON.parse(stored) as { access?: unknown };
        if (typeof parsed.access === 'string' && parsed.access) return parsed.access;
      }
    } catch { /* invalid test storage is handled by the assertion below */ }
    return null;
  });
  expect(token, 'browser login must store a usable access token').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\async function openBranchManagement(page: Page) {
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Организация', exact: true }).click();
  await expect(page.getByText('Организация и филиалы', { exact: true })).toBeVisible({ timeout: 15000 });
}
');
}

function branchRow(page: Page, name: string) {
  // The branch is a single accessible button containing its name, code and status badge.
  // Exact text matching cannot find the name as a standalone text node inside that button.
  return page.getByRole('button', { name: new RegExp(escapeRegExp(name)) });
}

async function openBranchManagement(page: Page) {
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Организация', exact: true }).click();
  await expect(page.getByText('Организация и филиалы', { exact: true })).toBeVisible({ timeout: 15000 });
}

async function createBranch(page: Page, name: string) {
  await page.getByRole('button', { name: 'Новый филиал', exact: true }).click();
  await page.getByLabel('Название *', { exact: true }).fill(name);
  await page.getByLabel('Код', { exact: true }).fill(`E2E${Date.now()}`);
  const createResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/branches') && response.request().method() === 'POST',
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const createResponse = await createResponsePromise;
  const createBody = await createResponse.json().catch(() => null);
  expect(createResponse.status(), `Branch creation returned HTTP ${createResponse.status()}: ${JSON.stringify(createBody)}`).toBe(201);
  await expect(branchRow(page, name)).toBeVisible({ timeout: 15000 });

  const response = await page.request.get(`/api/branches?clinicId=${encodeURIComponent(ownerClinicId)}`, {
    headers: await bearerHeaders(page),
  });
  expect(response.ok(), `Branch listing returned HTTP ${response.status()}: ${await response.text()}`).toBeTruthy();
  const raw = await response.json();
  const branches = Array.isArray(raw) ? raw : raw?.data ?? [];
  const branch = branches.find((item: { name?: string }) => item.name === name);
  expect(branch?.id).toBeTruthy();
  await expect(branchRow(page, name)).toBeVisible({ timeout: 15000 });
  return branch.id as string;
}

test.describe('Canonical organization branch management', () => {
  test.beforeAll(async () => {
    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
    const clinic = owner ? await prisma.clinicMember.findFirst({ where: { userId: owner.id }, select: { clinicId: true } }) : null;
    expect(clinic?.clinicId).toBeTruthy();
    ownerClinicId = clinic!.clinicId;
    await prisma.subscription.upsert({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinic!.clinicId } },
      update: { plan: 'NETWORK', status: 'active', periodEnd: null },
      create: { ownerType: 'CLINIC', ownerId: clinic!.clinicId, plan: 'NETWORK', status: 'active', periodEnd: null },
    });
  });

  test.afterAll(async () => { await prisma.$disconnect(); });
  test('BRANCH-004: branch code uniqueness is a recoverable conflict for create and edit', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const firstName = `E2E Code A ${Date.now()}`;
    const secondName = `E2E Code B ${Date.now()}`;
    await createBranch(page, firstName);
    await createBranch(page, secondName);

    const raw = await page.request.get(`/api/branches?clinicId=${encodeURIComponent(ownerClinicId)}`, { headers: await bearerHeaders(page) });
    expect(raw.ok()).toBeTruthy();
    const payload = await raw.json();
    const branches = Array.isArray(payload) ? payload : payload?.data ?? [];
    const first = branches.find((item: { name?: string }) => item.name === firstName);
    const second = branches.find((item: { name?: string }) => item.name === secondName);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(first?.code).toBeTruthy();
    expect(second?.code).toBeTruthy();

    const headers = await bearerHeaders(page);
    const duplicateCreate = await page.request.post('/api/branches', {
      headers,
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
      headers,
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
    // Settings intentionally returns to the default Clinic tab after reload.
    // Reopen Organization so this persistence assertion tests the actual branch list.
    await openBranchManagement(page);
    await expect(branchRow(page, branchName)).toBeVisible({ timeout: 15000 });
  });

  test('BRANCH-002: owner archives a non-default branch without deleting its record', async ({ page }) => {
    await login(page);
    await openBranchManagement(page);

    const branchName = `E2E Archive ${Date.now()}`;
    const branchId = await createBranch(page, branchName);

    await branchRow(page, branchName).click();
    await page.getByRole('button', { name: 'Архивировать', exact: true }).click();
    await expect(branchRow(page, branchName)).toContainText('Архив', { timeout: 15000 });

    const raw = await page.request.get(`/api/branches?clinicId=${encodeURIComponent(ownerClinicId)}`, { headers: await bearerHeaders(page) });
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

    const branchOption = () => page.getByRole('button', { name: new RegExp(branchName) });
    await branchOption().click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeHidden();

    // The trigger displays the organization/workspace name, not the selected
    // branch name. Reopen the menu and assert the selected branch's semantic
    // state rather than asserting unrelated trigger text.
    await trigger.click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeVisible();
    await expect(branchOption()).toHaveAttribute('aria-current', 'true');
    await trigger.click();

    // Selecting a branch changes the active workspace context but does not itself
    // issue a scoped read. Navigate to a real data-driven screen and verify that its
    // first API request carries the selected branch scope.
    const branchRequest = page.waitForRequest(
      (request) => request.url().includes('/api/') && request.headers()['x-dentvision-branch-id'] === branchId,
      { timeout: 15000 },
    );
    await page.goto(`${BASE}/crm/schedule`);
    const scopedRequest = await branchRequest;
    expect(scopedRequest.headers()['x-dentvision-branch-id']).toBe(branchId);

    // The picker is driven by the same workspace read-model that feeds downstream
    // navigation. Reopen it and verify the selected branch remains active.
    await trigger.click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeVisible();
    await expect(branchOption()).toHaveAttribute('aria-current', 'true');
    await trigger.click();

    await page.reload();
    await trigger.click();
    await expect(page.getByTestId('workspace-switcher-menu')).toBeVisible();
    await expect(branchOption()).toHaveAttribute('aria-current', 'true');
  });

});
