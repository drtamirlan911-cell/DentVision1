import { test, expect, APIRequestContext, request as apiRequest } from '@playwright/test';
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();
const OWNER = { email: 'owner-a@test.com', password: 'Test1234!' };
const SUPERADMIN = { email: 'superadmin@test.com', password: 'Test1234!' };
const LECTURER_EMAIL = `payout-lecturer-${Date.now()}@test.com`;
const LECTURER_PASSWORD = 'Test1234!';
function auth(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
async function login(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${BASE_URL}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy(); return (await res.json()).data.accessToken;
}
async function setWalletBalance(walletId: string, minor: bigint) { await prisma.wallet.update({ where: { id: walletId }, data: { balance: minor } }); }

test.describe('Payout Workflow', () => {
  let api: APIRequestContext, ownerToken: string, superadminToken: string, lecturerToken: string, lecturerId: string, walletId: string;
  test.beforeAll(async () => {
    api = await apiRequest.newContext();
    ownerToken = await login(api, OWNER.email, OWNER.password);
    superadminToken = await login(api, SUPERADMIN.email, SUPERADMIN.password);
    const regRes = await api.post(`${BASE_URL}/api/auth/register`, { data: { email: LECTURER_EMAIL, password: LECTURER_PASSWORD, firstName: 'Payout', lastName: 'Lecturer' } });
    expect(regRes.status()).toBe(201);
    const baseToken = await login(api, LECTURER_EMAIL, LECTURER_PASSWORD);
    const lecRes = await api.post(`${BASE_URL}/api/lecturer/register`, { headers: auth(baseToken), data: {} });
    expect([200, 201]).toContain(lecRes.status()); lecturerId = (await lecRes.json()).data.id;
    await prisma.lecturer.update({ where: { id: lecturerId }, data: { level: 'verified' } });
    const switchRes = await api.post(`${BASE_URL}/api/iam/switch-context`, { headers: auth(baseToken), data: { scopeType: 'LECTURER', scopeId: lecturerId } });
    expect(switchRes.status()).toBe(200); lecturerToken = (await switchRes.json()).data.accessToken;
    const walletRes = await api.get(`${BASE_URL}/api/lecturer/wallet`, { headers: auth(lecturerToken) });
    expect(walletRes.status()).toBe(200); walletId = (await walletRes.json()).data.id;
  });
  test.afterAll(async () => {
    await prisma.payout.deleteMany({ where: { walletId } }).catch(() => {});
    const txs = await prisma.transaction.findMany({ where: { refType: 'payout' }, select: { id: true } }).catch(() => []);
    for (const t of txs) { await prisma.ledgerEntry.deleteMany({ where: { transactionId: t.id } }).catch(() => {}); await prisma.transaction.delete({ where: { id: t.id } }).catch(() => {}); }
    await prisma.ledgerEntry.deleteMany({ where: { walletId } }).catch(() => {}); await prisma.wallet.deleteMany({ where: { id: walletId } }).catch(() => {});
    if (lecturerId) await prisma.lecturer.deleteMany({ where: { id: lecturerId } }).catch(() => {}); await prisma.user.deleteMany({ where: { email: LECTURER_EMAIL } }).catch(() => {});
    await prisma.$disconnect(); await api.dispose();
  });
  test('PAYOUT-001: Register as lecturer, switch context → wallet reachable at 200', async () => {
    const res = await api.get(`${BASE_URL}/api/lecturer/wallet`, { headers: auth(lecturerToken) }); expect(res.status()).toBe(200); const wallet = (await res.json()).data;
    expect(wallet.ownerType).toBe('LECTURER'); expect(wallet.ownerId).toBe(lecturerId);
  });
  test('PAYOUT-002: Request payout with an empty wallet → 409 INSUFFICIENT_FUNDS', async () => {
    await setWalletBalance(walletId, 0n); const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, { headers: auth(lecturerToken), data: { amountMinor: 100000 } });
    expect(res.status()).toBe(409); expect((await res.json()).error).toContain('Недостаточно средств');
  });
  test('PAYOUT-003: Request payout within balance → 201, status requested', async () => {
    await setWalletBalance(walletId, 1_000_000n); const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, { headers: auth(lecturerToken), data: { amountMinor: 300000 } });
    expect(res.status()).toBe(201); const payout = (await res.json()).data; expect(payout.status).toBe('requested'); expect(payout.amount).toBe('300000');
  });
  test('PAYOUT-004: Second request beyond what remains after the first → 409', async () => {
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, { headers: auth(lecturerToken), data: { amountMinor: 800000 } }); expect(res.status()).toBe(409);
  });
  test('PAYOUT-005: superadmin queue sees the pending payout → 200; clinic owner is denied', async () => {
    const denied = await api.get(`${BASE_URL}/api/finance/payouts`, { headers: auth(ownerToken) }); expect(denied.status()).toBe(403);
    const res = await api.get(`${BASE_URL}/api/finance/payouts`, { headers: auth(superadminToken) }); expect(res.status(), await res.text()).toBe(200);
    const payouts = (await res.json()).data; expect(Array.isArray(payouts)).toBe(true); expect(payouts.some((p: any) => p.walletId === walletId && p.status === 'requested')).toBe(true);
  });
  test('PAYOUT-006 through 009: approve → paid, with the illegal transitions each blocked', async () => {
    const listRes = await api.get(`${BASE_URL}/api/finance/payouts`, { headers: auth(superadminToken) }); expect(listRes.status()).toBe(200);
    const payouts = (await listRes.json()).data; const payout = payouts.find((p: any) => p.walletId === walletId && p.status === 'requested'); expect(payout).toBeTruthy();
    const approveRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, { headers: auth(superadminToken), data: { status: 'approved' } });
    expect(approveRes.status()).toBe(200); expect((await approveRes.json()).data.status).toBe('approved');
    const backwardRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, { headers: auth(superadminToken), data: { status: 'requested' } });
    expect(backwardRes.status()).toBe(400); expect((await backwardRes.json()).error).toContain('Нельзя перевести');
    const [beforeLecturer, beforeGateway] = await Promise.all([prisma.wallet.findUnique({ where: { id: walletId } }), prisma.wallet.findFirst({ where: { ownerType: 'GATEWAY', ownerId: 'system' } })]);
    const payRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, { headers: auth(superadminToken), data: { status: 'paid' } });
    expect(payRes.status()).toBe(200); expect((await payRes.json()).data.status).toBe('paid');
    const [afterLecturer, afterGateway] = await Promise.all([prisma.wallet.findUnique({ where: { id: walletId } }), prisma.wallet.findFirst({ where: { ownerType: 'GATEWAY', ownerId: 'system' } })]);
    const amount = BigInt(payout.amount); expect(afterLecturer!.balance).toBe(beforeLecturer!.balance - amount); expect(afterGateway!.balance).toBe((beforeGateway?.balance ?? 0n) + amount);
    const rePayRes = await api.post(`${BASE_URL}/api/finance/payouts/${payout.id}/status`, { headers: auth(superadminToken), data: { status: 'paid' } }); expect(rePayRes.status()).toBe(400);
  });
  test('PAYOUT-010: Requesting a payout without a lecturer context → 403, not a crash', async () => {
    const res = await api.post(`${BASE_URL}/api/lecturer/payouts`, { headers: auth(ownerToken), data: { amountMinor: 1000 } }); expect(res.status()).toBe(403); expect((await res.json()).error).toContain('контекст лектора');
  });
});
