import { describe, expect, it } from 'vitest';
import { canLabMemberChangeStatus, canLabMemberReadOrders, isLabManagerRole, isLabTechnicianRole, labMemberOrderReadScope, validateLabQualityControl } from './labPlatform.authorization.js';

describe('Dental Lab role boundaries', () => {
  it('recognizes only owner-level lab roles as managers', () => {
    expect(isLabManagerRole('owner')).toBe(true);
    expect(isLabManagerRole('admin')).toBe(true);
    expect(isLabManagerRole('manager')).toBe(true);
    expect(isLabManagerRole('technician')).toBe(false);
  });

  it('allows an assigned technician to progress production but not sign off or deliver', () => {
    const base = { role: 'technician', userId: 'tech-1', assignedTechnicianId: 'tech-1' };
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'in_progress' })).toBe(true);
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'try_in' })).toBe(true);
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'qc' })).toBe(true);
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'ready' })).toBe(false);
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'delivered' })).toBe(false);
    expect(canLabMemberChangeStatus({ ...base, nextStatus: 'remake' })).toBe(false);
  });

  it('denies unassigned technicians and unrelated lab roles', () => {
    expect(canLabMemberChangeStatus({ role: 'technician', userId: 'tech-2', assignedTechnicianId: 'tech-1', nextStatus: 'in_progress' })).toBe(false);
    expect(canLabMemberChangeStatus({ role: 'viewer', userId: 'viewer-1', assignedTechnicianId: 'tech-1', nextStatus: 'in_progress' })).toBe(false);
  });

  it('scopes production reads to assigned orders for technicians and to the lab for managers', () => {
    expect(canLabMemberReadOrders('owner')).toBe(true);
    expect(canLabMemberReadOrders('technician')).toBe(true);
    expect(canLabMemberReadOrders('lab_finance')).toBe(false);
    expect(labMemberOrderReadScope({ role: 'owner', userId: 'owner-1', labId: 'lab-1' })).toEqual({
      files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' },
    });
    expect(labMemberOrderReadScope({ role: 'technician', userId: 'tech-1', labId: 'lab-1' })).toEqual({
      AND: [
        { files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' } },
        { files: { path: ['meta', 'technicianId'], equals: 'tech-1' } },
      ],
    });
    expect(labMemberOrderReadScope({ role: 'viewer', userId: 'viewer-1', labId: 'lab-1' })).toBeNull();
  });

  it('recognizes production-specialist role keys as assigned-work roles', () => {
    for (const role of ['dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician']) {
      expect(isLabTechnicianRole(role)).toBe(true);
    }
    expect(isLabTechnicianRole('qc_specialist')).toBe(false);
  });
});

describe('Dental Lab QC validation', () => {
  const passed = { fit: true, margins: true, shade: true, occlusion: true, surface: true, documentation: true };
  it('requires all six boolean checks and rejects unknown fields', () => {
    expect(validateLabQualityControl({ ...passed, margins: undefined }, 'note')).toBeNull();
    expect(validateLabQualityControl({ ...passed, extra: true }, 'note')).toBeNull();
  });
  it('accepts a complete passing checklist', () => {
    expect(validateLabQualityControl(passed, '')).toMatchObject({ passed: true, note: null });
  });
  it('requires a remark when any check fails', () => {
    expect(validateLabQualityControl({ ...passed, shade: false }, '')).toBeNull();
    expect(validateLabQualityControl({ ...passed, shade: false }, 'Цвет не соответствует')).toMatchObject({ passed: false, note: 'Цвет не соответствует' });
  });
});
