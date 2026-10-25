import { test, expect, APIRequestContext } from '@playwright/test';

const USER_A = { email: 'owner-a@test.com', password: 'Test1234!' };
const USER_B = { email: 'owner-b@test.com', password: 'Test1234!' };

async function login(api: APIRequestContext, credentials: { email: string; password: string }) {
  const res = await api.post('/api/auth/login', { data: credentials });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body.data || body;
  const token = data.accessToken || data.tokens?.accessToken;
  expect(token).toBeTruthy();
  return token as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Session Security', () => {
  test('SEC-SESSION-001: a user cannot expire another user session', async ({ request }) => {
    const tokenA = await login(request, USER_A);
    const tokenB = await login(request, USER_B);

    const sessionsA = await request.get('/api/compliance/sessions', { headers: auth(tokenA) });
    expect(sessionsA.ok()).toBeTruthy();
    const bodyA = await sessionsA.json();
    const listA = bodyA.data || bodyA;
    expect(listA.length).toBeGreaterThan(0);
    const sessionA = listA[0].id;

    const forged = await request.post(`/api/compliance/sessions/${sessionA}/expire`, {
      headers: auth(tokenB),
    });
    expect(forged.status()).toBe(404);

    const stillActive = await request.get('/api/compliance/sessions', { headers: auth(tokenA) });
    expect(stillActive.ok()).toBeTruthy();
    const bodyStill = await stillActive.json();
    expect((bodyStill.data || bodyStill).some((session: { id: string }) => session.id === sessionA)).toBeTruthy();
  });
});
