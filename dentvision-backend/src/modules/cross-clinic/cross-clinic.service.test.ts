import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  auditLogCreate, patientFindFirst, patientFindMany, patientFindUnique,
  grantFindUnique, grantCreate, grantUpdate, grantFindMany,
  clinicFindUnique, clinicMemberFindMany, notificationCreate,
  visitFindMany, treatmentPlanFindMany, patientImageFindMany, documentFindMany,
  accessLogCreate, accessLogFindMany,
} = vi.hoisted(() => ({
  auditLogCreate: vi.fn().mockResolvedValue({}),
  patientFindFirst: vi.fn(),
  patientFindMany: vi.fn(),
  patientFindUnique: vi.fn(),
  grantFindUnique: vi.fn(),
  grantCreate: vi.fn().mockResolvedValue({}),
  grantUpdate: vi.fn().mockResolvedValue({}),
  grantFindMany: vi.fn(),
  clinicFindUnique: vi.fn().mockResolvedValue({ id: 'clinic-b', name: 'Clinic B' }),
  clinicMemberFindMany: vi.fn().mockResolvedValue([]),
  notificationCreate: vi.fn().mockResolvedValue({}),
  visitFindMany: vi.fn().mockResolvedValue([]),
  treatmentPlanFindMany: vi.fn().mockResolvedValue([]),
  patientImageFindMany: vi.fn().mockResolvedValue([]),
  documentFindMany: vi.fn().mockResolvedValue([]),
  accessLogCreate: vi.fn().mockResolvedValue({}),
  accessLogFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    patient: { findFirst: patientFindFirst, findMany: patientFindMany, findUnique: patientFindUnique },
    crossClinicAccessGrant: { findUnique: grantFindUnique, create: grantCreate, update: grantUpdate, findMany: grantFindMany },
    crossClinicAccessLog: { create: accessLogCreate, findMany: accessLogFindMany },
    clinic: { findUnique: clinicFindUnique },
    clinicMember: { findMany: clinicMemberFindMany },
    notification: { create: notificationCreate },
    visit: { findMany: visitFindMany },
    treatmentPlan: { findMany: treatmentPlanFindMany },
    patientImage: { findMany: patientImageFindMany },
    document: { findMany: documentFindMany },
    auditLog: { create: auditLogCreate },
  },
}));

vi.mock('../../lib/storage.js', () => ({
  isStorageKey: () => false,
  keyFromStorageUrl: (u: string) => u,
  signedDownloadUrl: vi.fn(),
}));

import { requestAccess, getStatus, getHistory } from './cross-clinic.service.js';

const RECEIVING_CLINIC_ID = 'clinic-b';
const RECEIVING_PATIENT_ID = 'patient-b-1';
const REQUESTED_BY = 'staff-1';

beforeEach(() => {
  vi.clearAllMocks();
  auditLogCreate.mockResolvedValue({});
  grantCreate.mockResolvedValue({});
  grantUpdate.mockResolvedValue({});
  clinicFindUnique.mockResolvedValue({ id: RECEIVING_CLINIC_ID, name: 'Clinic B' });
  clinicMemberFindMany.mockResolvedValue([]);
  notificationCreate.mockResolvedValue({});
});

