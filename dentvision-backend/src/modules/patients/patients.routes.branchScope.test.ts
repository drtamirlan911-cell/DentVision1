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
    expect(source).toContain('setPatientBranch(patient.id,clinicId,targetBranchId)');
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

  it('does not reveal cross-clinic identity details from an IIN lookup', () => {
    expect(source).not.toContain('clinicId:{not:clinicId}');
    expect(source).not.toContain('suggested:suggested?');
  });
});
