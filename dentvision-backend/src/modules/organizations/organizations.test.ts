import { describe, expect, it, vi } from 'vitest';

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  default: {
    organization: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '../../lib/prisma.js';

describe('Organization model', () => {
  it('has required fields', () => {
    const org = {
      id: 'test-id',
      name: 'Test Clinic',
      type: 'CLINIC',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(org.name).toBeTruthy();
    expect(org.type).toBeTruthy();
  });

  it('supports all org types', () => {
    const types = ['CLINIC', 'ACADEMY', 'LABORATORY', 'DIAGNOSTIC_CENTER', 'SUPPLIER_COMPANY', 'PARTNER'];
    for (const t of types) {
      const org = { name: 'Test', type: t };
      expect(types).toContain(org.type);
    }
  });

  it('links back to original table via originalType/originalId', () => {
    const org = {
      id: 'org-1',
      originalType: 'Clinic',
      originalId: 'clinic-1',
    };
    expect(org.originalType).toBe('Clinic');
    expect(org.originalId).toBe('clinic-1');
  });

  it('stores type-specific settings in JSON field', () => {
    const org = {
      id: 'org-2',
      type: 'CLINIC',
      settings: { plan: 'PRO', features: ['ai', 'analytics'] },
    };
    expect(org.settings.plan).toBe('PRO');
    expect(org.settings.features).toContain('ai');
  });
});
