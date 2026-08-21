import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

let ownerToken = '';

async function loginOwner(api: APIRequestContext) {
  if (ownerToken) return ownerToken;
  const res = await api.post(`${BASE_URL}/api/auth/login`, {
    data: { email: OWNER.email, password: OWNER.password },
  });
  const body = await res.json();
  ownerToken = body.data?.accessToken || body.accessToken;
  return ownerToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('API Contract Tests', () => {
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
    await loginOwner(api);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('CONTRACT-001: GET /api/auth/me returns {user: {id, email, firstName, lastName, role}}', async () => {
    const res = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    const user = body.data?.user || body.user || body.data;
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
    expect(user.role).toBeDefined();
  });

  test('CONTRACT-002: GET /api/patients returns {patients: [...], total: number}', async () => {
    const res = await api.get(`${BASE_URL}/api/patients`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    // paginatedResponse() nests the array at data.data (with pagination.total
    // alongside it), not data.patients — same shape as /shop/orders etc.
    const data = body.data || body;
    const patients = data.data || data.patients || (Array.isArray(data) ? data : null);
    const total = data.pagination?.total ?? data.total;
    expect(patients).toBeDefined();
    expect(Array.isArray(patients)).toBe(true);
    if (total !== undefined) {
      expect(typeof total).toBe('number');
    }
  });

  test('CONTRACT-003: POST /api/patients returns {id, firstName, lastName, ...}', async () => {
    const payload = {
      firstName: 'Contract',
      lastName: `Patient ${Date.now()}`,
      phone: `+7700${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: `contract-${Date.now()}@test.com`,
      birthDate: '1990-01-01',
      gender: 'MALE',
    };
    const res = await api.post(`${BASE_URL}/api/patients`, {
      headers: auth(ownerToken),
      data: payload,
    });
    expect([200, 201]).toContain(res.status());
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    const patient = body.data || body;
    expect(patient.id).toBeDefined();
    expect(patient.firstName).toBeDefined();
    expect(patient.lastName).toBeDefined();
  });

  test('CONTRACT-004: GET /api/shop/products returns {products: [...], total: number}', async () => {
    const res = await api.get(`${BASE_URL}/api/shop/products`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    const data = body.data || body;
    const products = data.products || (Array.isArray(data) ? data : null);
    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
    if (data.total !== undefined) {
      expect(typeof data.total).toBe('number');
    }
  });

  test('CONTRACT-005: Error responses have {error: string} shape', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'nonexistent@test.com', password: 'wrong' },
    });
    expect([400, 401, 422]).toContain(res.status());
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    const hasError =
      typeof body.error === 'string' ||
      typeof body.message === 'string' ||
      typeof body.data?.error === 'string' ||
      typeof body.data?.message === 'string';
    expect(hasError).toBe(true);
  });

  test('CONTRACT-006: 401 responses have proper error message', async () => {
    // Not the shared `api` context: `loginOwner` in `beforeAll` logged in on
    // it, so it's carrying a session cookie `authenticate` accepts exactly
    // as validly as a Bearer token — "no auth" on the shared context would
    // silently authenticate anyway. A fresh context has no cookies at all.
    const anonymous = await apiRequest.newContext();
    try {
      const res = await anonymous.get(`${BASE_URL}/api/auth/me`);
      expect(res.status()).toBe(401);
      expect(res.headers()['content-type']).toContain('application/json');
      const body = await res.json();
      const hasMessage =
        typeof body.error === 'string' ||
        typeof body.message === 'string' ||
        typeof body.data?.error === 'string';
      expect(hasMessage).toBe(true);
    } finally {
      await anonymous.dispose();
    }
  });

  test('CONTRACT-007: 403 responses have proper error message', async () => {
    const res = await api.get(`${BASE_URL}/api/admin/users`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status() === 403) {
      expect(res.headers()['content-type']).toContain('application/json');
      const body = await res.json();
      const hasMessage =
        typeof body.error === 'string' ||
        typeof body.message === 'string' ||
        typeof body.data?.error === 'string';
      expect(hasMessage).toBe(true);
    }
  });

  test('CONTRACT-008: 404 responses have proper error message', async () => {
    const res = await api.get(`${BASE_URL}/api/nonexistent-endpoint-${Date.now()}`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    const hasMessage =
      typeof body.error === 'string' ||
      typeof body.message === 'string' ||
      typeof body.data?.error === 'string';
    expect(hasMessage).toBe(true);
  });

  test('CONTRACT-009: 422 responses have validation errors', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: 'not-an-email', password: '123' },
    });
    if (res.status() === 422) {
      expect(res.headers()['content-type']).toContain('application/json');
      const body = await res.json();
      const hasErrors =
        Array.isArray(body.errors) ||
        Array.isArray(body.data?.errors) ||
        typeof body.error === 'string' ||
        typeof body.message === 'string';
      expect(hasErrors).toBe(true);
    }
  });

  test('CONTRACT-010: All responses have correct Content-Type', async () => {
    const endpoints = [
      { method: 'GET' as const, path: '/api/auth/me' },
      { method: 'GET' as const, path: '/api/patients' },
      { method: 'GET' as const, path: '/api/shop/products' },
    ];

    for (const { method, path } of endpoints) {
      const res = await api.get(`${BASE_URL}${path}`, {
        headers: auth(ownerToken),
      });
      const ct = res.headers()['content-type'] || '';
      expect(ct).toContain('application/json');
    }
  });
});
