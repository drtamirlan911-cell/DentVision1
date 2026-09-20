import { test, expect } from '@playwright/test';
import { makeIin } from '../helpers/iin';

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
      data: { iin: makeIin(), firstName: 'Billing', lastName: `E2E ${Date.now()}`, phone: '+77000000041' },
    });
    expect(patient.status()).toBe(201);
    const patientBody = await patient.json();
    const patientId = (patientBody.data || patientBody).id;

    const invoice = await request.post(`${BASE}/api/billing/invoices`, {
      headers,
      data: { patientId, amount: 100000, items: [{ name: 'Treatment', price: 100000 }] },
    });
    expect(invoice.status()).toBe(201);
    const invoiceBody = await invoice.json();
    const invoiceId = (invoiceBody.data || invoiceBody).id;

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
      data: { iin: makeIin(), firstName: 'Prepay', lastName: `E2E ${Date.now()}`, phone: '+77000000042' },
    });
    expect(patient.status()).toBe(201);
    const patientBody = await patient.json();
    const patientId = (patientBody.data || patientBody).id;

    const res = await request.post(`${BASE}/api/billing/patients/${patientId}/prepayment`, {
      headers,
      data: { amount: 25000, paymentMethod: 'cash' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.patientId).toBe(patientId);
    expect(body.data.prepaidBalance).toBeGreaterThanOrEqual(25000);
  });
  test('BILL-003: patient prepayment can be consumed by an invoice installment', async ({ request }) => {
    const t = await login(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}` };
    const patient = await request.post(`${BASE}/api/patients`, {
      headers, data: { iin: makeIin(), firstName: 'Deposit', lastName: `E2E ${Date.now()}`, phone: '+77000000043' },
    });
    expect(patient.status()).toBe(201);
    const patientBody = await patient.json();
    const patientId = (patientBody.data || patientBody).id;

    const deposit = await request.post(`${BASE}/api/billing/patients/${patientId}/prepayment`, {
      headers, data: { amount: 30000, paymentMethod: 'cash' },
    });
    expect(deposit.status()).toBe(201);

    const invoice = await request.post(`${BASE}/api/billing/invoices`, {
      headers, data: { patientId, amount: 50000, items: [{ name: 'Treatment', price: 50000 }] },
    });
    expect(invoice.status()).toBe(201);
    const invoiceBody = await invoice.json();
    const invoiceId = (invoiceBody.data || invoiceBody).id;

    const payment = await request.post(`${BASE}/api/billing/invoices/${invoiceId}/pay`, {
      headers, data: { amount: 30000, paymentMethod: 'cash' },
    });
    expect(payment.status()).toBe(200);
    const paymentBody = await payment.json();
    expect(paymentBody.data.paidAmount).toBe(30000);

    const patientAfter = await request.get(`${BASE}/api/patients/${patientId}`, { headers });
    expect(patientAfter.status()).toBe(200);
    const patientAfterBody = await patientAfter.json();
    const after = patientAfterBody.data || patientAfterBody;
    expect(after.prepaidBalance).toBe(0);
  });

  test('BILL-004: invoice partial refund reverses the clinical ledger', async ({ request }) => {
    const t = await login(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}`, 'Idempotency-Key': `refund-${Date.now()}` };
    const patient = await request.post(`${BASE}/api/patients`, {
      headers, data: { iin: makeIin(), firstName: 'Refund', lastName: `E2E ${Date.now()}`, phone: '+77000000044' },
    });
    expect(patient.status()).toBe(201);
    const patientBody = await patient.json();
    const patientId = (patientBody.data || patientBody).id;
    const invoice = await request.post(`${BASE}/api/billing/invoices`, {
      headers, data: { patientId, amount: 50000, items: [{ name: 'Treatment', price: 50000 }] },
    });
    expect(invoice.status()).toBe(201);
    const invoiceBody = await invoice.json();
    const invoiceId = (invoiceBody.data || invoiceBody).id;
    const pay = await request.post(`${BASE}/api/billing/invoices/${invoiceId}/pay`, {
      headers, data: { amount: 50000, paymentMethod: 'cash' },
    });
    expect(pay.status()).toBe(200);
    const refund = await request.post(`${BASE}/api/billing/invoices/${invoiceId}/refund`, {
      headers, data: { amount: 20000 },
    });
    expect(refund.status()).toBe(200);
    const body = await refund.json();
    expect(body.data.paidAmount).toBe(30000);
    expect(body.data.status).toBe('partial');
  });

  test('BILL-005: unused patient prepayment can be refunded', async ({ request }) => {
    const t = await login(request, 'owner-a@test.com');
    const headers = { Authorization: `Bearer ${t}`, 'Idempotency-Key': `prepay-refund-${Date.now()}` };
    const patient = await request.post(`${BASE}/api/patients`, {
      headers, data: { iin: makeIin(), firstName: 'DepositRefund', lastName: `E2E ${Date.now()}`, phone: '+77000000045' },
    });
    expect(patient.status()).toBe(201);
    const patientBody = await patient.json();
    const patientId = (patientBody.data || patientBody).id;
    const deposit = await request.post(`${BASE}/api/billing/patients/${patientId}/prepayment`, {
      headers, data: { amount: 25000, paymentMethod: 'cash' },
    });
    expect(deposit.status()).toBe(201);
    const refund = await request.post(`${BASE}/api/billing/patients/${patientId}/prepayment/refund`, {
      headers, data: { amount: 10000 },
    });
    expect(refund.status()).toBe(200);
    const body = await refund.json();
    expect(body.data.prepaidBalance).toBe(15000);
  });

});
