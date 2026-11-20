import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  organizationFindUnique,
  diagnosticCenterMemberFindFirst,
  referralCount,
  referralFindMany,
  referralGroupBy,
  laboratoryMemberFindFirst,
  labOrderCount,
  labOrderFindMany,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  diagnosticCenterMemberFindFirst: vi.fn(),
  referralCount: vi.fn(),
  referralFindMany: vi.fn(),
  referralGroupBy: vi.fn(),
  laboratoryMemberFindFirst: vi.fn(),
  labOrderCount: vi.fn(),
  labOrderFindMany: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findUnique: organizationFindUnique },
    diagnosticCenterMember: { findFirst: diagnosticCenterMemberFindFirst },
    referral: { count: referralCount, findMany: referralFindMany, groupBy: referralGroupBy },
    laboratoryMember: { findFirst: laboratoryMemberFindFirst },
    labOrder: { count: labOrderCount, findMany: labOrderFindMany },
  },
}));

import { getDentalLabWorkQueue, getDiagnosticCenterWorkQueue } from './partnerWorkspaceTools.js';

const context = {
  userId: 'tech-1',
  organizationId: 'org-lab-1',
  organizationType: 'LABORATORY',
  organizationOriginalId: 'lab-1',
};

const readyOrganization = {
  id: 'org-lab-1',
  type: 'LABORATORY',
  originalType: 'Laboratory',
  originalId: 'lab-1',
  archivedAt: null,
  settings: {
    laboratoryType: 'DENTAL_LAB',
    selfServiceType: 'dental_lab',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  organizationFindUnique.mockResolvedValue(readyOrganization);
  diagnosticCenterMemberFindFirst.mockResolvedValue({ role: 'radiologist', center: { id: 'center-1', name: 'Center One', active: true } });
  referralCount.mockResolvedValue(1);
  referralFindMany.mockResolvedValue([{
    id: 'referral-1', category: 'CBCT', studyType: 'КТ челюсти', priority: 'URGENT', status: 'IN_PROGRESS',
    scheduledDate: new Date('2026-11-21T09:00:00.000Z'), createdAt: new Date('2026-11-20T06:00:00.000Z'), updatedAt: new Date('2026-11-20T06:30:00.000Z'),
    patientName: 'Private Patient', complaints: 'Sensitive complaint', preliminaryDx: 'Sensitive diagnosis',
  }]);
  referralGroupBy.mockResolvedValue([{ status: 'IN_PROGRESS', _count: { _all: 1 } }]);
  laboratoryMemberFindFirst.mockResolvedValue({
    role: 'owner',
    lab: { id: 'lab-1', name: 'DentLab', active: true },
  });
  labOrderCount.mockResolvedValue(1);
  labOrderFindMany.mockResolvedValue([{
    id: 'order-1',
    type: 'E-max crown',
    status: 'in_progress',
    deadline: new Date('2026-12-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-20T06:00:00.000Z'),
    files: { meta: { laboratoryId: 'lab-1', technicianId: 'tech-1', material: 'E-max', patientName: 'Private Patient' } },
    patientId: 'patient-private',
    notes: 'Sensitive medical notes must never leave the query result',
    clinicId: 'clinic-1',
  }]);
});

describe('getDiagnosticCenterWorkQueue — scoped read-only worklist', () => {
  const diagnosticContext = {
    userId: 'radiologist-1', organizationId: 'org-center-1',
    organizationType: 'DIAGNOSTIC_CENTER', organizationOriginalId: 'center-1',
  };

  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({
      id: 'org-center-1', type: 'DIAGNOSTIC_CENTER', originalType: 'DiagnosticCenter',
      originalId: 'center-1', archivedAt: null,
    });
  });

  it('returns bounded operational metadata without patient or clinical details', async () => {
    const result = await getDiagnosticCenterWorkQueue(diagnosticContext);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      center: { id: 'center-1', name: 'Center One' },
      total: 1, returned: 1, byStatus: { IN_PROGRESS: 1 },
      referrals: [{ id: 'referral-1', category: 'CBCT', studyType: 'КТ челюсти', priority: 'URGENT', status: 'IN_PROGRESS' }],
    });
    expect(referralFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { centerId: 'center-1' }, take: 51,
      select: { id: true, category: true, studyType: true, priority: true, status: true, scheduledDate: true, createdAt: true, updatedAt: true },
    }));
    const serialized = JSON.stringify(result.data);
    for (const privateValue of ['Private Patient', 'Sensitive complaint', 'Sensitive diagnosis']) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('rejects wrong workspace or mismatched organization link', async () => {
    const wrongType = await getDiagnosticCenterWorkQueue({ ...diagnosticContext, organizationType: 'CLINIC' });
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-center-1', type: 'DIAGNOSTIC_CENTER', originalType: 'DiagnosticCenter',
      originalId: 'another-center', archivedAt: null,
    });
    const wrongLink = await getDiagnosticCenterWorkQueue(diagnosticContext);
    expect(wrongType.ok).toBe(false);
    expect(wrongLink.ok).toBe(false);
    expect(diagnosticCenterMemberFindFirst).not.toHaveBeenCalled();
    expect(referralFindMany).not.toHaveBeenCalled();
  });

  it('rejects missing or non-worklist membership', async () => {
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce(null);
    const missing = await getDiagnosticCenterWorkQueue(diagnosticContext);
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce({
      role: 'finance', center: { id: 'center-1', name: 'Center One', active: true },
    });
    const finance = await getDiagnosticCenterWorkQueue(diagnosticContext);
    expect(missing.ok).toBe(false);
    expect(finance.ok).toBe(false);
    expect(referralFindMany).not.toHaveBeenCalled();
  });
});

