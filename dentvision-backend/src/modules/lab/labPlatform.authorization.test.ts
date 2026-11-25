import { describe, expect, it } from 'vitest';
import { canLabManageFinance, canLabManageShipment, canLabMemberChangeStatus, canLabMemberReadOrders, isLabManagerRole, isLabQualityRole, isLabTechnicianRole, labMemberOrderReadScope, validateLabQualityControl, validateLabRemakeRequestReason, validateLabRemakeDecision } from './labPlatform.authorization.js';

describe('Dental Lab role boundaries', () => {
  it('allows logistics to read only through the dedicated delivery queue, not the production-assignment scope', () => {
    for (const role of ['courier', 'logistics', 'delivery_operator', 'dispatcher']) {
      expect(canLabMemberReadOrders(role), role).toBe(true);
      expect(labMemberOrderReadScope({ role, userId: 'delivery-1', labId: 'lab-1' }), role).toBeNull();
    }
    expect(canLabMemberReadOrders('lab_finance')).toBe(false);
  });

  it('recognizes only owner-level lab roles as managers', () => {
    expect(isLabManagerRole('owner')).toBe(true);
    expect(isLabManagerRole('admin')).toBe(true);
    expect(isLabManagerRole('manager')).toBe(true);
    expect(isLabManagerRole('technician')).toBe(false);
  });

  it('grants shipment permissions to managers and logistics, not to production or finance roles', () => {
    for (const role of ['owner', 'admin', 'manager', 'director', 'lab_manager', 'courier', 'logistics', 'delivery_operator', 'dispatcher']) {
      expect(canLabManageShipment(role), role).toBe(true);
    }
    for (const role of ['technician', 'dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'qc_specialist', 'lab_finance', 'viewer', 'clinic_owner']) {
      expect(canLabManageShipment(role), role).toBe(false);
    }
    expect(canLabManageShipment(' LOGISTICS ')).toBe(true);
    expect(canLabManageShipment(null)).toBe(false);
  });

  it('keeps shipment permissions separate from QC and price-management authority', () => {
    expect(canLabManageShipment('courier')).toBe(true);
    expect(isLabManagerRole('courier')).toBe(false);
    expect(canLabMemberChangeStatus({ role: 'courier', userId: 'courier-1', nextStatus: 'ready' })).toBe(false);
    expect(canLabManageShipment('lab_finance')).toBe(false);
    expect(isLabManagerRole('lab_finance')).toBe(false);
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

  it('limits coordinators to assigned branches and allows operational coordination only', () => {
    expect(canLabMemberReadOrders('lab_coordinator')).toBe(true);
    expect(labMemberOrderReadScope({ role: 'lab_coordinator', userId: 'coord-1', labId: 'lab-1' })).toBeNull();
    expect(labMemberOrderReadScope({ role: 'lab_coordinator', userId: 'coord-1', labId: 'lab-1', branchIds: ['branch-1', 'branch-2'] })).toEqual({
      AND: [
        { files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' } },
        { patient: { branchId: { in: ['branch-1', 'branch-2'] } } },
      ],
    });
    expect(canLabMemberChangeStatus({ role: 'lab_coordinator', userId: 'coord-1', nextStatus: 'in_progress' })).toBe(true);
    expect(canLabMemberChangeStatus({ role: 'lab_coordinator', userId: 'coord-1', nextStatus: 'delayed' })).toBe(true);
    expect(canLabMemberChangeStatus({ role: 'lab_coordinator', userId: 'coord-1', nextStatus: 'ready' })).toBe(false);
    expect(canLabManageShipment('lab_coordinator')).toBe(false);
    expect(canLabManageFinance('lab_coordinator')).toBe(false);
  });

  it('grants QC specialists full order visibility and the QC capability without manager, shipment or finance powers', () => {
    expect(isLabQualityRole('qc_specialist')).toBe(true);
    expect(canLabMemberReadOrders('qc_specialist')).toBe(true);
    expect(labMemberOrderReadScope({ role: 'qc_specialist', userId: 'qc-1', labId: 'lab-1' })).toEqual({
      files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' },
    });
    expect(isLabManagerRole('qc_specialist')).toBe(false);
    expect(canLabMemberChangeStatus({ role: 'qc_specialist', userId: 'qc-1', nextStatus: 'ready' })).toBe(false);
    expect(canLabManageShipment('qc_specialist')).toBe(false);
    expect(canLabManageFinance('qc_specialist')).toBe(false);
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


describe('Dental Lab finance permissions', () => {
  it('allows management and specifically assigned finance members', () => {
    for (const role of ['owner', 'admin', 'manager', 'director', 'lab_manager', 'lab_finance', 'finance', 'accountant']) {
      expect(canLabManageFinance(role), role).toBe(true);
    }
  });

  it('denies production, logistics, clinic and unknown roles', () => {
    for (const role of ['technician', 'dental_technician', 'cad_designer', 'courier', 'logistics', 'viewer', 'clinic_owner', null]) {
      expect(canLabManageFinance(role), String(role)).toBe(false);
    }
  });
});

describe('Dental Lab clinic remake feedback validation', () => {
  it('requires a meaningful bounded clinic reason', () => {
    expect(validateLabRemakeRequestReason('  ')).toBeNull();
    expect(validateLabRemakeRequestReason('late')).toBeNull();
    expect(validateLabRemakeRequestReason('Край не прилегает')).toBe('Край не прилегает');
    expect(validateLabRemakeRequestReason('x'.repeat(2001))).toBeNull();
  });

  it('accepts a manager decision and requires a reason for rejection', () => {
    expect(validateLabRemakeDecision('accept', '')).toEqual({ decision: 'accept', note: null });
    expect(validateLabRemakeDecision('reject', 'Не соответствует согласованному оттенку')).toEqual({
      decision: 'reject',
      note: 'Не соответствует согласованному оттенку',
    });
    expect(validateLabRemakeDecision('reject', '')).toBeNull();
    expect(validateLabRemakeDecision('other', 'note')).toBeNull();
  });
});
