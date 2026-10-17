// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  user: { id: 'authenticated-user', role: 'DOCTOR', clinicId: 'clinic-owned' } as any,
  paymentCreate: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  paymentFindUniqueOrThrow: vi.fn(),
  transaction: vi.fn(),
  orderFindUnique: vi.fn(),
  courseFindUnique: vi.fn(),
  providerCreate: vi.fn(),
  providerStatus: vi.fn(),
  getClinicGatewayStatus: vi.fn(),
  loadClinicPaymentsConfig: vi.fn(),
  assertClinicBillingAccess: vi.fn(),
  assertOrgAccess: vi.fn(),
  resolveClinicMemberAccess: vi.fn(),
  reserveIdempotencyKey: vi.fn(),
  completeIdempotencyKey: vi.fn(),
  deleteIdempotencyKey: vi.fn(),
  auditFromReq: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    payment: { create: m.paymentCreate, findUnique: m.paymentFindUnique },
    order: { findUnique: m.orderFindUnique },
    course: { findUnique: m.courseFindUnique },
    $transaction: m.transaction,
  },
}));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = m.user; next(); },
}));
vi.mock('../../lib/helpers.js', () => ({ uid: () => 'test-id' }));
vi.mock('../../lib/money.js', () => ({
  serializeBigInt: (value: any) => JSON.parse(JSON.stringify(value, (_key, val) => typeof val === 'bigint' ? val.toString() : val)),
  tengeToMinor: (tenge: number) => BigInt(Math.round(tenge * 100)),
  parseTengeToMinor: (tenge: number | string) => BigInt(Math.round(Number(tenge) * 100)),
}));
vi.mock('../finance/finance.service.js', () => ({ recordSaleTx: vi.fn() }));
vi.mock('../finance/revenue.service.js', () => ({ writeRevenue: vi.fn() }));
vi.mock('../../config.js', () => ({
  env: { NODE_ENV: 'test', KASPI_CALLBACK_SECRET: 'test-secret-with-at-least-32-characters' },
}));
vi.mock('./kaspi.provider.js', () => ({
  providers: {
    kaspi_qr: { name: 'kaspi_qr', createPayment: m.providerCreate, getPaymentStatus: m.providerStatus },
  },
  markMockPaymentStatus: vi.fn(),
  verifyKaspiCallbackAuth: vi.fn(() => ({ ok: true })),
  withPaymentQr: (payment: any, qr?: string | null) => ({ ...payment, qr: qr || null, qrUrl: qr || null }),
}));
vi.mock('./clinicPayments.js', () => ({
  ClinicPaymentsError: class ClinicPaymentsError extends Error { status = 400; code = 'CLINIC_PAYMENTS'; },
  createClinicKaspiPayment: vi.fn(),
  getClinicGatewayStatus: vi.fn(),
  loadClinicPaymentsConfig: vi.fn(),
}));
vi.mock('../../lib/orgContext.js', () => ({
  assertOrgAccess: m.assertOrgAccess,
  resolveClinicAccess: m.resolveClinicMemberAccess,
}));
vi.mock('../billing/clinicSubscription.service.js', () => ({
  assertClinicBillingAccess: m.assertClinicBillingAccess,
  getClinicSubscriptionAmountMinor: (plan: string, months: unknown) => {
    const monthly: Record<string, bigint> = {
      starter: 1_990_000n,
      professional: 3_990_000n,
      enterprise: 7_990_000n,
    };
    if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 24 || !monthly[plan]) return null;
    return monthly[plan] * BigInt(months);
  },
  isSaasPlanId: (plan: string) => ['starter', 'professional', 'enterprise'].includes(plan),
}));
vi.mock('../../lib/orderStatus.js', () => ({ canTransitionOrder: () => true }));
vi.mock('../compliance/audit.service.js', () => ({
  auditFromReq: m.auditFromReq,
  writeAuditLog: m.writeAuditLog,
}));
vi.mock('../../lib/idempotency.js', () => ({
  reserveIdempotencyKey: m.reserveIdempotencyKey,
  completeIdempotencyKey: m.completeIdempotencyKey,
  deleteIdempotencyKey: m.deleteIdempotencyKey,
}));

