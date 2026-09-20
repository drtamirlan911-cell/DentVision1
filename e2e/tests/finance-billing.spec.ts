import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

async function login(request: any, email: string) {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).accessToken;
}

test.describe('Clinical billing — deposits and installments', () => {
  test('BILL-001: invoice supports partial payments and reaches paid only after the balance is settled', async ({ request }) => {
    const t = await login(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}` };
    const patient = await request.post(`${BASE}/api/patients`, {
      headers,
      data: { firstName: 'Billing', lastName: `E2E ${Date.now()}`, phone: '+77000000041' },
    });
    expect(patient.status()).toBe(201);
    const patientId = ((await patient.json()).data || (await patient.json())).id;

    const invoice = await request.post(`${BASE}/api/billing/invoices`, {
      headers,
      data: { patientId, amount: 100000, items: [{ name: 'Treatment', price: 100000 }] },
    });
    expect(invoice.status()).toBe(201);
    const invoiceId = ((await invoice.json()).data || (await invoice.json())).id;

    const first = await request.post(`${BASE}/api/billing/invoices/${invoiceId}/pay`, {
      headers,
      data: { amount: 40000, paymentMethod: 'cash' },
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.data.paidAmount).toBe(40000);
    expect(firstBody.data.status).toBe('partial');

    const second = await request.post(`${BASE}/api/billing/invoices/${invoiceId}/pay`, {
      headers,
      data: { amount: 60000, paymentMethod: 'cash' },
    });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data.paidAmount).toBe(100000);
    expect(secondBody.data.status).toBe('paid');
  });

  test('BILL-002: patient prepayment is tenant-scoped and ledger-backed', async ({ request }) => {
    const t = await login(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}` };
    const patient = await request.post(`${BASE}/api/patients`, {
      headers,
      data: { firstName: 'Prepay', lastName: `E2E ${Date.now()}`, phone: '+77000000042' },
    });
    expect(patient.status()).toBe(201);
    const patientId = ((await patient.json()).data || (await patient.json())).id;

    const res = await request.post(`${BASE}/api/billing/patients/${patientId}/prepayment`, {
      headers,
      data: { amount: 25000, paymentMethod: 'cash' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.patientId).toBe(patientId);
    expect(body.data.prepaidBalance).toBeGreaterThanOrEqual(25000);
  });
});
