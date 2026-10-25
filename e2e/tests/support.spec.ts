import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = ['Test', '1234!'].join('');

type AuthenticatedUser = {
  context: APIRequestContext;
  token: string;
};

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function login(context: APIRequestContext, email: string): Promise<string> {
  const response = await context.post('/api/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(response.ok(), `login failed for ${email}: ${response.status()}`).toBeTruthy();

  const body = await response.json();
  const data = body.data ?? body;
  const token = data.accessToken ?? data.tokens?.accessToken;
  expect(typeof token).toBe('string');
  expect(token.length).toBeGreaterThan(0);
  return token;
}

async function createTicket(user: AuthenticatedUser) {
  const response = await user.context.post('/api/support/tickets', {
    headers: auth(user.token),
    data: {
      subject: `Support E2E ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: 'Regression test for support access and lifecycle. Contains no patient data.',
      category: 'WORKFLOW',
      sourcePath: '/help',
    },
  });
  if (response.status() !== 201) {
    throw new Error(`support ticket creation failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const ticket = body.data ?? body;
  expect(typeof ticket.id).toBe('string');
  return ticket as { id: string; status: string; priority: string };
}

test.describe('Ecosystem support API', () => {
  let ownerA!: AuthenticatedUser;
  let ownerB!: AuthenticatedUser;
  let support!: AuthenticatedUser;
  let ownerAContext: APIRequestContext | undefined;
  let ownerBContext: APIRequestContext | undefined;
  let supportContext: APIRequestContext | undefined;
  let anonymous: APIRequestContext | undefined;

  test.beforeAll(async () => {
    // Keep cookie/session state isolated between identities. A shared Playwright
    // request context can otherwise authenticate an ostensibly anonymous call.
    ownerAContext = await apiRequest.newContext({ baseURL: BASE_URL });
    ownerBContext = await apiRequest.newContext({ baseURL: BASE_URL });
    supportContext = await apiRequest.newContext({ baseURL: BASE_URL });
    anonymous = await apiRequest.newContext({ baseURL: BASE_URL });

    const [ownerAToken, ownerBToken, supportToken] = await Promise.all([
      login(ownerAContext, 'owner-a@test.com'),
      login(ownerBContext, 'owner-b@test.com'),
      login(supportContext, 'support@test.com'),
    ]);

    ownerA = { context: ownerAContext, token: ownerAToken };
    ownerB = { context: ownerBContext, token: ownerBToken };
    support = { context: supportContext, token: supportToken };
  });

  test.afterAll(async () => {
    await Promise.all([
      ownerAContext?.dispose(),
      ownerBContext?.dispose(),
      supportContext?.dispose(),
      anonymous?.dispose(),
    ]);
  });

  test('SUPPORT-E2E-001: requester can create and read their own ticket', async () => {
    const ticket = await createTicket(ownerA);

    const mineResponse = await ownerA.context.get('/api/support/mine', {
      headers: auth(ownerA.token),
    });
    expect(mineResponse.status()).toBe(200);
    const mineBody = await mineResponse.json();
    const mine = mineBody.data ?? mineBody;
    expect(Array.isArray(mine)).toBe(true);
    expect(mine.some((item: { id: string }) => item.id === ticket.id)).toBe(true);

    const detailResponse = await ownerA.context.get(`/api/support/tickets/${ticket.id}`, {
      headers: auth(ownerA.token),
    });
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.json();
    const detail = detailBody.data ?? detailBody;
    expect(detail.id).toBe(ticket.id);
    expect(detail.status).toBe('OPEN');
    expect(detail.messages).toEqual([]);
  });

  test('SUPPORT-E2E-002: another organization cannot read or reply to the ticket', async () => {
    const ticket = await createTicket(ownerA);

    const readResponse = await ownerB.context.get(`/api/support/tickets/${ticket.id}`, {
      headers: auth(ownerB.token),
    });
    expect(readResponse.status()).toBe(403);

    const replyResponse = await ownerB.context.post(`/api/support/tickets/${ticket.id}/messages`, {
      headers: auth(ownerB.token),
      data: { body: 'Unauthorized cross-user reply attempt' },
    });
    expect(replyResponse.status()).toBe(403);
  });

  test('SUPPORT-E2E-003: non-staff cannot access the support queue or staff directory', async () => {
    const queueResponse = await ownerA.context.get('/api/support/queue', {
      headers: auth(ownerA.token),
    });
    expect(queueResponse.status()).toBe(403);

    const staffResponse = await ownerA.context.get('/api/support/staff', {
      headers: auth(ownerA.token),
    });
    expect(staffResponse.status()).toBe(403);
  });

  test('SUPPORT-E2E-004: support staff receive the paginated queue and can progress a ticket', async () => {
    const ticket = await createTicket(ownerA);

    const queueResponse = await support.context.get('/api/support/queue?status=OPEN&page=1&limit=100', {
      headers: auth(support.token),
    });
    expect(queueResponse.status()).toBe(200);
    const queueBody = await queueResponse.json();
    const queue = queueBody.data ?? queueBody;
    expect(Array.isArray(queue.tickets)).toBe(true);
    expect(queue.pagination.page).toBe(1);
    expect(queue.pagination.limit).toBe(100);
    expect(queue.tickets.some((item: { id: string }) => item.id === ticket.id)).toBe(true);

    const updateResponse = await support.context.patch(`/api/support/tickets/${ticket.id}`, {
      headers: auth(support.token),
      data: { status: 'IN_PROGRESS', priority: 'HIGH' },
    });
    expect(updateResponse.status()).toBe(200);
    const updateBody = await updateResponse.json();
    const updated = updateBody.data ?? updateBody;
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.priority).toBe('HIGH');

    const requesterViewResponse = await ownerA.context.get(`/api/support/tickets/${ticket.id}`, {
      headers: auth(ownerA.token),
    });
    expect(requesterViewResponse.status()).toBe(200);
    const requesterViewBody = await requesterViewResponse.json();
    const requesterView = requesterViewBody.data ?? requesterViewBody;
    expect(requesterView.status).toBe('IN_PROGRESS');
    expect(requesterView.priority).toBe('HIGH');
  });

  test('SUPPORT-E2E-005: support endpoints reject unauthenticated requests', async () => {
    const mineResponse = await anonymous.get('/api/support/mine');
    expect(mineResponse.status()).toBe(401);

    const queueResponse = await anonymous.get('/api/support/queue');
    expect(queueResponse.status()).toBe(401);
  });
});
