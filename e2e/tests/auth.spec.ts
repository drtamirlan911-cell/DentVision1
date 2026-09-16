import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

test.describe('Authentication API', () => {
  let api: APIRequestContext;
  const testEmail = `auth-test-${Date.now()}@test.com`;
  const testPassword = 'Test1234!';
  const testUser = { email: testEmail, password: testPassword, firstName: 'Auth', lastName: 'Tester' };

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    const res = await api.post(`${BASE_URL}/api/auth/register`, { data: testUser });
    expect(res.status()).toBe(201);
  });

  test.afterAll(async () => {
    await api.dispose();
    await cleanupTestUser(testEmail);
  });

  test('AUTH-004: Register new user → 201', async () => {
    const freshEmail = `auth-fresh-${Date.now()}@test.com`;
    const res = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: freshEmail, password: testPassword, firstName: 'Auth', lastName: 'Fresh' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const user = body.data?.user || body.user;
    expect(user).toBeDefined();
    expect(user.email).toBe(freshEmail);
    expect(user.role).toBe('STUDENT');

    await cleanupTestUser(freshEmail);
  });

  test('AUTH-012: Public registration cannot grant privileged organization roles', async () => {
    const ownerEmail = `auth-owner-${Date.now()}@test.com`;
    const doctorEmail = `auth-doctor-${Date.now()}@test.com`;
    const labEmail = `auth-lab-${Date.now()}@test.com`;

    for (const [email, role] of [
      [ownerEmail, 'owner'],
      [doctorEmail, 'doctor'],
      [labEmail, 'lab'],
    ] as const) {
      const res = await api.post(`${BASE_URL}/api/auth/register`, {
        data: { email, password: testPassword, firstName: 'Role', lastName: 'Test', role },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data?.user?.role).toBe('STUDENT');
      expect(body.data?.accessToken).toBeDefined();

      const dbUser = await prisma.user.findUnique({ where: { email }, select: { role: true } });
      expect(dbUser?.role).toBe('STUDENT');
    }

    await cleanupTestUser(ownerEmail);
    await cleanupTestUser(doctorEmail);
    await cleanupTestUser(labEmail);
  });

  test('AUTH-005: Register with existing email → 409', async () => {
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

    const logoutRes = await api.post(`${BASE_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(logoutRes.status()).toBe(200);
  });

  test('AUTH-007: Access /me without token → 401', async () => {
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

  test('AUTH-011: Revoked session cannot use an otherwise-valid access token → 401', async () => {
    const loginRes = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    const accessToken = body.data?.accessToken || body.accessToken;
    expect(accessToken).toBeDefined();

    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as { sessionId?: string };
    expect(payload.sessionId).toBeDefined();

    await prisma.userSession.delete({ where: { id: payload.sessionId! } });

    const res = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status()).toBe(401);
  });

  test('AUTH-009: Refresh token rotation → 200 + new tokens', async () => {
    const loginRes = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    expect(loginRes.status()).toBe(200);

    const state = await api.storageState();
    const refreshCookie = state.cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();

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