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
        const response = await request.post(`${API}/api/organizations/self-service`, {
          headers: { Authorization: `Bearer ${token}` },
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
      }
    } finally {
      await cleanupTestUser(email);
    }
  });
});
