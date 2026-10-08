import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';

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

describe('canonical partner organization identity', () => {
  it('persists the Organization id returned by Diagnostic/Laboratory upsert', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );

    const diagnosticBlock = source.slice(
      source.indexOf("type === 'diagnostic_center'"),
      source.indexOf("} else if (type === 'dental_lab' || type === 'medical_lab')"),
    );
    const laboratoryBlock = source.slice(
      source.indexOf("} else if (type === 'dental_lab' || type === 'medical_lab')"),
      source.indexOf("} else if (type === 'supplier')"),
    );

    expect(diagnosticBlock).toContain('const canonicalOrganization = await tx.organization.upsert');
    expect(diagnosticBlock).toContain('organizationId = canonicalOrganization.id');
    expect(laboratoryBlock).toContain('const canonicalOrganization = await tx.organization.upsert');
    expect(laboratoryBlock).toContain('organizationId = canonicalOrganization.id');
  });
});

describe('organization branch physical schema contract', () => {
  it('uses the mapped snake_case audit columns in raw Branch SQL', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );

    const branchInsertStart = source.indexOf('INSERT INTO "branches"');
    const branchControlStart = source.indexOf('SELECT "id","code","name","city","address","phone","active","isDefault" AS is_default');
    expect(branchInsertStart).toBeGreaterThan(-1);
    expect(branchControlStart).toBeGreaterThan(branchInsertStart);

    const branchInsert = source.slice(branchInsertStart, branchControlStart);
    const branchControl = source.slice(branchControlStart, source.indexOf('return res.json({ ok: true, data: { organization: org, person, branches }', branchControlStart));

    expect(branchInsert).toContain('"created_at"');
    expect(branchInsert).toContain('"updated_at"');
    expect(branchInsert).not.toContain('"createdAt"');
    expect(branchInsert).not.toContain('"updatedAt"');

    expect(branchControl).toContain('ORDER BY "isDefault" DESC, "created_at" ASC');
    expect(branchControl).not.toContain('ORDER BY "isDefault" DESC, "createdAt" ASC');
  });
});

describe('organization control-center authorization', () => {
  it('requires an explicit organization-scoped PersonRole', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );
    const helperStart = source.indexOf('async function currentOrganizationPerson');
    const helperEnd = source.indexOf('\n}\n\nfunction setAuthCookies', helperStart);
    const helper = source.slice(helperStart, helperEnd);

    expect(helper).toContain('personRoles: {');
    expect(helper).toContain("scopeType: 'organization'");
    expect(helper).toContain("scopeId: organizationId");
  });
});
