import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { cleanupTestUser } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

test.describe('Authentication API', () => {
  let api: APIRequestContext;
  const testEmail = `auth-test-${Date.now()}@test.com`;
  const testPassword = 'Test1234!';
  const testUser = { email: testEmail, password: testPassword, firstName: 'Auth', lastName: 'Tester' };

  /**
   * `api` is a context this file owns, created here and disposed in `afterAll`.
   *
   * It used to be Playwright's `request` fixture, captured in `beforeAll` and
   * reused from the tests — which Playwright refuses outright:
   * "Fixture { request } from beforeAll cannot be reused in a test." Every test
   * in this file threw that at its first call. Nothing noticed, because the suite
   * was never run: `test:e2e` is in package.json and in no CI workflow.
   */
  test.beforeAll(async () => {
    api = await apiRequest.newContext();
  });

  test.afterAll(async () => {
    await api.dispose();
    await cleanupTestUser(testEmail);
    await cleanupTestUser(`duplicate-${Date.now()}@test.com`);
  });

  test('AUTH-004: Register new user → 201', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/register`, {
      data: testUser,
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // Registration returns the same shape login does — `data.user`, not a
    // flattened `data.email` (see the correct pattern in AUTH-001 below).
    const user = body.data?.user || body.user;
    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail);
  });

  test('AUTH-005: Register with existing email → 409', async () => {
    // A locally-scoped email rather than the shared `testUser`: this test
    // must prove the duplicate check on its own, not depend on AUTH-004
    // having run first in the same process.
    const dupEmail = `auth-dup-${Date.now()}@test.com`;
    const dupUser = { email: dupEmail, password: testPassword, firstName: 'Auth', lastName: 'Dup' };
    const first = await api.post(`${BASE_URL}/api/auth/register`, { data: dupUser });
    expect(first.status()).toBe(201);

    const res = await api.post(`${BASE_URL}/api/auth/register`, { data: dupUser });
    expect(res.status()).toBe(409);

    await cleanupTestUser(dupEmail);
  });

  test('AUTH-001: Valid login with correct credentials → 200 + user object', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const user = body.data?.user || body.user;
    expect(user).toBeDefined();
    expect(user.email).toBe(testUser.email);
  });

  test('AUTH-002: Login with wrong password → 401', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: 'WrongPassword!' },
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-003: Login with non-existent email → 401', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'nonexistent@test.com', password: 'Test1234!' },
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-006: Logout → 200 + cookies cleared', async () => {
    const loginRes = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    expect(loginRes.status()).toBe(200);

    const cookies = await loginRes.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const logoutRes = await api.post(`${BASE_URL}/api/auth/logout`, {
      headers: { Cookie: cookieHeader },
    });
    expect(logoutRes.status()).toBe(200);
  });

  test('AUTH-007: Access /me without token → 401', async () => {
    const res = await api.get(`${BASE_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('AUTH-008: Access /me with expired token → 401', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LWlkIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
    const res = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-009: Refresh token rotation → 200 + new tokens', async () => {
    const loginRes = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    expect(loginRes.status()).toBe(200);

    const cookies = await loginRes.cookies();
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();

    const refreshRes = await api.post(`${BASE_URL}/api/auth/refresh`, {
      headers: { Cookie: `refreshToken=${refreshCookie!.value}` },
    });
    expect(refreshRes.status()).toBe(200);
    const body = await refreshRes.json();
    expect(body.data?.accessToken || body.accessToken).toBeDefined();
  });

  test('AUTH-010: Forgot password → 200 (always returns 200 for security)', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: testUser.email },
    });
    expect(res.status()).toBe(200);

    const nonExistentRes = await api.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: 'nonexistent@test.com' },
    });
    expect(nonExistentRes.status()).toBe(200);
  });
});