import { paymentsRouter } from './payments.routes.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  m.user = { id: 'authenticated-user', role: 'DOCTOR', clinicId: 'clinic-owned' };
  m.reserveIdempotencyKey.mockResolvedValue({ status: 'reserved' });
  m.completeIdempotencyKey.mockResolvedValue(undefined);
  m.deleteIdempotencyKey.mockResolvedValue(undefined);
  m.assertClinicBillingAccess.mockResolvedValue({ role: 'OWNER' });
  m.assertOrgAccess.mockResolvedValue(true);
  m.resolveClinicMemberAccess.mockResolvedValue({ role: 'OWNER' });
  m.orderFindUnique.mockResolvedValue(null);
  m.courseFindUnique.mockResolvedValue({ id: 'course-1', price: 39900, lecturerId: 'lecturer-1', academyId: 'academy-1' });
  m.providerCreate.mockResolvedValue({ externalId: 'gateway-payment-1', qr: 'https://pay.example/qr' });
  m.providerStatus.mockResolvedValue('pending');
  m.getClinicGatewayStatus.mockResolvedValue('pending');
  m.loadClinicPaymentsConfig.mockResolvedValue({
    clinic: { id: 'clinic-owned', name: 'Test Clinic' },
    cfg: { mode: 'static' },
  });
  m.paymentUpdateMany.mockResolvedValue({ count: 1 });
  m.paymentFindUniqueOrThrow.mockResolvedValue({
    id: 'payment-clinic-confirm',
    status: 'paid',
    meta: { qr: 'https://clinic.example/qr' },
  });
  m.transaction.mockImplementation(async (callback: any) => callback({
    payment: {
      updateMany: m.paymentUpdateMany,
      findUniqueOrThrow: m.paymentFindUniqueOrThrow,
    },
  }));
  m.paymentCreate.mockImplementation(async ({ data }: any) => ({
    id: 'payment-created-1',
    ...data,
    createdAt: new Date('2026-10-17T08:00:00Z'),
  }));
  m.auditFromReq.mockResolvedValue(undefined);
});

async function postPayment(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() as any };
}

