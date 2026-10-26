import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('diagnostics public visibility boundary', () => {
  it('requires explicit ecosystemVisible=true for center list/detail paths', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.service.ts'),
      'utf8',
    );

    expect(source).toContain('return (s as any).ecosystemVisible === true;');
    expect(source).toContain('if (settings.ecosystemVisible !== true) return null;');
    expect(source).not.toContain('ecosystemVisible !== false');
  });
});


describe('diagnostic result signing role boundary', () => {
  it('does not grant result signing to partner owner/admin/manager/quality roles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'),
      'utf8',
    );
    const start = source.indexOf("diagnosticsRouter.post('/referrals/:id/results/sign'");
    const end = source.indexOf("diagnosticsRouter.", start + 20);
    const block = source.slice(start, end > start ? end : start + 4000);
    expect(block).toContain("['RADIOLOGIST', 'DIAGNOSTIC_RADIOLOGIST'].includes(actorRole)");
    expect(block).toContain("['MEDICAL_LAB_VALIDATOR', 'MEDICAL_LAB_DOCTOR'].includes(actorRole)");
    // Partner-specific roles map to shared JWT roles such as DOCTOR. Signing must
    // still require an explicit canonical role scoped to the active organization.
    expect(block).toContain("person: { userId: req.user!.id, organizationId: scopedOrganizationId }");
    expect(block).toContain("scopeType: 'organization'");
    expect(block).toContain("scopeId: scopedOrganizationId");
    expect(block).toContain("role: { key: { in: ['radiologist', 'diagnostic_radiologist'] } }");
    expect(block).toContain("role: { key: { in: ['medical_lab_validator', 'medical_lab_doctor'] } }");
    expect(block).not.toContain("actorRole === 'DOCTOR'");;
    expect(block).not.toContain("['SUPERADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(actorRole)");
    expect(block).not.toContain('/_(OWNER|ADMIN|MANAGER|DOCTOR|RADIOLOGIST|TECHNICIAN|VALIDATOR|QUALITY)$/');
  });
});
