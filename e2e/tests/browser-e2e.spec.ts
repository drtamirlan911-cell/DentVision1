import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@dentvision.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Admin1234!';

const selectors = {
  emailInput: 'input[type="email"], input[name="email"], input[placeholder*="email" i]',
  passwordInput: 'input[type="password"], input[name="password"]',
  submitButton: 'button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")',
  nav: 'nav, [role="navigation"], .sidebar, .nav',
  main: 'main, [role="main"], .content, .dashboard',
  alert: '[role="alert"], .error, .text-red, .text-destructive, [class*="error" i]',
  patientsLink: 'a:has-text("Patient"), a[href*="patient"], nav a:has-text("Patient")',
  patientList: 'table, .patient-list, [data-testid*="patient"], .list, [role="list"]',
  newPatientBtn: 'button:has-text("New"), button:has-text("Add"), button:has-text("Create"), a:has-text("New Patient"), a:has-text("Add Patient")',
  firstName: 'input[name="firstName"], input[name="first_name"], input[placeholder*="first" i]',
  lastName: 'input[name="lastName"], input[name="last_name"], input[placeholder*="last" i]',
  phone: 'input[name="phone"], input[type="tel"]',
  saveBtn: 'button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")',
  patientRow: 'table tbody tr, .patient-item, [data-testid*="patient"]',
  detail: '.patient-detail, [data-testid*="detail"], .detail, [role="tablist"], .tabs',
  appointmentsLink: 'a:has-text("Appointment"), a[href*="appointment"], a:has-text("Schedule"), nav a:has-text("Calendar")',
  calendar: 'table, .calendar, [role="grid"], .appointment-list, [data-testid*="appointment"], .fc',
  marketplaceLink: 'a:has-text("Market"), a[href*="market"], nav a:has-text("Store")',
  products: 'table, .product-grid, .products, [data-testid*="product"], .grid, [role="list"]',
  userMenu: '[data-testid*="user-menu"], .user-menu, button:has-text("Admin"), .avatar, button[aria-label*="user" i], button[aria-label*="menu" i]',
  logoutBtn: 'button:has-text("Logout"), button:has-text("Log out"), a:has-text("Logout"), a:has-text("Log out"), [data-testid*="logout"]',
} as const;

async function login(page: Page, email: string, password: string) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator(selectors.emailInput).first().fill(email);
  await page.locator(selectors.passwordInput).first().fill(password);
  await page.locator(selectors.submitButton).first().click();
  await page.waitForURL(/dashboard|\/$/, { timeout: 15000 });
}

test.describe('Browser E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('E2E-001: Login page loads -> form visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator(selectors.emailInput).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(selectors.passwordInput).first()).toBeVisible();
    await expect(page.locator(selectors.submitButton).first()).toBeVisible();
  });

  test('E2E-002: Login with valid credentials -> redirected to dashboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator(selectors.emailInput).first().fill(TEST_EMAIL);
    await page.locator(selectors.passwordInput).first().fill(TEST_PASSWORD);
    await page.locator(selectors.submitButton).first().click();

    await page.waitForURL(/dashboard|\/$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/login/i);
  });

  test('E2E-003: Login with invalid credentials -> error message shown', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator(selectors.emailInput).first().fill('nonexistent@test.com');
    await page.locator(selectors.passwordInput).first().fill('WrongPassword123!');
    await page.locator(selectors.submitButton).first().click();

    await expect(page.locator(selectors.alert).first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/login/i);
  });

  test('E2E-004: Dashboard loads after login -> key elements visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    const nav = page.locator(selectors.nav).first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    const mainContent = page.locator(selectors.main).first();
    await expect(mainContent).toBeVisible();
  });

  test('E2E-005: Navigate to patients -> patient list visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.locator(selectors.patientsLink).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/patient/i);

    await expect(page.locator(selectors.patientList).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-006: Create new patient -> form opens, fill, submit -> patient appears in list', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.locator(selectors.patientsLink).first().click();
    await page.waitForLoadState('networkidle');

    await page.locator(selectors.newPatientBtn).first().click();
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const firstName = 'E2E';
    const lastName = `Patient${timestamp}`;

    const firstNameInput = page.locator(selectors.firstName).first();
    const lastNameInput = page.locator(selectors.lastName).first();
    const phoneInput = page.locator(selectors.phone).first();

    if (await firstNameInput.isVisible()) await firstNameInput.fill(firstName);
    if (await lastNameInput.isVisible()) await lastNameInput.fill(lastName);
    if (await phoneInput.isVisible()) await phoneInput.fill('555-0199');

    await page.locator(selectors.saveBtn).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`text=${lastName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-007: Open patient details -> data displayed correctly', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.locator(selectors.patientsLink).first().click();
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator(selectors.patientRow).first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(selectors.detail).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-008: Navigate to appointments -> calendar/list visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.locator(selectors.appointmentsLink).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/appointment|schedule|calendar/i);

    await expect(page.locator(selectors.calendar).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-009: Navigate to marketplace -> products visible', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    await page.locator(selectors.marketplaceLink).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/market|store|shop/i);

    await expect(page.locator(selectors.products).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-010: Logout -> redirected to login page', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD);

    const userMenu = page.locator(selectors.userMenu).first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }

    await page.locator(selectors.logoutBtn).first().click({ timeout: 5000 });
    await page.waitForURL(/login|\/$/, { timeout: 10000 });
    await expect(page).toHaveURL(/login/i);
  });

  test('E2E-011: Desktop viewport (1920x1080) -> layout correct', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await login(page, TEST_EMAIL, TEST_PASSWORD);

    const sidebar = page.locator(selectors.nav).first();
    await expect(sidebar).toBeVisible();

    const mainArea = page.locator(selectors.main).first();
    await expect(mainArea).toBeVisible();

    const mainBox = await mainArea.boundingBox();
    if (mainBox) {
      expect(mainBox.width).toBeGreaterThan(600);
    }

    await page.screenshot({ path: 'e2e/screenshots/desktop-layout.png', fullPage: true });
  });

  test('E2E-012: Mobile viewport (375x812) -> responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator(selectors.emailInput).first();
    const passwordInput = page.locator(selectors.passwordInput).first();
    const submitButton = page.locator(selectors.submitButton).first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    const emailBox = await emailInput.boundingBox();
    if (emailBox) {
      expect(emailBox.width).toBeLessThanOrEqual(375);
    }

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    await submitButton.click();

    await page.waitForURL(/dashboard|\/$/, { timeout: 15000 });

    await page.screenshot({ path: 'e2e/screenshots/mobile-layout.png', fullPage: true });
  });
});
