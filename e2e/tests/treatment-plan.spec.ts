import { test, expect, APIRequestContext } from '@playwright/test';
import { payload as apiPayload } from '../helpers/api';
import { makeIin } from '../helpers/iin';

/**
 * Treatment plans, against the API that exists.
 *
 * The first version of this file addressed `/api/treatment-plans` — a REST
 * resource with GET/PUT/PATCH by id. No such router is mounted and none ever
 * was: `POST /api/treatment-plans` has always been a 404, and TP-001 asserted
 * `toBe(201)` against it with no fallback. Every test here failed on its first
 * request, and nothing reported it, because the suite was never run.
 *
 * What the product actually offers is narrower and shaped differently:
 *
 * | intent            | real route                                   |
 * |-------------------|----------------------------------------------|
 * | create / update   | `POST /api/crm/treatment-plans` (upsert by id)|
 * | read              | `GET /api/crm/:clinicId/treatment-plans` (list)|
 * | delete            | `DELETE /api/crm/treatment-plans/:id`         |
 *
 * There is no read-by-id and no separate status endpoint: a status change is an
 * upsert carrying the new status. So the reads below go through the list and
 * pick the plan out of it — which is also how the CRM screen does it.
 *
 * The field names differ too. `price` is `totalBudget`, and `items` is
 * `stages`, each stage holding priced `items` of its own. Those were not
 * renamed to make tests pass: they are what every reader of a plan — the CRM,
 * the patient portal, the printed plan — has always expected.
 */

const BASE = 'http://localhost:3001';

let ownerToken: string;
let doctorToken: string;
let clinicId: string;
let patientId: string;
let doctorId: string;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await apiPayload(res);
  return body.accessToken;
}

/**
 * The caller's identity and their current clinic.
 *
 * `/me` keeps the clinic on `activeMembership`, not on `user` — a user can
 * belong to several clinics, so "which clinic am I in right now" is a property
 * of the session, not of the person.
 */
async function me(request: APIRequestContext, token: string) {
  const res = await request.get(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await apiPayload(res);
  return { ...(body.user ?? body), clinicId: body.activeMembership?.clinicId };
}

async function createPatient(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE}/api/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { iin: makeIin(), firstName: 'TP', lastName: 'Patient', phone: `+7700${Date.now() % 10_000_000}` },
  });
  const body = await apiPayload(res);
  return body.id;
}

/** One stage holding one priced item — the smallest plan the readers accept. */
function stage(title: string, name: string, price: number) {
  return { title, items: [{ name, price, qty: 1 }] };
}

