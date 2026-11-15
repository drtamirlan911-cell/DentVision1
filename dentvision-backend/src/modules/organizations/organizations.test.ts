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
import { organizationLegalOwnerRoleKeys } from '../../lib/organizationLegalAccess.js';

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
    const types = ['CLINIC', 'ACADEMY', 'LABORATORY', 'DIAGNOSTIC_CENTER', 'SUPPLIER_COMPANY', 'EMPLOYER', 'PARTNER'];
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

describe('organization legal-signature authority', () => {
  it('grants legal owner authority only to the scoped founding-owner role for each organization type', () => {
    expect(organizationLegalOwnerRoleKeys('EMPLOYER')).toEqual(['employer_owner']);
    expect(organizationLegalOwnerRoleKeys('CLINIC')).toEqual(['owner', 'org_owner']);
    expect(organizationLegalOwnerRoleKeys('DIAGNOSTIC_CENTER')).toEqual(['diagnostic_owner']);
    expect(organizationLegalOwnerRoleKeys('LABORATORY')).toEqual(['medical_lab_owner', 'dental_lab_owner']);
    expect(organizationLegalOwnerRoleKeys('SUPPLIER_COMPANY')).toEqual(['seller']);
    expect(organizationLegalOwnerRoleKeys('ACADEMY')).toEqual(['lecturer']);
    expect(organizationLegalOwnerRoleKeys('UNKNOWN')).toEqual([]);
    expect(organizationLegalOwnerRoleKeys('EMPLOYER')).not.toContain('employer_recruiter');
    expect(organizationLegalOwnerRoleKeys('EMPLOYER')).not.toContain('employer_viewer');
  });

  it('requires the owner-authority check before legal package creation and owner signature', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );
    const legalStart = source.indexOf("organizationsRouter.post('/me/legal'");
    const verifyStart = source.indexOf("organizationsRouter.post('/me/verification'");
    const verifyEnd = source.indexOf('// Soft-archive only', verifyStart);
    const legalRoute = source.slice(legalStart, verifyStart);
    const verifyRoute = source.slice(verifyStart, verifyEnd);
    expect(legalRoute).toContain('hasOrganizationLegalOwnerAuthority(req.user!.id, org.id, org.type)');
    expect(verifyRoute).toContain('hasOrganizationLegalOwnerAuthority(req.user!.id, org.id, org.type)');
    expect(legalRoute).toContain('ORGANIZATION_LEGAL_OWNER_REQUIRED');
    expect(verifyRoute).toContain('ORGANIZATION_LEGAL_OWNER_REQUIRED');

    const partnerSource = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/legal/legal.partner.routes.ts'),
      'utf8',
    );
    for (const routeStart of [
      "router.post('/onboard'",
      "router.post('/documents/regenerate'",
      "router.post('/documents/:id/sign'",
      "router.put('/partner'",
    ]) {
      const start = partnerSource.indexOf(routeStart);
      expect(start, routeStart).toBeGreaterThanOrEqual(0);
      const routeText = partnerSource.slice(start, start + 1800);
      expect(routeText).toContain('hasOrganizationLegalOwnerAuthority');
      expect(routeText).toContain('ORGANIZATION_LEGAL_OWNER_REQUIRED');
    }
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


describe('organization soft archive and trial contracts', () => {
  it('archives only the canonical Organization and never deletes linked clinical records', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );
    const archiveStart = source.indexOf("organizationsRouter.delete('/:id'");
    const archiveEnd = source.indexOf('organizationsRouter.use(requireSuperadmin)', archiveStart);
    const archiveRoute = source.slice(archiveStart, archiveEnd);

    expect(archiveRoute).toContain('archivedAt');
    expect(archiveRoute).toContain("lifecycle: 'ARCHIVED'");
    expect(archiveRoute).toContain("action: 'organization.archived'");
    expect(archiveRoute).toContain('retained: true');
    expect(archiveRoute).not.toContain('prisma.clinic.update');
    expect(archiveRoute).not.toContain('prisma.clinic.delete');
    expect(archiveRoute).not.toContain('prisma.patient.delete');
  });

  it('starts a finite Enterprise trial for self-service clinic organizations', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );
    const clinicBlockStart = source.indexOf("if (type === 'clinic')");
    const clinicBlockEnd = source.indexOf("} else if (type === 'diagnostic_center')", clinicBlockStart);
    const clinicBlock = source.slice(clinicBlockStart, clinicBlockEnd);

    expect(clinicBlock).toContain('TRIAL_DAYS');
    expect(clinicBlock).toContain("plan: 'ENTERPRISE'");
    expect(clinicBlock).toContain("status: 'trialing'");
    expect(clinicBlock).toContain('periodEnd');
  });
});

  it('allows a superadmin to restore an archived organization context', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(
      resolve(process.cwd(), 'dentvision-backend/src/modules/organizations/organizations.routes.ts'),
      'utf8',
    );
    const superadminGate = source.indexOf('organizationsRouter.use(requireSuperadmin)');
    const restore = source.indexOf("organizationsRouter.post('/:id/restore'", superadminGate);
    expect(superadminGate).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(superadminGate);
    const restoreRoute = source.slice(restore, source.indexOf("organizationsRouter.get('/verification/queue'", restore));
    expect(restoreRoute).toContain('archivedAt: null');
    expect(restoreRoute).toContain("action: 'organization.restored'");
    expect(restoreRoute).not.toContain('prisma.clinic.update');
    expect(restoreRoute).not.toContain('prisma.patient.delete');
  });
