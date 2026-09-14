import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/modules/patients/patients.routes.ts'), 'utf8');

describe('patients route branch scope contract', () => {
  it('uses the shared patient branch resolver', () => {
    expect(source).toContain("from '../../lib/patientBranchScope.js'");
    expect(source).toContain('resolvePatientBranchContext');
    expect(source).toContain('getPatientIdsForBranchScope');
  });

  it('filters patient lists by branch at query construction time', () => {
    expect(source).toContain('const where=await scopedPatientWhere(req,clinicId,whereBase);');
    expect(source).toContain('prisma.patient.findMany({where,');
    expect(source).toContain('prisma.patient.count({where})');
  });

  it('checks the branch before direct patient access and mutations', () => {
    expect(source).toContain('loadClinicPatient(req,res)');
    expect(source).toContain('canAccessPatientBranch(context,patientBranchId)');
    expect(source).toContain('setPatientBranch(patient.id,clinicId,targetBranchId)');
  });
});