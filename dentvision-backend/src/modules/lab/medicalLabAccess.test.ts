import { describe, expect, it } from 'vitest';
import { medicalLabRoleAllows, medicalLabRolesForWorkspace, selectUniqueMedicalLabMembershipId } from './medicalLabAccess.js';

describe('medical laboratory scoped role capabilities', () => {
  it('allows technicians to record results but not validate or perform quality sign-off', () => {
    const roles = ['medical_lab_technician'];
    expect(medicalLabRoleAllows(roles, 'result.write')).toBe(true);
    expect(medicalLabRoleAllows(roles, 'result.verify')).toBe(false);
    expect(medicalLabRoleAllows(roles, 'quality.perform')).toBe(false);
  });

  it('allows only the validator role to release validated results', () => {
    expect(medicalLabRoleAllows(['medical_lab_validator'], 'result.verify')).toBe(true);
    expect(medicalLabRoleAllows(['medical_lab_owner'], 'result.verify')).toBe(false);
    expect(medicalLabRoleAllows(['medical_lab_admin'], 'result.verify')).toBe(false);
    expect(medicalLabRoleAllows(['medical_lab_doctor'], 'result.verify')).toBe(false);
  });

  it('keeps clinical interpretation separate from bench result entry', () => {
    expect(medicalLabRoleAllows(['medical_lab_doctor'], 'result.interpret')).toBe(true);
    expect(medicalLabRoleAllows(['medical_lab_doctor'], 'result.write')).toBe(false);
    expect(medicalLabRoleAllows(['medical_lab_technician'], 'result.interpret')).toBe(false);
  });

  it('allows quality controllers to perform QC but not alter laboratory results', () => {
    expect(medicalLabRoleAllows(['medical_lab_quality'], 'quality.perform')).toBe(true);
    expect(medicalLabRoleAllows(['medical_lab_quality'], 'result.write')).toBe(false);
    expect(medicalLabRoleAllows(['medical_lab_quality'], 'result.verify')).toBe(false);
  });

  it('allows finance visibility to owner, admin, manager, reception and finance roles only', () => {
    for (const role of ['medical_lab_owner', 'medical_lab_admin', 'medical_lab_manager', 'medical_lab_reception', 'medical_lab_finance']) {
      expect(medicalLabRoleAllows([role], 'finance.read')).toBe(true);
    }
    expect(medicalLabRoleAllows(['medical_lab_owner'], 'finance.manage')).toBe(true);
    expect(medicalLabRoleAllows(['medical_lab_finance'], 'finance.manage')).toBe(true);
    expect(medicalLabRoleAllows(['medical_lab_admin'], 'finance.manage')).toBe(false);
    expect(medicalLabRoleAllows(['medical_lab_manager'], 'finance.manage')).toBe(false);
    for (const role of ['medical_lab_technician', 'medical_lab_validator', 'medical_lab_doctor', 'medical_lab_quality']) {
      expect(medicalLabRoleAllows([role], 'finance.read')).toBe(false);
      expect(medicalLabRoleAllows([role], 'finance.manage')).toBe(false);
    }
  });

  it('supports union of multiple explicit roles in the same organization', () => {
    const roles = ['medical_lab_technician', 'medical_lab_validator'];
    expect(medicalLabRoleAllows(roles, 'result.write')).toBe(true);
    expect(medicalLabRoleAllows(roles, 'result.verify')).toBe(true);
  });

  it('fails closed for generic or unrelated roles', () => {
    expect(medicalLabRoleAllows(['OWNER', 'LAB', 'doctor'], 'result.verify')).toBe(false);
    expect(medicalLabRolesForWorkspace(['MEDICAL_LAB_TECHNICIAN', 'doctor', 'medical_lab_technician']))
      .toEqual(['medical_lab_technician']);
  });
});

describe('medical laboratory membership fallback', () => {
  it('accepts exactly one legacy membership', () => {
    expect(selectUniqueMedicalLabMembershipId([{ labId: 'lab-a' }])).toBe('lab-a');
  });

  it('fails closed when there is no membership or more than one', () => {
    expect(selectUniqueMedicalLabMembershipId([])).toBeNull();
    expect(selectUniqueMedicalLabMembershipId([{ labId: 'lab-a' }, { labId: 'lab-b' }])).toBeNull();
  });

  it('rejects a blank membership identifier', () => {
    expect(selectUniqueMedicalLabMembershipId([{ labId: ' ' }])).toBeNull();
  });
});
