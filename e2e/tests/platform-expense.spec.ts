import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };
const SUPERADMIN = { email: 'superadmin@test.com', password: 'Test1234!' };
function auth(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
async function login(api: APIRequestContext, email: string, password: string): Promise<string> { const res = await api.post(`${BASE_URL}/api/auth/login`, { data: { email, password } }); expect(res.ok()).toBeTruthy(); return (await res.json()).data.accessToken; }

test.describe('Platform expenses (finance.routes.ts POST/GET /expenses)', () => {
  let api: APIRequestContext, ownerToken: string, superadminToken: string;
  test.beforeAll(async () => { api = await apiRequest.newContext(); ownerToken = await login(api, OWNER.email, OWNER.password); superadminToken = await login(api, SUPERADMIN.email, SUPERADMIN.password); });
  test.afterAll(async () => { await api.dispose(); });
  test('EXP-001 clinic owner is denied before validation; superadmin gets validation error', async () => {
    expect((await api.post(`${BASE_URL}/api/finance/expenses`, { headers: auth(ownerToken), data: { category: 'NOT_A_CATEGORY', amount: '1000' } })).status()).toBe(403);
    expect((await api.post(`${BASE_URL}/api/finance/expenses`, { headers: auth(superadminToken), data: { category: 'NOT_A_CATEGORY', amount: '1000' } })).status()).toBe(400);
  });
  test('EXP-002 create rejects a non-positive amount', async () => {
    const res = await api.post(`${BASE_URL}/api/finance/expenses`, { headers: auth(superadminToken), data: { category: 'SERVER', amount: '0' } }); expect(res.status()).toBe(400);
  });
  test('EXP-003 create writes a PlatformExpense row, and the list reflects it', async () => {
    const createRes = await api.post(`${BASE_URL}/api/finance/expenses`, { headers: auth(superadminToken), data: { category: 'SERVER', amount: '15000', meta: { note: 'e2e' } } });
    expect(createRes.status()).toBe(201); const created = (await createRes.json()).data; expect(created.category).toBe('SERVER'); expect(created.amount).toBe('1500000');
    const listRes = await api.get(`${BASE_URL}/api/finance/expenses?category=SERVER`, { headers: auth(superadminToken) }); expect(listRes.status()).toBe(200); const rows = (await listRes.json()).data; expect(rows.some((r: any) => r.id === created.id)).toBe(true);
  });
  test('EXP-004 unauthenticated request is rejected', async () => { const anon = await apiRequest.newContext(); try { expect((await anon.get(`${BASE_URL}/api/finance/expenses`)).status()).toBe(401); } finally { await anon.dispose(); } });
});
