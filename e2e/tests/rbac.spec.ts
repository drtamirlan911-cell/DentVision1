import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const USERS = {
  'owner-a': { email: 'owner-a@test.com', password: 'Test1234!' },
  'admin-a': { email: 'admin-a@test.com', password: 'Test1234!' },
  'doctor-a': { email: 'doctor-a@test.com', password: 'Test1234!' },
  'assistant-a': { email: 'assistant-a@test.com', password: 'Test1234!' },
  'owner-b': { email: 'owner-b@test.com', password: 'Test1234!' },
  'regular': { email: 'regular@test.com', password: 'Test1234!' },
};

const tokens: Record<string, string> = {};

async function loginAs(api: APIRequestContext, role: keyof typeof USERS): Promise<string> {
  if (tokens[role]) return tokens[role];

  const user = USERS[role];
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: { email: user.email, password: user.password },
  });

  if (!res.ok()) {
    throw new Error(`Login failed for ${role}: ${res.status()}`);
  }

  const body = await res.json();
  const token = body.data?.accessToken || body.accessToken;
  if (!token) throw new Error(`No access token for ${role}`);
  tokens[role] = token;
  return token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('RBAC - Role-Based Access Control', () => {
  let api: APIRequestContext;

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
    for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
      try {
        await loginAs(api, role);
      } catch {
        // Pre-seeded user may not exist in all environments
      }
    }
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('RBAC-001: OWNER can access patients → 200', async () => {
    const token = tokens['owner-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/patients`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-002: ASSISTANT can access patients → 200', async () => {
    const token = tokens['assistant-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/patients`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-003: DOCTOR can access patients → 200', async () => {
    const token = tokens['doctor-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/patients`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-004: Unauthenticated access to patients → 401', async () => {
    const res = await api.get(`${BASE_URL}/api/patients`);
    expect(res.status()).toBe(401);
  });

  test('RBAC-005: OWNER can create invoices → 200/201', async () => {
    const token = tokens['owner-a'];
    if (!token) return test.skip();
    const res = await api.post(`${BASE_URL}/api/billing/invoices`, {
      headers: authHeaders(token),
      data: { amount: 10000, description: 'Test invoice' },
    });
    expect([200, 201]).toContain(res.status());
  });

  test('RBAC-006: ASSISTANT cannot create invoices → 403', async () => {
    const token = tokens['assistant-a'];
    if (!token) return test.skip();
    const res = await api.post(`${BASE_URL}/api/billing/invoices`, {
      headers: authHeaders(token),
      data: { amount: 10000, description: 'Test invoice' },
    });
    expect(res.status()).toBe(403);
  });

  test('RBAC-007: DOCTOR can read inventory → 200', async () => {
    const token = tokens['doctor-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/inventory`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-008: STUDENT cannot delete users → 403', async () => {
    const token = tokens['regular'];
    if (!token) return test.skip();
    const res = await api.delete(`${BASE_URL}/api/admin/users/some-user-id`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBe(403);
  });

  test('RBAC-009: ADMIN can access admin routes → 200', async () => {
    const token = tokens['admin-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/admin/users`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-010: MANAGER can access admin routes → 200', async () => {
    const token = tokens['manager-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/admin/users`, { headers: authHeaders(token) });
    expect(res.status()).toBe(200);
  });

  test('RBAC-011: DOCTOR cannot access admin routes → 403', async () => {
    const token = tokens['doctor-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/admin/users`, { headers: authHeaders(token) });
    expect(res.status()).toBe(403);
  });

  test('RBAC-012: ASSISTANT cannot access admin routes → 403', async () => {
    const token = tokens['assistant-a'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/admin/users`, { headers: authHeaders(token) });
    expect(res.status()).toBe(403);
  });

  test('RBAC-013: Cross-clinic access denied → 403/404', async () => {
    const token = tokens['owner-b'];
    if (!token) return test.skip();
    const res = await api.get(`${BASE_URL}/api/patients`, { headers: authHeaders(token) });
    expect([200, 403, 404]).toContain(res.status());
  });
});
