import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { makeIin } from '../helpers/iin';

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
    // querySchema (ai.routes.ts) requires `text`, not `message`.
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: 'x'.repeat(1_000_000) },
      timeout: 10000,
    });
    expect(res.status()).not.toBe(500);
    // 429 belongs here too: aiLimiter is shared across every test in this
    // run hitting /api/ai/query, so a prior test tripping it here is a
    // legitimate "handled gracefully, not a crash" outcome, not a failure
    // of this test's own concern.
    expect([200, 400, 413, 422, 429]).toContain(res.status());
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
      data: { iin: makeIin(), email: 'test@test.com', password: 'test' },
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