async function postConfirm(paymentId: string) {
  const response = await fetch(`${baseUrl}/api/payments/${paymentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { response, body: await response.json() as any };
}

describe('payment creation server-side pricing and metadata protection', () => {
  it('rejects a subscription amount below the current server price with 409 before reserving idempotency', async () => {
    const { response, body } = await postPayment({
      amountMinor: '1',
      refType: 'subscription',
      refId: 'clinic-owned',
      meta: { saasPlan: 'professional', months: 1 },
    });
    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(m.reserveIdempotencyKey).not.toHaveBeenCalled();
    expect(m.providerCreate).not.toHaveBeenCalled();
    expect(m.paymentCreate).not.toHaveBeenCalled();
  });

  it('rejects unknown plan ids and out-of-range months instead of trusting client entitlements', async () => {
    const badPlan = await postPayment({
      amountMinor: '3990000', refType: 'subscription', refId: 'clinic-owned',
      meta: { saasPlan: 'network', months: 1 },
    });
    expect(badPlan.response.status).toBe(400);
    const badMonths = await postPayment({
      amountMinor: '99750000', refType: 'subscription', refId: 'clinic-owned',
      meta: { saasPlan: 'professional', months: 25 },
    });
    expect(badMonths.response.status).toBe(400);
    expect(m.providerCreate).not.toHaveBeenCalled();
  });

  it('denies billing a different clinic before creating a provider payment', async () => {
    m.assertClinicBillingAccess.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }));
    const { response } = await postPayment({
      amountMinor: '3990000', refType: 'subscription', refId: 'other-clinic',
      meta: { saasPlan: 'professional', months: 1, clinicId: 'clinic-owned', userId: 'attacker' },
    });
    expect(response.status).toBe(403);
    expect(m.assertClinicBillingAccess).toHaveBeenCalledWith('authenticated-user', 'other-clinic');
    expect(m.providerCreate).not.toHaveBeenCalled();
    expect(m.paymentCreate).not.toHaveBeenCalled();
  });

  it('forces payer, clinic, merchant scope and QR from server data after client metadata', async () => {
    const { response, body } = await postPayment({
      amountMinor: '3990000',
      domain: 'crm',
      refType: 'subscription',
      refId: 'clinic-owned',
      meta: {
        saasPlan: 'professional',
        months: 1,
        userId: 'attacker-user',
        clinicId: 'other-clinic',
        merchantScope: 'clinic',
        clinicPayMode: 'static',
        qr: 'https://attacker.example/fake-qr',
      },
    });
    expect(response.status).toBe(201);
    const saved = m.paymentCreate.mock.calls[0][0].data;
    expect(saved.provider).toBe('kaspi_qr');
    expect(saved.meta.userId).toBe('authenticated-user');
    expect(saved.meta.clinicId).toBe('clinic-owned');
    expect(saved.meta.merchantScope).toBe('platform');
    expect(saved.meta.clinicPayMode).toBeUndefined();
    expect(saved.meta.qr).toBe('https://pay.example/qr');
    expect(m.providerCreate).toHaveBeenCalledWith({ amountMinor: 3_990_000n, refId: 'clinic-owned' });
    expect(body.ok).toBe(true);
  });

  it('rejects enrollment underpayment against the persisted course price', async () => {
    const { response } = await postPayment({
      amountMinor: '1',
      refType: 'enrollment',
      refId: 'course-1',
      meta: { userId: 'attacker-user', courseId: 'another-course' },
    });
    expect(response.status).toBe(409);
    expect(m.providerCreate).not.toHaveBeenCalled();
    expect(m.paymentCreate).not.toHaveBeenCalled();
  });

  it('rejects academy-event underpayment against the persisted course price', async () => {
    const { response } = await postPayment({
      amountMinor: '1',
      refType: 'academy_event',
      refId: 'course-1',
      meta: { userId: 'attacker-user', productId: 'another-course' },
    });
    expect(response.status).toBe(409);
    expect(m.providerCreate).not.toHaveBeenCalled();
    expect(m.paymentCreate).not.toHaveBeenCalled();
  });

  it('allows exact canonical pricing for a subscription and server-priced course payment', async () => {
    const subscription = await postPayment({
      amountMinor: '3990000', refType: 'subscription', refId: 'clinic-owned',
      meta: { saasPlan: 'professional', months: 1 },
    });
    expect(subscription.response.status).toBe(201);
    expect(m.paymentCreate.mock.calls[0][0].data.amount).toBe(3_990_000n);
    vi.clearAllMocks();
    m.reserveIdempotencyKey.mockResolvedValue({ status: 'reserved' });
    m.completeIdempotencyKey.mockResolvedValue(undefined);
    m.courseFindUnique.mockResolvedValue({ id: 'course-1', price: 39900, lecturerId: 'lecturer-1', academyId: 'academy-1' });
    m.providerCreate.mockResolvedValue({ externalId: 'gateway-payment-2', qr: 'https://pay.example/qr2' });
    m.paymentCreate.mockImplementation(async ({ data }: any) => ({ id: 'payment-course', ...data, createdAt: new Date() }));
    const enrollment = await postPayment({ amountMinor: '3990000', refType: 'enrollment', refId: 'course-1', meta: {} });
    expect(enrollment.response.status).toBe(201);
    expect(m.paymentCreate.mock.calls[0][0].data.meta.userId).toBe('authenticated-user');
    expect(enrollment.body.ok).toBe(true);
  });
});


describe('clinic static payment confirmation policy', () => {
  it('does not trust historical client-controlled clinicPayMode when current clinic mode is API', async () => {
    m.paymentFindUnique.mockResolvedValue({
      id: 'payment-api-clinic',
      provider: 'clinic_kaspi',
      externalId: 'clinic-external-1',
      amount: 10_000n,
      status: 'pending',
      refType: 'crm_invoice',
      refId: 'invoice-1',
      meta: {
        clinicId: 'clinic-owned',
        userId: 'authenticated-user',
        merchantScope: 'clinic',
        clinicPayMode: 'static',
      },
    });
    m.loadClinicPaymentsConfig.mockResolvedValue({
      clinic: { id: 'clinic-owned', name: 'Test Clinic' },
      cfg: { mode: 'api', apiBaseUrl: 'https://gateway.example', apiKey: 'redacted' },
    });
    const { response, body } = await postConfirm('payment-api-clinic');
    expect(response.status).toBe(402);
    expect(body.ok).toBe(false);
    expect(m.getClinicGatewayStatus).toHaveBeenCalledWith('clinic-owned', 'clinic-external-1');
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.auditFromReq).not.toHaveBeenCalled();
  });

  it('allows an authorized staff member to confirm current static clinic mode and audits it', async () => {
    m.paymentFindUnique.mockResolvedValue({
      id: 'payment-static-clinic',
      provider: 'clinic_kaspi',
      externalId: 'clinic-external-2',
      amount: 10_000n,
      status: 'pending',
      refType: 'crm_invoice',
      refId: 'invoice-2',
      meta: {
        clinicId: 'clinic-owned',
        userId: 'another-user',
        merchantScope: 'platform',
        clinicPayMode: 'api',
      },
    });
    m.loadClinicPaymentsConfig.mockResolvedValue({
      clinic: { id: 'clinic-owned', name: 'Test Clinic' },
      cfg: { mode: 'static' },
    });
    const { response, body } = await postConfirm('payment-static-clinic');
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.clinicStaffConfirm).toBe(true);
    expect(m.getClinicGatewayStatus).not.toHaveBeenCalled();
    expect(m.transaction).toHaveBeenCalledTimes(1);
    expect(m.auditFromReq).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'payment.confirmed',
        entityId: 'payment-static-clinic',
        details: expect.objectContaining({
          clinicStaffConfirm: true,
          provider: 'clinic_kaspi',
        }),
      }),
    );
  });

  it('rejects static confirmation when the caller has no authorized financial role in the clinic', async () => {
    m.paymentFindUnique.mockResolvedValue({
      id: 'payment-no-clinic-access',
      provider: 'clinic_kaspi',
      externalId: 'clinic-external-3',
      amount: 10_000n,
      status: 'pending',
      refType: 'crm_invoice',
      refId: 'invoice-3',
      meta: { clinicId: 'clinic-owned', clinicPayMode: 'static' },
    });
    m.resolveClinicMemberAccess.mockResolvedValue(null);
    const { response } = await postConfirm('payment-no-clinic-access');
    expect(response.status).toBe(403);
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.loadClinicPaymentsConfig).not.toHaveBeenCalled();
  });
});
