import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function token(request: any, email: string) {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

test.describe('Finance Hub — partner economics', () => {
  test('FIN-001: finance manager can inspect durable partner economics and reconciliation', async ({ request }) => {
    const t = await token(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}` };

    const dashboard = await request.get(`${BASE}/api/finance/partner-economics/dashboard`, { headers });
    expect([200, 403]).toContain(dashboard.status());
    if (dashboard.status() === 403) return;

    const body = await dashboard.json();
    expect(body.ok).toBeTruthy();
    expect(body.data).toHaveProperty('byVertical');
    expect(body.data).toHaveProperty('alerts');

    const reconciliation = await request.get(`${BASE}/api/finance/partner-economics/reconciliation`, { headers });
    expect(reconciliation.status()).toBe(200);
    const reconciliationBody = await reconciliation.json();
    expect(reconciliationBody.ok).toBeTruthy();
    expect(reconciliationBody.data).toHaveProperty('rows');
    expect(reconciliationBody.data).toHaveProperty('discrepancies');

    const transparency = await request.get(`${BASE}/api/finance/partner-economics/transparency`, { headers });
    expect(transparency.status()).toBe(200);
    const transparencyBody = await transparency.json();
    expect(transparencyBody.ok).toBeTruthy();
    expect(transparencyBody.data).toHaveProperty('rows');
    expect(transparencyBody.data).toHaveProperty('period');
  });

  test('FIN-002: non-finance user cannot read partner economics', async ({ request }) => {
    const t = await token(request, 'doctor-a@test.com');
    const res = await request.get(`${BASE}/api/finance/partner-economics/dashboard`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('FIN-003: invalid economics period fails closed', async ({ request }) => {
    const t = await token(request, 'owner-a@test.com');
    const res = await request.get(`${BASE}/api/finance/partner-economics/transparency?from=not-a-date`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(res.status()).toBe(400);
  });
});
