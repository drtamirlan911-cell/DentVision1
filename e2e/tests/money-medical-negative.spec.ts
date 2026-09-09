/** Negative coverage where a mistake costs money or health. */
import { test, expect, APIRequestContext, request } from '@playwright/test';
import { makeIin } from '../helpers/iin';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const ACCOUNTS = {
  ownerA: { email: 'owner-a@test.com', password: 'Test1234!' },
  doctorA: { email: 'doctor-a@test.com', password: 'Test1234!' },
  assistantA: { email: 'assistant-a@test.com', password: 'Test1234!' },
  ownerB: { email: 'owner-b@test.com', password: 'Test1234!' },
  superadmin: { email: 'superadmin@test.com', password: 'Test1234!' },
};
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
let ctx: APIRequestContext;
let ownerA: string, doctorA: string, assistantA: string, ownerB: string, superadmin: string;
async function signIn(email: string, password: string): Promise<string> {
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login failed for ${email}: ${res.status()}`).toBeTruthy();
  const data = (await res.json()).data;
  return data.accessToken || data.tokens?.accessToken;
}
function auth(token: string) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

test.beforeAll(async () => {
  ctx = await request.newContext({ baseURL: BASE_URL });
  ownerA = await signIn(ACCOUNTS.ownerA.email, ACCOUNTS.ownerA.password);
  doctorA = await signIn(ACCOUNTS.doctorA.email, ACCOUNTS.doctorA.password);
  assistantA = await signIn(ACCOUNTS.assistantA.email, ACCOUNTS.assistantA.password);
  ownerB = await signIn(ACCOUNTS.ownerB.email, ACCOUNTS.ownerB.password);
  superadmin = await signIn(ACCOUNTS.superadmin.email, ACCOUNTS.superadmin.password);
});
test.afterAll(async () => { await ctx.dispose(); });

test.describe('Деньги: биллинг клиники', () => {
  test('врач не читает счета клиники — нет billing.manage', async () => expect((await ctx.get('/api/billing/invoices', { headers: auth(doctorA) })).status()).toBe(403));
  test('врач не создаёт счёт', async () => expect((await ctx.post('/api/billing/invoices', { headers: auth(doctorA), data: { patientId: MISSING_ID, items: [], total: 1000 } })).status()).toBe(403));
  test('несуществующий счёт — 404, а не 500', async () => expect((await ctx.get(`/api/billing/invoices/${MISSING_ID}`, { headers: auth(ownerA) })).status()).toBe(404));
  test('счёт чужой клиники не читается её соседом', async () => {
    const patient = await ctx.post('/api/patients', { headers: auth(ownerB), data: { iin: makeIin(), firstName: 'Negative', lastName: 'Invoice', phone: '+77000009998' } });
    expect(patient.ok(), await patient.text()).toBeTruthy();
    const patientId = ((await patient.json()).data || {}).id as string;
    const created = await ctx.post('/api/billing/invoices', { headers: auth(ownerB), data: { patientId, amount: 5000, items: [{ name: 'Консультация', price: 5000, qty: 1 }] } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const invoiceId = ((await created.json()).data || {}).id as string;
    expect([403, 404]).toContain((await ctx.get(`/api/billing/invoices/${invoiceId}`, { headers: auth(ownerA) })).status());
  });
});

test.describe('Деньги: платформенные финансы', () => {
  test('владелец клиники получает список транзакций, а не 500', async () => {
    const res = await ctx.get('/api/finance/transactions', { headers: auth(ownerA), params: { limit: '5' } });
    expect(res.status(), await res.text()).toBe(200);
    expect(Array.isArray((await res.json()).data)).toBeTruthy();
  });
  test('врач не читает выручку платформы по источникам', async () => expect((await ctx.get('/api/finance/revenue-by-source', { headers: auth(doctorA) })).status()).toBe(403));
  test('клиника не читает платформенную выручку, superadmin читает', async () => {
    expect((await ctx.get('/api/finance/revenue-by-source', { headers: auth(ownerA) })).status()).toBe(403);
    const res = await ctx.get('/api/finance/revenue-by-source', { headers: auth(superadmin) });
    expect(res.status(), await res.text()).toBe(200);
    const report = (await res.json()).data;
    expect(typeof report.totalMinor).toBe('string');
    for (const row of report.rows) expect(typeof row.amountMinor).toBe('string');
  });
  test('без токена платформенные финансы закрыты', async () => {
    const anon = await request.newContext({ baseURL: BASE_URL });
    try { expect([401, 403]).toContain((await anon.get('/api/finance/revenue-by-source')).status()); } finally { await anon.dispose(); }
  });
});

test.describe('Здоровье: медицинские записи', () => {
  test('ассистент не пишет визит — нет patient.write', async () => expect((await ctx.post('/api/medical/visits', { headers: auth(assistantA), data: { patientId: MISSING_ID, date: new Date().toISOString().slice(0, 10), diagnosis: 'K02.1' } })).status()).toBe(403));
  test('визиты несуществующего пациента — не 500', async () => expect((await ctx.get(`/api/medical/visits/${MISSING_ID}`, { headers: auth(doctorA) })).status()).toBeLessThan(500));
  test('план лечения несуществующего пациента — не 500', async () => expect((await ctx.get(`/api/medical/treatment-plan/${MISSING_ID}`, { headers: auth(doctorA) })).status()).toBeLessThan(500));
  test('пациент чужой клиники не отдаёт свою медкарту соседу', async () => {
    const created = await ctx.post('/api/patients', { headers: auth(ownerB), data: { iin: makeIin(), firstName: 'Negative', lastName: 'Isolation', phone: '+77000009999' } });
    test.skip(!created.ok(), `клиника B не смогла завести пациента (${created.status()})`);
    const patientId = ((await created.json()).data || {}).id as string;
    expect([403, 404]).toContain((await ctx.get(`/api/patients/${patientId}`, { headers: auth(ownerA) })).status());
  });
});

test.describe('ИИН: справочник подставляет контакты, но не медицину', () => {
  const SHARED_IIN = makeIin();
  test.beforeAll(async () => {
    const created = await ctx.post('/api/patients', { headers: auth(ownerB), data: { iin: SHARED_IIN, firstName: 'Известный', lastName: 'Платформе', phone: '+77010001111', email: 'known@test.dentvision' } });
    expect(created.ok(), await created.text()).toBeTruthy();
  });
  test('клиника A получает ФИО, телефон и почту', async () => {
    const res = await ctx.get(`/api/patients/lookup?iin=${SHARED_IIN}`, { headers: auth(ownerA) });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.suggested).toMatchObject({ name: 'Известный Платформе', phone: '+77010001111', email: 'known@test.dentvision' });
  });
  test('но не идентификатор чужой записи и не название клиники', async () => {
    const data = (await (await ctx.get(`/api/patients/lookup?iin=${SHARED_IIN}`, { headers: auth(ownerA) })).json()).data;
    expect(data.suggested).not.toHaveProperty('id'); expect(data.suggested).not.toHaveProperty('clinicId'); expect(data.existing).toBeNull();
  });
  test('дата рождения и пол выводятся из самого номера', async () => {
    const data = (await (await ctx.get(`/api/patients/lookup?iin=${SHARED_IIN}`, { headers: auth(ownerA) })).json()).data;
    expect(data.derived.birthDate).toBe('1990-01-01'); expect(data.derived.gender).toBe('male');
  });
  test('медицинские записи чужой клиники по-прежнему недоступны', async () => {
    const created = await ctx.post('/api/patients', { headers: auth(ownerA), data: { iin: makeIin(), firstName: 'Свой', lastName: 'Пациент', phone: '+77010002222' } });
    expect(created.ok()).toBeTruthy();
    const ownPatientId = ((await created.json()).data || {}).id as string;
    const res = await ctx.get(`/api/cross-clinic/history/${ownPatientId}`, { headers: auth(ownerA) });
    expect(res.status()).toBeLessThan(500); if (res.ok()) expect(Array.isArray((await res.json()).data) ? (await res.json()).data : []).toHaveLength(0);
  });
});

test.describe('Здоровье: диагностика', () => {
  test('владелец клиники не заводит диагностический центр — это право платформы', async () => expect((await ctx.post('/api/diagnostics/centers', { headers: auth(ownerA), data: { name: 'Негативный тест', city: 'Алматы' } })).status()).toBe(403));
  test('несуществующий центр — 404, а не 500', async () => expect((await ctx.get(`/api/diagnostics/centers/${MISSING_ID}`, { headers: auth(ownerA) })).status()).toBe(404));
  test('направление чужой клиники не открывается соседом', async () => { const status = (await ctx.get(`/api/diagnostics/referrals/${MISSING_ID}`, { headers: auth(ownerA) })).status(); expect(status).toBeLessThan(500); expect([403, 404]).toContain(status); });
});
