import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_API_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

test('RB-034 diagnostic operator has a readable canonical workspace context', async ({ request }) => {
  const login = await request.post(`${BASE}/api/auth/login`, {
    data: { email: 'diagnostic-operator@test.com', password: PASSWORD },
  });
  const loginBody = await login.json().catch(() => ({}));
  expect(login.status(), `partner login failed: ${login.status()} ${JSON.stringify(loginBody)}`).toBe(200);

  const token = loginBody.data?.accessToken || loginBody.accessToken;
  expect(token, 'partner login response did not include an access token').toBeTruthy();

  const contexts = await request.get(`${BASE}/api/iam/me/contexts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await contexts.json().catch(async () => ({ raw: await contexts.text().catch(() => '') }));
  expect(
    contexts.status(),
    `GET /api/iam/me/contexts failed: status=${contexts.status()} body=${JSON.stringify(body)}`,
  ).toBe(200);

  const rows = body.data?.contexts || [];
  const scoped = rows.find((row: { scopeType?: string; roleKey?: string }) =>
    row.scopeType === 'DIAGNOSTIC_CENTER' &&
    String(row.roleKey || '').toLowerCase().split(',').includes('diagnostic_operator'),
  );
  expect(scoped, `diagnostic_operator context not present: ${JSON.stringify(rows)}`).toBeTruthy();
});
