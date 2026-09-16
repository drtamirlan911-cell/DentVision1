import { test, expect } from '@playwright/test';
import { cleanupTestUser, prisma } from '../helpers/db';

const API = process.env.VITE_API_URL || 'http://localhost:3001';

test.describe('Universal organization self-service onboarding', () => {
  test('creates every supported organization workspace through the backend with a scoped owner role', async ({ request }) => {
    const stamp = Date.now();
    const email = `self-service-org-${stamp}@test.com`;
    const password = 'Test1234!';

    const register = await request.post(`${API}/api/auth/register`, {
      data: {
        email,
        password,
        firstName: 'Self',
        lastName: 'Service',
        role: 'owner',
      },
    });
    expect(register.status()).toBe(201);
    const registered = await register.json();
    const token = registered.data?.accessToken || registered.accessToken;
    expect(token).toBeTruthy();

    const types = [
      'clinic',
      'dental_lab',
      'medical_lab',
      'diagnostic_center',
      'supplier',
      'academy',
    ] as const;

    try {
      for (const type of types) {
        const response = await request.post(`${API}/api/organizations/self-service`, {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            type,
            name: `E2E ${type} ${stamp}`,
            city: 'Astana',
            phone: '+77000000000',
            email,
          },
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
      }
    } finally {
      await cleanupTestUser(email);
    }
  });
});
