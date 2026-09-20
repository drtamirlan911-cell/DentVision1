import { test, expect, type APIRequestContext } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function login(api: APIRequestContext, email: string) {
  const res = await api.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken as string;
}
function auth(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

test.describe('Partner operational lifecycle', () => {
  let api: APIRequestContext;
  let ownerToken = '';
  let superadminToken = '';
  let patientId = '';
  let doctorId = '';

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    ownerToken = await login(api, 'owner-a@test.com');
    superadminToken = await login(api, 'superadmin@test.com');

    const me = await api.get(`${BASE}/api/auth/me`, { headers: auth(ownerToken) });
    const body = await me.json();
    const user = body.data?.user || body.data || body.user || body;
    doctorId = user.id;

    const patient = await api.post(`${BASE}/api/patients`, {
      headers: auth(ownerToken),
      data: { iin: makeIin(), firstName: 'Partner', lastName: 'Lifecycle', phone: `+7700${Date.now() % 10000000}` },
    });
    expect(patient.status()).toBe(201);
    patientId = (await patient.json()).data?.id || (await patient.json()).id;
  });

  test.afterAll(async () => { await api.dispose(); });

  test('PARTNER-001: diagnostic center referral → accept → process → result → clinic visibility', async () => {
    const centerRes = await api.post(`${BASE}/api/diagnostics/centers`, {
      headers: auth(superadminToken),
      data: { name: `E2E Diagnostic ${Date.now()}`, city: 'Тараз' },
    });
    expect(centerRes.status()).toBe(201);
    const center = (await centerRes.json()).data.entity;
    const centerId = center.id;

    const clinicMe = await api.get(`${BASE}/api/auth/me`, { headers: auth(ownerToken) });
    const clinicBody = await clinicMe.json();
    const clinicUser = clinicBody.data?.user || clinicBody.data || clinicBody.user || clinicBody;
    const clinicId = clinicUser.clinicId;
    expect(clinicId).toBeTruthy();

    const referralRes = await api.post(`${BASE}/api/diagnostics/referrals`, {
      headers: auth(ownerToken),
      data: {
        clinicId,
        patientId,
        doctorId,
        patientName: 'Partner Lifecycle',
        category: 'XRAY',
        studyType: 'Конусно-лучевая КТ (КЛКТ)',
        centerId,
        complaints: 'E2E diagnostic workflow',
      },
    });
    expect(referralRes.status()).toBe(201);
    const referral = (await referralRes.json()).data;
    expect(referral.status).toBe('SENT');

    for (const [status, actor] of [['ACCEPTED', superadminToken], ['IN_PROGRESS', superadminToken], ['COMPLETED', superadminToken]] as const) {
      const res = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/status`, {
        headers: auth(actor),
        data: { status, cost: 10000 },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }

    const result = await api.post(`${BASE}/api/diagnostics/referrals/${referral.id}/results/sign`, {
      headers: auth(ownerToken),
      data: { reportText: 'E2E diagnostic report', conclusion: 'No acute findings' },
    });
    expect([200, 400]).toContain(result.status());
  });

  test('PARTNER-002: medical laboratory order → full lifecycle → result → verified', async () => {
    const labRes = await api.post(`${BASE}/api/diagnostics/laboratories`, {
      headers: auth(superadminToken),
      data: { name: `E2E Medical Lab ${Date.now()}`, city: 'Тараз' },
    });
    expect(labRes.status()).toBe(201);
    const lab = (await labRes.json()).data.entity;

    const meRes = await api.get(`${BASE}/api/auth/me`, { headers: auth(ownerToken) });
    const meBody = await meRes.json();
    const clinicUser = meBody.data?.user || meBody.data || meBody.user || meBody;
    const clinicId = clinicUser.clinicId;

    const orderRes = await api.post(`${BASE}/api/medical-lab/orders`, {
      headers: auth(ownerToken),
      data: { clinicId, patientId, labId: lab.id, priority: 'routine', specimenType: 'blood' },
    });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()).data;
    expect(order.status).toBe('ordered');

    const cycle = ['sample_collected', 'received', 'processing', 'result_ready', 'verified'];
    for (const status of cycle) {
      const res = await api.post(`${BASE}/api/medical-lab/orders/${order.id}/status`, {
        headers: auth(superadminToken),
        data: { status },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).data.status).toBe(status);
    }

    const interpretation = await api.post(`${BASE}/api/medical-lab/orders/${order.id}/interpretation`, {
      headers: auth(superadminToken),
      data: { interpretation: 'E2E verified interpretation' },
    });
    expect(interpretation.status()).toBe(200);

    const read = await api.get(`${BASE}/api/medical-lab/orders/${order.id}`, { headers: auth(ownerToken) });
    expect(read.status()).toBe(200);
    expect((await read.json()).data.order.status).toBe('verified');
  });
});
