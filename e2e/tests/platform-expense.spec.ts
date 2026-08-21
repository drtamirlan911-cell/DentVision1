import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function login(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

test.describe('Platform expenses (finance.routes.ts POST/GET /expenses)', () => {
  let api: APIRequestContext;
  let ownerToken: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await login(api, OWNER.email, OWNER.password);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('EXP-001 create rejects an unknown category', async () => {
    const res = await api.post(`${BASE_URL}/api/finance/expenses`, {
      headers: auth(ownerToken),
      data: { category: 'NOT_A_CATEGORY', amount: '1000' },
    });
    expect(res.status()).toBe(400);
  });

  test('EXP-002 create rejects a non-positive amount', async () => {
    const res = await api.post(`${BASE_URL}/api/finance/expenses`, {
      headers: auth(ownerToken),
      data: { category: 'SERVER', amount: '0' },
    });
    expect(res.status()).toBe(400);
  });

  test('EXP-003 create writes a PlatformExpense row, and the list reflects it', async () => {
    const createRes = await api.post(`${BASE_URL}/api/finance/expenses`, {
      headers: auth(ownerToken),
      data: { category: 'SERVER', amount: '15000', meta: { note: 'e2e' } },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()).data;
    expect(created.category).toBe('SERVER');
    expect(created.amount).toBe('1500000'); // minor units (тиын)

    const listRes = await api.get(`${BASE_URL}/api/finance/expenses?category=SERVER`, {
      headers: auth(ownerToken),
    });
    expect(listRes.status()).toBe(200);
    const rows = (await listRes.json()).data;
    expect(rows.some((r: any) => r.id === created.id)).toBe(true);
  });

  test('EXP-004 unauthenticated request is rejected', async () => {
    // A fresh context, not the shared `api` one — `login()` above leaves an
    // `accessToken` cookie on `api`'s context, which `authenticate` also
    // accepts (see auth.ts), so a header-less request through `api` would
    // still ride that cookie and pass.
    const anon = await apiRequest.newContext();
    try {
      const res = await anon.get(`${BASE_URL}/api/finance/expenses`);
      expect(res.status()).toBe(401);
    } finally {
      await anon.dispose();
    }
  });
});
