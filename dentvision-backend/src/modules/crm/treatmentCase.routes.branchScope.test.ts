import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('treatment case branch isolation contract', () => {
  it('filters non-organization roles through authenticated branch assignments', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/crm/treatmentCase.routes.ts'), 'utf8')
    expect(source).toContain('req.user?.branchIds ?? []')
    expect(source).toContain('patient: { branchId: { in: branchIds } }')
    expect(source).toContain('SUPERADMIN')
    expect(source).toContain('OWNER')
    expect(source).toContain('ADMIN')
  })

  it('requires clinical permissions on case reads and writes', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/crm/treatmentCase.routes.ts'), 'utf8')
    expect(source).toContain("treatmentCaseRouter.get('/', loadClinicAccess, requireClinicalChartRead")
    expect(source).toContain("treatmentCaseRouter.get('/:id', loadClinicAccess, requireClinicalChartRead, requirePermission('billing.read')")
    expect(source).toContain("requirePermission('patient.write', 'medical.read', 'medical.write')")
    expect(source).toContain("requirePermission('medical.manage')")
  })

  it('applies branch scope to direct case reads and mutations and checks unlink targets', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/crm/treatmentCase.routes.ts'), 'utf8')
    expect(source).toContain('clinicCase(caseId: string, clinicId: string, req?: AuthRequest)')
    expect(source).toContain('clinicCase(req.params.id, clinicId, req)')
    expect(source).toContain('const patientBranch = branchScopedPatientFilter(req).patient?.branchId')
    expect(source).toContain('await assertLinkTarget(target, recordId, clinicId, existing.patientId)')
    expect(source).toContain('async function setLink(target: LinkTarget, recordId: string, clinicId: string, patientId: string, caseId: string | null): Promise<boolean>')
    expect(source).toContain('AND "clinicId" = $3 AND "patientId" = $4')
    expect(source).toContain('if (!linked) return res.status(404)')
  })
})
