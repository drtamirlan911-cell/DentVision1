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

test.describe('AI API', () => {
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

  test('AI-001: AI query returns response → 200', async () => {
    // The route's Zod schema (querySchema, ai.routes.ts) requires `text`,
    // not `message` — a request without it never reaches the AI at all,
    // it 400s on "body.text: Required" before that.
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: 'What are common dental procedures?' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = body.data || body;
    expect(data.response || data.message || data.content).toBeDefined();
  });

  test('AI-002: AI query with empty message → 400', async () => {
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: '' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('AI-003: AI timeout handling → graceful error (not 500)', async () => {
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: 'x'.repeat(10000) },
      timeout: 5000,
    });
    expect(res.status()).not.toBe(500);
    // 429 is a legitimate outcome here too: aiLimiter (app.ts) is shared
    // across every test hitting /api/ai/query in this run, including
    // AI-008's own deliberate flood later in this same file.
    expect([200, 400, 408, 422, 429, 502, 504]).toContain(res.status());
  });

  test('AI-004: AI malformed response → graceful fallback', async () => {
    const res = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: '???###invalid###???' },
    });
    expect(res.status()).not.toBe(500);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('AI-005: AI failure does not break main workflow → user gets error message', async () => {
    const badRes = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: '' },
    });
    expect(badRes.status()).not.toBe(500);

    const healthRes = await api.get(`${BASE_URL}/api/auth/me`, {
      headers: auth(ownerToken),
    });
    expect(healthRes.status()).toBe(200);
  });

  test('AI-006: AI thread creation → 200', async () => {
    const queryRes = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: 'Start a new discussion about orthodontics' },
    });
    expect(queryRes.status()).toBe(200);

    const threadsRes = await api.get(`${BASE_URL}/api/ai/threads`, {
      headers: auth(ownerToken),
    });
    expect(threadsRes.status()).toBe(200);
    const body = await threadsRes.json();
    // GET /threads answers { ok, data: { threads: [...] } }, not data itself.
    const threads = body.data?.threads || body.data || body;
    expect(Array.isArray(threads)).toBe(true);
  });

  test('AI-007: AI message history → 200 + array', async () => {
    const queryRes = await api.post(`${BASE_URL}/api/ai/query`, {
      headers: auth(ownerToken),
      data: { text: 'Tell me about dental implants' },
    });
    expect(queryRes.status()).toBe(200);

    // There's no GET /threads/:id/messages route — per-thread messages
    // aren't exposed separately. The actual history endpoint is
    // GET /api/ai/history: a list of AISession rows, each carrying its own
    // `messages` array inline.
    const historyRes = await api.get(`${BASE_URL}/api/ai/history`, {
      headers: auth(ownerToken),
    });
    expect(historyRes.status()).toBe(200);
    const historyBody = await historyRes.json();
    const sessions = historyBody.data || historyBody;
    expect(Array.isArray(sessions)).toBe(true);
    if (sessions.length > 0) {
      expect(Array.isArray(sessions[0].messages)).toBe(true);
    }
  });

  test('AI-008: AI rate limiting → 429 after too many requests', async () => {
    // aiLimiter (app.ts) is max:100 per 15 minutes per IP — 15 requests
    // never had a chance of tripping it. Comfortably clearing that ceiling
    // (plus whatever this file's own earlier tests already used from the
    // same IP/window) is what actually exercises the limiter.
    const requests = Array.from({ length: 110 }, () =>
      api.post(`${BASE_URL}/api/ai/query`, {
        headers: auth(ownerToken),
        data: { text: 'Quick question' },
      }),
    );
    const results = await Promise.all(requests);
    const statuses = results.map((r) => r.status());
    const hasRateLimit = statuses.some((s) => s === 429);
    expect(hasRateLimit).toBe(true);
  });
});
