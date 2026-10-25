import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const BASE = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'owner-a@test.com';
const PASSWORD = 'Test1234!';
const prisma = new PrismaClient();

async function login(page: Page) {
  await page.goto(`${BASE}/login?role=owner`);
  await page.locator('input[autocomplete="username"]').fill(OWNER_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в DentVision' }).click();
  await page.waitForURL(/\/ai(?:$|[?#])/, { timeout: 20000 });
}

test.describe('Notification detail workflow', () => {
  test('NOTIFY-001: clicking a notification opens its detail before navigation', async ({ page }) => {
    await login(page);

    const stamp = Date.now();
    const title = `E2E notification detail ${stamp}`;
    const message = `Notification body ${stamp}`;

    const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
    expect(owner?.id, 'the E2E owner fixture must exist').toBeTruthy();
    try {
      // Notifications are server-generated operational records. Seed the owner-owned
      // record directly so this UI test does not depend on a client-write endpoint.
      await prisma.notification.create({
        data: { userId: owner!.id, type: 'system', title, message, link: '/crm/schedule', read: false },
      });

      // The active topbar uses AlertDropdown; reload after creation so its
    // server-backed notification store performs a fresh read.
    await page.reload();
    const bell = page.locator('button[aria-label="Уведомления"]');
    await expect(bell).toBeVisible({ timeout: 15000 });
    await bell.click();

    const row = page.getByRole('button', { name: new RegExp(title) });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText(message);
    await expect(page).toHaveURL(/\/ai(?:$|[?#])/);

      await dialog.getByRole('button', { name: 'Открыть связанный раздел' }).click();
      await page.waitForURL(/\/crm\/schedule(?:$|[?#])/);
    } finally {
      await prisma.notification.deleteMany({ where: { userId: owner!.id, title } });
    }
  });

  test.afterAll(async () => { await prisma.$disconnect(); });
});