describe('getDentalLabWorkQueue — organization isolation', () => {
  it('returns manager production metadata for the verified laboratory only', async () => {
    const result = await getDentalLabWorkQueue({ ...context, userId: 'owner-1' });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      laboratory: { id: 'lab-1', name: 'DentLab' },
      visibility: 'laboratory_queue',
      total: 1,
      returned: 1,
      orders: [{ id: 'order-1', type: 'E-max crown', status: 'in_progress', material: 'E-max' }],
    });
    expect(labOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' } },
    }));
    const query = labOrderFindMany.mock.calls[0][0];
    expect(query.select).toEqual({
      id: true,
      type: true,
      status: true,
      deadline: true,
      updatedAt: true,
      files: true,
    });
    expect(query.select).not.toHaveProperty('patientId');
    expect(query.select).not.toHaveProperty('clinicId');
    expect(query.select).not.toHaveProperty('notes');
    const serialized = JSON.stringify(result.data);
    for (const privateValue of ['Private Patient', 'patient-private', 'medical notes', 'clinic-1']) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('restricts a technician query to that technician assigned work', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce({
      role: 'technician',
      lab: { id: 'lab-1', name: 'DentLab', active: true },
    });

    const result = await getDentalLabWorkQueue(context);

    expect(result.ok).toBe(true);
    expect(result.data?.visibility).toBe('assigned_to_me');
    expect(labOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { files: { path: ['meta', 'laboratoryId'], equals: 'lab-1' } },
          { files: { path: ['meta', 'technicianId'], equals: 'tech-1' } },
        ],
      },
    }));
  });

  it('fails closed for a clinic or medical-lab workspace', async () => {
    const clinic = await getDentalLabWorkQueue({ ...context, organizationType: 'CLINIC' });
    organizationFindUnique.mockResolvedValueOnce({
      ...readyOrganization,
      id: 'org-med-lab',
      originalId: 'medical-lab-1',
      settings: { laboratoryType: 'MEDICAL_LAB', selfServiceType: 'medical_lab' },
    });
    const medicalLab = await getDentalLabWorkQueue({
      ...context,
      organizationId: 'org-med-lab',
      organizationOriginalId: 'medical-lab-1',
    });

    expect(clinic.ok).toBe(false);
    expect(medicalLab.ok).toBe(false);
    expect(organizationFindUnique).toHaveBeenCalledTimes(1);
    expect(laboratoryMemberFindFirst).not.toHaveBeenCalled();
  });

  it('rejects archived or mismatched organization links', async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...readyOrganization, archivedAt: new Date() });
    const result = await getDentalLabWorkQueue(context);

    expect(result.ok).toBe(false);
    expect(laboratoryMemberFindFirst).not.toHaveBeenCalled();
    expect(labOrderFindMany).not.toHaveBeenCalled();
  });

  it('rejects an organization whose original Laboratory id does not match the verified link', async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...readyOrganization, originalId: 'other-lab' });
    const result = await getDentalLabWorkQueue(context);

    expect(result.ok).toBe(false);
    expect(laboratoryMemberFindFirst).not.toHaveBeenCalled();
    expect(labOrderFindMany).not.toHaveBeenCalled();
  });

  it('rejects a user who is not an active laboratory member', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce(null);
    const result = await getDentalLabWorkQueue(context);

    expect(result.ok).toBe(false);
    expect(labOrderFindMany).not.toHaveBeenCalled();
  });

  it('rejects a finance or other non-production laboratory role', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce({
      role: 'lab_finance',
      lab: { id: 'lab-1', name: 'DentLab', active: true },
    });
    const result = await getDentalLabWorkQueue(context);

    expect(result.ok).toBe(false);
    expect(labOrderFindMany).not.toHaveBeenCalled();
  });

  it('bounds the returned queue and marks truncation', async () => {
    labOrderCount.mockResolvedValueOnce(120);
    labOrderFindMany.mockResolvedValueOnce(Array.from({ length: 51 }, (_, i) => ({
      id: `order-${i}`,
      type: 'crown',
      status: 'pending',
      deadline: null,
      updatedAt: new Date(),
      files: { meta: { laboratoryId: 'lab-1' } },
    })));

    const result = await getDentalLabWorkQueue(context);

    expect(result.data?.orders).toHaveLength(50);
    expect(result.data?.hasMore).toBe(true);
    expect(result.data?.total).toBe(120);
    expect(labOrderFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });
});
