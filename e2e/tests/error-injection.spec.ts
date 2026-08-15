import { test, expect, APIRequestContext } from '@playwright/test';

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

test.describe('Error Handling & Injection', () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ request }) => {
    api = request;
    await loginOwner(api);
  });

  test('ERROR-001: Invalid JSON body → 400 (not 500)', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      data: 'not valid json {{{',
    });
    expect(res.status()).not.toBe(500);
    expect([400, 422]).toContain(res.status());
  });

  test('ERROR-002: Missing required fields → 400/422', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      headers: auth(ownerToken),
      data: {},
    });
    expect(res.status()).not.toBe(500);
    expect([400, 422]).toContain(res.status());
  });

  test('ERROR-003: Extremely long input → 400/413 (not crash)', async () => {
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { message: 'x'.repeat(1_000_000) },
      timeout: 10000,
    });
    expect(res.status()).not.toBe(500);
    expect([200, 400, 413, 422]).toContain(res.status());
  });

  test('ERROR-004: SQL injection attempt → 400 (not 500)', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      headers: auth(ownerToken),
      data: {
        email: "admin'--",
        password: "' OR '1'='1",
      },
    });
    expect(res.status()).not.toBe(500);
    expect([400, 401, 422]).toContain(res.status());
  });

  test('ERROR-005: XSS in input → 201 (sanitized) or 400', async () => {
    const xssPayload = {
      firstName: '<script>alert("xss")</script>',
      lastName: 'Test',
      phone: '+77001234567',
      email: `xss-${Date.now()}@test.com`,
      birthDate: '1990-01-01',
      gender: 'MALE',
    };
    const res = await api.post(`${BASE_URL}/api/patients`, {
      headers: auth(ownerToken),
      data: xssPayload,
    });
    expect(res.status()).not.toBe(500);
    expect([200, 201, 400, 422]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const patient = body.data || body;
      expect(patient.firstName).not.toContain('<script>');
    }
  });

  test('ERROR-006: Non-existent route → 404', async () => {
    const res = await api.get(`${BASE_URL}/api/this-route-does-not-exist-${Date.now()}`, {
      headers: auth(ownerToken),
    });
    expect(res.status()).toBe(404);
  });

  test('ERROR-007: Method not allowed → 405', async () => {
    const res = await api.put(`${BASE_URL}/api/auth/login`, {
      headers: auth(ownerToken),
      data: { email: 'test@test.com', password: 'test' },
    });
    expect(res.status()).not.toBe(500);
    expect([404, 405]).toContain(res.status());
  });

  test('ERROR-008: Empty body on POST → 400', async () => {
    const res = await api.post(`${BASE_URL}/api/auth/login`, {
      headers: auth(ownerToken),
      data: undefined,
    });
    expect(res.status()).not.toBe(500);
    expect([400, 422]).toContain(res.status());
  });

  test('ERROR-009: Invalid JWT token → 401', async () => {
    const res = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token', 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('ERROR-010: Server handles concurrent errors gracefully', async () => {
    const badRequests = Array.from({ length: 10 }, () =>
      api.post(`${BASE_URL}/api/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'invalid', password: '' },
      }),
    );
    const results = await Promise.all(badRequests);
    for (const res of results) {
      expect(res.status()).not.toBe(500);
      expect([400, 401, 422]).toContain(res.status());
    }

    const healthRes = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: auth(ownerToken),
    });
    expect(healthRes.status()).toBe(200);
  });
});
