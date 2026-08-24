import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
// See helpers/db.ts for why this isn't the bare `@prisma/client` specifier —
// it would resolve to a dead legacy schema at the repo root, not this backend.
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };
// A dedicated lecturer account per run, not the shared `regular@test.com` —
// this file funds its wallet directly through Prisma and drives it through
// the full payout state machine, and a lecturer profile plus stray Payout/
// Transaction/LedgerEntry rows are not something another spec sharing that
// fixture user should have to account for.
const LECTURER_EMAIL = `payout-lecturer-${Date.now()}@test.com`;
const LECTURER_PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function login(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

/**
 * Fund a wallet directly rather than through a real course sale + cashback
 * pipeline — that pipeline is its own, much larger, already-tested surface
 * (payments.spec.ts, cashback engine). This file is testing the payout
 * queue and its balance-holding logic, not how money gets into a wallet in
 * the first place; a direct write is the fixture, not the thing under test.
 */
async function setWalletBalance(walletId: string, minor: bigint) {
  await prisma.wallet.update({ where: { id: walletId }, data: { balance: minor } });
}

test.describe('Payout Workflow', () => {
  let api: APIRequestContext;
  let ownerToken: string;
  let lecturerToken: string; // token carrying lecturerId, after switch-context
  let lecturerId: string;
  let walletId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await login(api, OWNER.email, OWNER.password);

    const regRes = await api.post(`${BASE_URL}/api/auth/register`, {
      data: { email: LECTURER_EMAIL, password: LECTURER_PASSWORD, firstName: 'Payout', lastName: 'Lecturer' },
    });
    expect(regRes.status()).toBe(201);
    const baseToken = await login(api, LECTURER_EMAIL, LECTURER_PASSWORD);

    // Self-serve: POST /lecturer/register needs no prior context, per
    // lecturer.routes.ts's own comment on that route.
    const lecRes = await api.post(`${BASE_URL}/api/lecturer/register`, {
      headers: auth(baseToken),
      data: {},
    });
    expect([200, 201]).toContain(lecRes.status());
    lecturerId = (await lecRes.json()).data.id;

    // POST /lecturer/payouts is gated behind a verified lecturer profile
    // (requireVerifiedLecturer in lecturer.routes.ts) — a freshly self-
    // registered lecturer starts at level:'new' and would get 403 before
    // ever reaching the balance check this file exists to test. Promote
    // directly via Prisma, same as setWalletBalance below: this file tests
    // the payout state machine, not the moderation pipeline.
    await prisma.lecturer.update({ where: { id: lecturerId }, data: { level: 'verified' } });

    // POST /lecturer/payouts reads req.user.lecturerId from the JWT — that
    // only appears after switching context (iam.routes.ts's switch-context).
    const switchRes = await api.post(`${BASE_URL}/api/iam/switch-context`, {
      headers: auth(baseToken),
      data: { scopeType: 'LECTURER', scopeId: lecturerId },
    });
    expect(switchRes.status()).toBe(200);
    lecturerToken = (await switchRes.json()).data.accessToken;

    const walletRes = await api.get(`${BASE_URL}/api/lecturer/wallet`, { headers: auth(lecturerToken) });
    expect(walletRes.status()).toBe(200);
    walletId = (await walletRes.json()).data.id;
  });

  test.afterAll(async () => {
    await prisma.payout.deleteMany({ where: { walletId } }).catch(() => {});
    const txs = await prisma.transaction.findMany({ where: { refType: 'payout' }, select: { id: true } }).catch(() => []);
    for (const t of txs) {
      await prisma.ledgerEntry.deleteMany({ where: { transactionId: t.id } }).catch(() => {});
      await prisma.transaction.delete({ where: { id: t.id } }).catch(() => {});
    }
    await prisma.ledgerEntry.deleteMany({ where: { walletId } }).catch(() => {});
    await prisma.wallet.deleteMany({ where: { id: walletId } }).catch(() => {});
    if (lecturerId) await prisma.lecturer.deleteMany({ where: { id: lecturerId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: LECTURER_EMAIL } }).catch(() => {});
    await prisma.$disconnect();
    await api.dispose();
  });

  test('PAYOUT-001: Register as lecturer, switch context → wallet reachable at 200', async () => {
    const res = await api.get(`${BASE_URL}/api/lecturer/wallet`, { headers: auth(lecturerToken) });
    expect(res.status()).toBe(200);
    const wallet = (await res.json()).data;
    expect(wallet.ownerType).toBe('LECTURER');
    expect(wallet.ownerId).toBe(lecturerId);
  });

  test('PAYOUT-002: Request payout with an empty wallet → 409 INSUFFICIENT_FUNDS', async () => {
    await setWalletBalance(walletId, 0n);
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, {
      headers: auth(lecturerToken),
      data: { amountMinor: 100000 },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Недостаточно средств');
  });

  test('PAYOUT-003: Request payout within balance → 201, status requested', async () => {
    await setWalletBalance(walletId, 1_000_000n);
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, {
      headers: auth(lecturerToken),
      data: { amountMinor: 300000 },
    });
    expect(res.status()).toBe(201);
    const payout = (await res.json()).data;
    expect(payout.status).toBe('requested');
    expect(payout.amount).toBe('300000');
  });

  test('PAYOUT-004: Second request beyond what remains after the first → 409', async () => {
    // Balance is 1,000,000; PAYOUT-003 already holds 300,000 of it (still
    // `requested`, unresolved) — this is exactly the bug payout.service.ts's
    // own comment describes: checking raw wallet.balance instead of balance
    // minus already-requested amounts let the same funds be claimed twice.
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, {
      headers: auth(lecturerToken),
      data: { amountMinor: 800000 }, // > the 700,000 actually still available
    });
    expect(res.status()).toBe(409);
  });

  test('PAYOUT-005: finance.manage queue sees the pending payout → 200', async () => {
    const res = await api.get(`${BASE_URL}/api/finance/payouts`, { headers: auth(ownerToken) });
    expect(res.status()).toBe(200);
    const payouts = (await res.json()).data;
    expect(Array.isArray(payouts)).toBe(true);
    expect(payouts.some((p: any) => p.walletId === walletId && p.status === 'requested')).toBe(true);
  });

  test('PAYOUT-006 through 009: approve → paid, with the illegal transitions each blocked', async () => {
    const listRes = await api.get(`${BASE_URL}/api/finance/payouts`, { headers: auth(ownerToken) });
    const payouts = (await listRes.json()).data;
    const payout = payouts.find((p: any) => p.walletId === walletId && p.status === 'requested');
    expect(payout).toBeTruthy();

    // PAYOUT-006: requested → approved
    const approveRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, {
      headers: auth(ownerToken),
      data: { status: 'approved' },
    });
    expect(approveRes.status()).toBe(200);
    expect((await approveRes.json()).data.status).toBe('approved');

    // PAYOUT-007: approved → requested is not a legal move backwards.
    const backwardRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, {
      headers: auth(ownerToken),
      data: { status: 'requested' },
    });
    expect(backwardRes.status()).toBe(400);
    expect((await backwardRes.json()).error).toContain('Нельзя перевести');

    const [beforeLecturer, beforeGateway] = await Promise.all([
      prisma.wallet.findUnique({ where: { id: walletId } }),
      prisma.wallet.findFirst({ where: { ownerType: 'GATEWAY', ownerId: 'system' } }),
    ]);

    // PAYOUT-008: approved → paid actually moves the money — the mirror of a
    // sale, per payout.service.ts's own comment: debit the payer, credit the
    // gateway, and the ledger stays balanced.
    const payRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, {
      headers: auth(ownerToken),
      data: { status: 'paid' },
    });
    expect(payRes.status()).toBe(200);
    expect((await payRes.json()).data.status).toBe('paid');

    const [afterLecturer, afterGateway] = await Promise.all([
      prisma.wallet.findUnique({ where: { id: walletId } }),
      prisma.wallet.findFirst({ where: { ownerType: 'GATEWAY', ownerId: 'system' } }),
    ]);
    const amount = BigInt(payout.amount);
    expect(afterLecturer!.balance).toBe(beforeLecturer!.balance - amount);
    expect(afterGateway!.balance).toBe((beforeGateway?.balance ?? 0n) + amount);

    // PAYOUT-009: paid is terminal — a second `paid` must not post the
    // ledger entry twice. transitionPayout's own comment calls this the
    // reason `paid`/`rejected` allow no further moves at all.
    const rePayRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, {
      headers: auth(ownerToken),
      data: { status: 'paid' },
    });
    expect(rePayRes.status()).toBe(400);
  });

  test('PAYOUT-010: Requesting a payout without a lecturer context → 403, not a crash', async () => {
    // ownerToken never went through switch-context: req.user.lecturerId is
    // undefined, and lecturer.routes.ts guards every lecturer-scoped route
    // on that explicitly (403 "Требуется контекст лектора") rather than
    // letting a non-null assertion on it blow up as a 500.
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, {
      headers: auth(ownerToken),
      data: { amountMinor: 1000 },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('контекст лектора');
  });
});
