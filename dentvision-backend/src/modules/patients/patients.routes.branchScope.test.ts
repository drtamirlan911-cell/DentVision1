import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/patients/patients.routes.ts'), 'utf8');

describe('patients route branch scope contract', () => {
  it('uses the shared patient branch resolver', () => {
    expect(source).toContain("from '../../lib/patientBranchScope.js'");
    expect(source).toContain('resolvePatientBranchContext');
    expect(source).toContain('getPatientIdsForBranchScope');
  });
  it('filters patient lists by branch at query construction time', () => {
    expect(source).toContain('scopedPatientWhere');
    expect(source).toContain('prisma.patient.findMany');
    expect(source).toContain('prisma.patient.count');
  });
  it('checks the branch before direct patient access and mutations', () => {
    expect(source).toContain('loadClinicPatient(req,res)');
    expect(source).toContain('canAccessPatientBranch(context,patientBranchId)');
    expect(source).toMatch(/setPatientBranch\s*\(\s*patient\.id\s*,\s*clinicId\s*,\s*targetBranchId\s*\)/);
  });

  it('requires patient permission and returns a minimized list payload', () => {
    expect(source).toContain("patientsRouter.get('/', requirePermission('patient.read')");
    expect(source).toContain('serializePatientList(patient, canReadBilling)');
    expect(source).toContain("patientsRouter.get('/:id',requireClinicalChartRead");
  });

  it('guards clinical record, audit and balance operations by their own permission', () => {
    expect(source).toContain("patientsRouter.get('/:id/history',requireClinicalChartRead");
    expect(source).toContain("patientsRouter.get('/:id/images',requireClinicalChartRead");
    expect(source).toContain("patientsRouter.get('/:id/treatment-plan',requireClinicalChartRead");
    expect(source).toContain("patientsRouter.get('/:id/audit',requireClinicalChartRead,requirePermission('audit.read')");
    expect(source).toContain("patientsRouter.post('/:id/deposit',requirePermission('billing.write')");
    expect(source).toContain("patientsRouter.get('/:id/summary',requireClinicalChartRead,requirePermission('billing.read')");
  });

  it('keeps IIN lookup inside the active clinic and never reveals cross-clinic identity', () => {
    const lookupStart = source.indexOf("patientsRouter.get('/lookup'");
    const summaryStart = source.indexOf("patientsRouter.get('/:id/summary'", lookupStart);
    const lookupRoute = source.slice(lookupStart, summaryStart);
    expect(lookupRoute).toContain('scopedPatientWhere');
    expect(lookupRoute).toContain('auditFromReq');
    expect(lookupRoute).not.toContain('clinicId:{not:clinicId}');
    expect(lookupRoute).not.toContain('suggested');
  });

  it('requires medical read/write for patient mutation responses and clinical payloads', () => {
    expect(source).toContain('function requirePatientMutationPermission');
    expect(source).toContain("requirePermission('patient.write', 'medical.read', 'medical.write')");
    expect(source).toContain("patientsRouter.patch('/:id',requirePatientMutationPermission");
    expect(source).toContain("patientsRouter.post('/', requirePatientMutationPermission");
  });

  it('omits prepaid balance from full patient responses without effective billing permission', () => {
    expect(source).toContain('function serializePatient(p: any, includeBilling = true)');
    expect(source).toContain('async function serializePatientForCaller(p: any, req: AuthRequest)');
    expect(source).toContain("return serializePatient(p, includeBilling)");
    expect(source).toContain('data:await serializePatientForCaller(p,req)');
  });


  it('uses optimistic concurrency for PATCH and commits chart/branch writes with the patient row', () => {
    const patchStart = source.indexOf("patientsRouter.patch('/:id'");
    const deleteStart = source.indexOf("patientsRouter.delete('/:id'", patchStart);
    const patchRoute = source.slice(patchStart, deleteStart);
    expect(patchStart).toBeGreaterThanOrEqual(0);
    expect(deleteStart).toBeGreaterThan(patchStart);
    expect(patchRoute).toContain('await prisma.$transaction(async (tx) =>');
    expect(patchRoute).toContain('tx.patient.updateMany');
    expect(patchRoute).toContain('updatedAt: existing.updatedAt');
    expect(patchRoute).toContain("throw new Error('PATIENT_HISTORY_CONFLICT')");
    expect(patchRoute).toContain('syncTeeth(existing.id, body.teeth, tx)');
    expect(patchRoute).toContain('setPatientBranch(existing.id, clinicId, targetBranchId, tx)');
    expect(patchRoute).toContain('res.status(409)');
    expect(patchRoute).not.toContain('prisma.patient.update(');
    expect(patchRoute.indexOf('assertPatientBranchBelongsToClinic')).toBeGreaterThanOrEqual(0);
    expect(patchRoute.indexOf('assertPatientBranchBelongsToClinic')).toBeLessThan(patchRoute.indexOf('prisma.$transaction'));
  });

  it('uses atomic integer increments for patient deposits', () => {
    const depositStart = source.indexOf("patientsRouter.post('/:id/deposit'");
    const assignmentsStart = source.indexOf('async function serializeAssignments', depositStart);
    const depositRoute = source.slice(depositStart, assignmentsStart);
    expect(depositRoute).toContain('Number.isSafeInteger(amount)');
    expect(depositRoute).toContain('prepaidBalance: { increment: amount }');
    expect(depositRoute).toContain('previousBalance = next - amount');
    expect(depositRoute).not.toContain('prisma.patient.findFirst');
    expect(depositRoute).not.toContain('prepaidBalance: next');
  });

  it('rejects zero, negative and non-finite patient deposits at the API boundary', () => {
    expect(source).toContain('Number.isSafeInteger(amount)');
    expect(source).toContain("requirePermission('billing.write')");
  });
});
