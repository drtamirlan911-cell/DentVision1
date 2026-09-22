import { test, expect } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const API = process.env.VITE_API_URL || 'http://localhost:3001';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

test.describe('Universal organization self-service onboarding', () => {
  test('creates every supported organization workspace through the backend with a scoped owner role', async ({ request }) => {
    const stamp = Date.now();
    const email = `self-service-org-${stamp}@test.com`;
    const password = 'Test1234!';

    const register = await request.post(`${API}/api/auth/register`, {
      data: { email, password, firstName: 'Self', lastName: 'Service', role: 'owner' },
    });
    expect(register.status()).toBe(201);
    const registered = await register.json();
    let token = registered.data?.accessToken || registered.accessToken;
    let refreshToken = registered.data?.refreshToken || registered.refreshToken;
    expect(token).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const types = ['clinic', 'dental_lab', 'medical_lab', 'diagnostic_center', 'supplier', 'academy'] as const;

    try {
      for (const type of types) {
        const idempotencyKey = `e2e-self-service-${stamp}-${type}`;
        const response = await request.post(`${API}/api/organizations/self-service`, {
          headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey },
          data: { type, name: `E2E ${type} ${stamp}`, city: 'Astana', phone: '+77000000000', email },
        });

        expect(response.status(), `${type} onboarding status`).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.entityId).toBeTruthy();
        expect(body.data.organizationId).toBeTruthy();
        expect(body.data.personId).toBeTruthy();
        expect(body.data.type).toBe(type);
        expect(body.data.verification).toBe('PENDING');
        const createdOrg = await prisma.organization.findUnique({ where: { id: body.data.organizationId }, select: { settings: true, originalId: true } });
        const settings = (createdOrg?.settings && typeof createdOrg.settings === 'object') ? createdOrg.settings as Record<string, unknown> : {};
        expect(settings.lifecycle, `${type} lifecycle`).toBe('PENDING_VERIFICATION');
        expect(settings.ecosystemVisible, `${type} ecosystem visibility`).toBe(false);
        expect((settings.legal as Record<string, unknown>)?.status, `${type} legal status`).toBe('PENDING');
        const expectedNextPath = {
          clinic: '/crm/schedule',
          dental_lab: '/diagnostics/lab',
          medical_lab: '/diagnostics/lab?workspace=medical-lab',
          diagnostic_center: '/diagnostics/center',
          supplier: '/supplier',
          academy: '/school',
        }[type];
        expect(body.data.nextPath, type + ' workspace').toBe(expectedNextPath);

        const retry = await request.post(`${API}/api/organizations/self-service`, {
          headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey },
          data: { type, name: `E2E ${type} ${stamp}`, city: 'Astana', phone: '+77000000000', email },
        });
        expect(retry.status(), `${type} retry status`).toBe(200);
        const retryBody = await retry.json();
        expect(retryBody.ok).toBe(true);
        expect(retryBody.data.idempotent).toBe(true);
        expect(retryBody.data.organizationId).toBe(body.data.organizationId);

        const duplicateCount = await prisma.organization.count({
          where: { id: body.data.organizationId },
        });
        expect(duplicateCount, `${type} idempotency`).toBe(1);

        const scopedOwner = await prisma.personRole.findFirst({
          where: {
            personId: body.data.personId,
            scopeType: 'organization',
            scopeId: body.data.organizationId,
            role: { key: type === 'supplier' ? 'seller' : 'owner' },
          },
          select: { id: true },
        });
        expect(scopedOwner, `${type} must create a scoped owner role`).toBeTruthy();

        token = body.data.accessToken;
        refreshToken = body.data.refreshToken;
        expect(token).toBeTruthy();
        expect(refreshToken).toBeTruthy();

        const refreshed = await request.post(`${API}/api/auth/refresh`, { data: { refreshToken } });
        expect(refreshed.status(), `${type} refresh status`).toBe(200);
        const refreshedBody = await refreshed.json();
        expect(refreshedBody.ok).toBe(true);
        expect(refreshedBody.data?.accessToken).toBeTruthy();
        expect(refreshedBody.data?.refreshToken).toBeTruthy();

        const refreshedPayload = decodeJwtPayload(refreshedBody.data.accessToken);
        expect(refreshedPayload.organizationId, `${type} refresh context`).toBe(body.data.organizationId);
        token = refreshedBody.data.accessToken;
        refreshToken = refreshedBody.data.refreshToken;

        // Critical multi-workspace invariant: after every workspace switch,
        // the AI must resolve the same active organization scope instead of
        // silently falling back to the previous clinic.
        const aiContextResponse = await request.post(`${API}/api/ai/query`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { text: `Confirm the active DentVision workspace for E2E ${type}.` },
        });
        expect(aiContextResponse.status(), `${type} AI context status`).toBe(200);
        const aiBody = await aiContextResponse.json();
        const activeWorkspace = aiBody.data?.activeWorkspace;
        expect(activeWorkspace, `${type} AI active workspace`).toBeTruthy();
        expect(activeWorkspace.scopeId, `${type} AI scope`).toBe(createdOrg?.originalId || body.data.organizationId);
        const expectedScopeType = {
          clinic: 'CLINIC',
          dental_lab: 'LABORATORY',
          medical_lab: 'LABORATORY',
          diagnostic_center: 'DIAGNOSTIC_CENTER',
          supplier: 'SUPPLIER',
          academy: 'ACADEMY',
        }[type];
        expect(activeWorkspace.scopeType, `${type} AI scope type`).toBe(expectedScopeType);
      }
    } finally {
      await cleanupTestUser(email);
    }
  });
});