async function upsertPlan(request: APIRequestContext, token: string, data: Record<string, unknown>) {
  return request.post(`${BASE}/api/crm/treatment-plans`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

/** Read a plan back the only way the API allows: out of the clinic's list. */
async function findPlan(request: APIRequestContext, token: string, planId: string) {
  const res = await request.get(`${BASE}/api/crm/${clinicId}/treatment-plans`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const plans = await apiPayload(res);
  return (plans as Array<{ id: string }>).find((p) => p.id === planId);
}

async function cleanupPlan(request: APIRequestContext, token: string, id: string) {
  await request
    .delete(`${BASE}/api/crm/treatment-plans/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    .catch(() => {});
}

test.describe('Treatment Plan Workflow', () => {
  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, 'owner-a@test.com', 'Test1234!');
    doctorToken = await login(request, 'doctor-a@test.com', 'Test1234!');
    const owner = await me(request, ownerToken);
    clinicId = owner.clinicId;
    expect(clinicId, 'owner-a must be a member of a clinic — check the e2e seed').toBeTruthy();
    patientId = await createPatient(request, ownerToken);
    doctorId = (await me(request, doctorToken)).id;
  });

  test('TP-001: Create treatment plan → 201', async ({ request }) => {
    const res = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Full mouth restoration',
      stages: [stage('Коронки', 'Коронка', 1500), stage('Мост', 'Мостовидный протез', 2000)],
    });
    expect(res.status()).toBe(201);
    const body = await apiPayload(res);
    expect(body).toHaveProperty('id');
    expect(body.title).toBe('Full mouth restoration');
    expect(body.patientId).toBe(patientId);
    // The total is derived from the stages, not taken from the request.
    expect(body.totalBudget).toBe(3500);

    await cleanupPlan(request, ownerToken, body.id);
  });

  test('TP-002: Read treatment plan back → present in the clinic list', async ({ request }) => {
    const createRes = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Root canal plan',
      stages: [stage('Эндодонтия', 'Лечение каналов', 800)],
    });
    const created = await apiPayload(createRes);

    const found = await findPlan(request, ownerToken, created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Root canal plan');

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-003: Update treatment plan → 201 + changes persisted', async ({ request }) => {
    const createRes = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Original plan',
      stages: [stage('Этап', 'Услуга', 1000)],
    });
    const created = await apiPayload(createRes);

    // Update is the same call carrying the id: the route is an upsert.
    const updateRes = await upsertPlan(request, ownerToken, {
      id: created.id,
      patientId,
      title: 'Updated plan',
      stages: [stage('Этап', 'Услуга', 1500)],
    });
    expect(updateRes.status()).toBe(201);
    const updated = await apiPayload(updateRes);
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated plan');
    expect(updated.totalBudget).toBe(1500);

    // And it is one plan, not two.
    const found = await findPlan(request, ownerToken, created.id);
    expect(found!.title).toBe('Updated plan');

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-004: Treatment plan linked to correct patient', async ({ request }) => {
    const res = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Patient link check',
      stages: [stage('Этап', 'Услуга', 500)],
    });
    const created = await apiPayload(res);

    const found = await findPlan(request, ownerToken, created.id);
    expect(found).toBeDefined();
    expect((found as { patientId: string }).patientId).toBe(patientId);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-005: Treatment plan for non-existent patient → 400/404', async ({ request }) => {
    const res = await upsertPlan(request, ownerToken, {
      patientId: 'non-existent-patient-000',
      title: 'Invalid',
      stages: [stage('Этап', 'Услуга', 100)],
    });
    expect([400, 404]).toContain(res.status());
  });

  test('TP-006: Status transitions (proposed→active→completed)', async ({ request }) => {
    const createRes = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Status transition plan',
      stages: [stage('Этап', 'Услуга', 300)],
    });
    const created = await apiPayload(createRes);
    expect(created.status).toBe('proposed');

    const activated = await apiPayload(
      await upsertPlan(request, ownerToken, { id: created.id, patientId, status: 'active' }),
    );
    expect(activated.status).toBe('active');

    const completed = await apiPayload(
      await upsertPlan(request, ownerToken, { id: created.id, patientId, status: 'completed' }),
    );
    expect(completed.status).toBe('completed');

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-007: Stages and their priced items survive a round trip', async ({ request }) => {
    const createRes = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'Implant plan',
      stages: [
        stage('Удаление', 'Extraction', 200),
        stage('Имплантация', 'Implant', 3000),
        stage('Протезирование', 'Crown', 1200),
      ],
    });
    expect(createRes.status()).toBe(201);
    const created = await apiPayload(createRes);

    const found = await findPlan(request, ownerToken, created.id) as {
      stages: Array<{ title: string; items: Array<{ name: string; price: number }> }>;
      totalBudget: number;
    };
    expect(Array.isArray(found.stages)).toBeTruthy();
    expect(found.stages.length).toBe(3);
    expect(found.stages[0].items[0].name).toBe('Extraction');
    expect(found.stages[2].items[0].price).toBe(1200);
    expect(found.totalBudget).toBe(4400);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-008: Delete treatment plan → 200 + gone from the list', async ({ request }) => {
    const createRes = await upsertPlan(request, ownerToken, {
      patientId,
      title: 'To be deleted',
      stages: [stage('Этап', 'Услуга', 100)],
    });
    const created = await apiPayload(createRes);

    const delRes = await request.delete(`${BASE}/api/crm/treatment-plans/${created.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(delRes.status()).toBe(200);

    expect(await findPlan(request, ownerToken, created.id)).toBeUndefined();
  });

  test("TP-009: Another clinic cannot see this clinic's plan", async ({ request }) => {
    const created = await apiPayload(
      await upsertPlan(request, ownerToken, {
        patientId,
        title: 'Clinic A only plan',
        stages: [stage('Этап', 'Услуга', 500)],
      }),
    );

    const otherToken = await login(request, 'owner-b@test.com', 'Test1234!');
    const otherClinic = (await me(request, otherToken)).clinicId;
    expect(otherClinic).not.toBe(clinicId);

    // Asking for clinic A's list with clinic B's token must be refused, not
    // quietly served — and asking for B's own list must not contain A's plan.
    const crossRes = await request.get(`${BASE}/api/crm/${clinicId}/treatment-plans`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect([403, 404]).toContain(crossRes.status());

    const ownRes = await request.get(`${BASE}/api/crm/${otherClinic}/treatment-plans`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(ownRes.status()).toBe(200);
    const theirPlans = (await apiPayload(ownRes)) as Array<{ id: string }>;
    expect(theirPlans.some((p) => p.id === created.id)).toBe(false);

    await cleanupPlan(request, ownerToken, created.id);
  });

  test('TP-010: A doctor of this clinic may write a plan', async ({ request }) => {
    // The permission is `patient.write`, which DOCTOR holds — the plan is a
    // clinical document, so the doctor is the expected author.
    expect(doctorId).toBeTruthy();
    const res = await upsertPlan(request, doctorToken, {
      patientId,
      doctorId,
      title: 'Doctor-authored plan',
      stages: [stage('Этап', 'Услуга', 700)],
    });
    expect(res.status()).toBe(201);
    const created = await apiPayload(res);
    expect(created.doctorId).toBe(doctorId);

    await cleanupPlan(request, ownerToken, created.id);
  });
});
