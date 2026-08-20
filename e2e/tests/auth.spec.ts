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
    // Registered here rather than left to the AUTH-004 test: every test below
    // that logs in as `testUser` was implicitly depending on AUTH-004 having
    // already run and succeeded in the same process. That dependency broke
    // outright in an environment where the test runner recycles its process
    // between tests — `testUser` would still exist as a value, but the row
    // behind it wouldn't. Registering it here means it exists before any test
    // in this file can possibly run, independent of execution order.
    const res = await api.post(`${BASE_URL}/api/auth/register`, { data: testUser });
    expect(res.status()).toBe(201);
  });

  test.afterAll(async () => {
    await api.dispose();
    await cleanupTestUser(testEmail);
  });

  test('AUTH-004: Register new user → 201', async () => {
    // A fresh email of its own: `testUser` is already registered by
    // `beforeAll`, so reusing it here would legitimately get 409, not prove
    // the create path.
    const freshEmail = `auth-fresh-${Date.now()}@test.com`;
    const res = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: freshEmail, password: testPassword, firstName: 'Auth', lastName: 'Fresh' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // Registration returns the same shape login does — `data.user`, not a
    // flattened `data.email` (see the correct pattern in AUTH-001 below).
    const user = body.data?.user || body.user;
    expect(user).toBeDefined();
    expect(user.email).toBe(freshEmail);

    await cleanupTestUser(freshEmail);
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
    const loginBody = await loginRes.json();
    const accessToken = loginBody.data?.accessToken || loginBody.accessToken;

    // Logout is CSRF-protected (it's a state-changing POST), and Playwright's
    // request context has no way to mirror the `dv_csrf` cookie into the
    // `x-csrf-token` header the double-submit check wants — that's the
    // browser's job. A Bearer token skips that check entirely (see
    // csrf.ts's own comment: JWT auth is inherently CSRF-safe), which is
    // exactly what every other authenticated call in this file already does.
    const logoutRes = await api.post(`${BASE_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status()).toBe(200);
  });

  test('AUTH-007: Access /me without token → 401', async () => {
    // Not the shared `api` context: by this point in the file it's carrying
    // the session cookie from earlier logins, and `/me` accepts that cookie
    // just as validly as a Bearer token — so "without token" on the shared
    // context would silently authenticate via the cookie instead. A fresh
    // context genuinely has neither.
    const anonymous = await apiRequest.newContext();
    try {
      const res = await anonymous.get(`${BASE_URL}/api/auth/me`);
      expect(res.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
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

    // `APIResponse` has no `.cookies()` method — the context's own
    // `storageState()` is how Playwright exposes the cookies it's holding.
    const state = await api.storageState();
    const refreshCookie = state.cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();

    // `/auth/refresh` reads `refreshToken` from the JSON body, not from the
    // cookie — the cookie is what a browser client would carry, but this
    // route never falls back to reading it itself.
    const refreshRes = await api.post(`${BASE_URL}/api/auth/refresh`, {
      data: { refreshToken: refreshCookie!.value },
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