describe('requestAccess — anti-enumeration', () => {
  it('always audits the attempt, regardless of outcome', async () => {
    patientFindFirst.mockResolvedValueOnce(null);
    await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CROSS_CLINIC_LOOKUP' }),
    }));
  });

  it('returns the same {requested:true} shape when the local patient is missing', async () => {
    patientFindFirst.mockResolvedValueOnce(null);
    const result = await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toEqual({ requested: true });
  });

  it('returns the same shape when the local patient has no IIN', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: null });
    const result = await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toEqual({ requested: true });
  });

  it('returns the same shape when no cross-clinic match is found', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([]);
    const result = await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toEqual({ requested: true });
    expect(grantCreate).not.toHaveBeenCalled();
  });

  it('returns the identical shape when a match IS found and a grant is created', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([{ id: 'patient-a-1', clinicId: 'clinic-a', userId: 'portal-user-1' }]);
    grantFindUnique.mockResolvedValueOnce(null);
    const result = await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toEqual({ requested: true });
    expect(grantCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it('excludes matches from the requesting clinic itself and matches with no portal user', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([]); // clinicId != receivingClinicId and userId != null are enforced in the WHERE
    await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(patientFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: { not: null },
        clinicId: { not: RECEIVING_CLINIC_ID },
      }),
    }));
  });

  it('does not re-notify for an already-PENDING grant on the same pair', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([{ id: 'patient-a-1', clinicId: 'clinic-a', userId: 'portal-user-1' }]);
    grantFindUnique.mockResolvedValueOnce({ id: 'grant-1', status: 'PENDING' });
    await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(grantCreate).not.toHaveBeenCalled();
    expect(grantUpdate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('does not reset a recently DECLINED grant (within the cooldown)', async () => {
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([{ id: 'patient-a-1', clinicId: 'clinic-a', userId: 'portal-user-1' }]);
    grantFindUnique.mockResolvedValueOnce({ id: 'grant-1', status: 'DECLINED', respondedAt: new Date(), revokedAt: null, updatedAt: new Date(), createdAt: new Date() });
    await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(grantUpdate).not.toHaveBeenCalled();
  });

  it('resets a DECLINED grant back to PENDING once the cooldown has passed', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    patientFindFirst.mockResolvedValueOnce({ id: RECEIVING_PATIENT_ID, iin: '123456789012' });
    patientFindMany.mockResolvedValueOnce([{ id: 'patient-a-1', clinicId: 'clinic-a', userId: 'portal-user-1' }]);
    grantFindUnique.mockResolvedValueOnce({ id: 'grant-1', status: 'DECLINED', respondedAt: old, revokedAt: null, updatedAt: old, createdAt: old });
    await requestAccess(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(grantUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'grant-1' },
      data: expect.objectContaining({ status: 'PENDING' }),
    }));
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });
});

describe('getStatus', () => {
  it('returns "none" when there are no grants at all', async () => {
    grantFindMany.mockResolvedValueOnce([]);
    expect(await getStatus(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID)).toBe('none');
  });

  it('returns "approved" when at least one grant is approved, even alongside others', async () => {
    grantFindMany.mockResolvedValueOnce([{ status: 'DECLINED' }, { status: 'APPROVED' }]);
    expect(await getStatus(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID)).toBe('approved');
  });

  it('returns "pending" when none are approved but one is pending', async () => {
    grantFindMany.mockResolvedValueOnce([{ status: 'DECLINED' }, { status: 'PENDING' }]);
    expect(await getStatus(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID)).toBe('pending');
  });

  it('returns "declined" when all grants are declined/revoked', async () => {
    grantFindMany.mockResolvedValueOnce([{ status: 'DECLINED' }]);
    expect(await getStatus(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID)).toBe('declined');
  });
});

describe('getHistory', () => {
  it('excludes billing data by construction — only visits/treatmentPlans/medicalHistory/images/documents are queried, never invoice', async () => {
    grantFindMany.mockResolvedValueOnce([{
      id: 'grant-1', sourceClinicId: 'clinic-a', sourcePatientId: 'patient-a-1',
      receivingClinicId: RECEIVING_CLINIC_ID, receivingPatientId: RECEIVING_PATIENT_ID,
      respondedAt: new Date(),
    }]);
    clinicFindUnique.mockResolvedValueOnce({ id: 'clinic-a', name: 'Clinic A' });
    patientFindUnique.mockResolvedValueOnce({ medicalHistory: { allergies: 'none' } });
    const result = await getHistory(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toHaveLength(1);
    expect(result[0].sourceClinic.name).toBe('Clinic A');
    expect(accessLogCreate).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when there are no approved grants', async () => {
    grantFindMany.mockResolvedValueOnce([]);
    const result = await getHistory(RECEIVING_CLINIC_ID, RECEIVING_PATIENT_ID, REQUESTED_BY);
    expect(result).toEqual([]);
  });
});
