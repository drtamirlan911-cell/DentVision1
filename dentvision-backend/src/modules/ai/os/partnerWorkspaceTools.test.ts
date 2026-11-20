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
  supplierFindUnique,
  supplierMemberFindUnique,
  personFindFirst,
  productFindMany,
  supplierStatsQuery,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  diagnosticCenterMemberFindFirst: vi.fn(),
  referralCount: vi.fn(),
  referralFindMany: vi.fn(),
  referralGroupBy: vi.fn(),
  laboratoryMemberFindFirst: vi.fn(),
  labOrderCount: vi.fn(),
  labOrderFindMany: vi.fn(),
  supplierFindUnique: vi.fn(),
  supplierMemberFindUnique: vi.fn(),
  personFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  supplierStatsQuery: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    organization: { findUnique: organizationFindUnique },
    diagnosticCenterMember: { findFirst: diagnosticCenterMemberFindFirst },
    referral: { count: referralCount, findMany: referralFindMany, groupBy: referralGroupBy },
    laboratoryMember: { findFirst: laboratoryMemberFindFirst },
    labOrder: { count: labOrderCount, findMany: labOrderFindMany },
    supplier: { findUnique: supplierFindUnique },
    supplierMember: { findUnique: supplierMemberFindUnique },
    person: { findFirst: personFindFirst },
    product: { findMany: productFindMany },
    $queryRawUnsafe: supplierStatsQuery,
  },
}));

import { getDentalLabWorkQueue, getDiagnosticCenterWorkQueue, getMedicalLabReferralQueue, getSupplierInventoryOverview } from './partnerWorkspaceTools.js';

const context = {
  userId: 'tech-1',
  organizationId: 'org-lab-1',
  organizationType: 'LABORATORY',
  organizationOriginalId: 'lab-1',
  role: 'DENTAL_LAB_OWNER',
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
  diagnosticCenterMemberFindFirst.mockResolvedValue({ role: 'admin', center: { id: 'center-1', name: 'Center One', active: true } });
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
  supplierFindUnique.mockResolvedValue({ id: 'supplier-1', name: 'Supplier One', status: 'verified', isActive: true });
  supplierMemberFindUnique.mockResolvedValue({ role: 'owner' });
  personFindFirst.mockResolvedValue({ id: 'supplier-person-1' });
  supplierStatsQuery.mockResolvedValue([{
    totalProducts: 2, activeProducts: 2, lowStockProducts: 1, inactiveProducts: 0,
  }]);
  productFindMany.mockResolvedValue([
    { id: 'product-1', name: 'Alginate', sku: 'ALG-01', category: 'Materials', price: 2500, currency: 'KZT', stock: 4, minStock: 10, isActive: true, updatedAt: new Date('2026-11-20T06:00:00.000Z'), description: 'private product description' },
    { id: 'product-2', name: 'Composite', sku: 'CMP-02', category: 'Materials', price: 9000, currency: 'KZT', stock: 30, minStock: 5, isActive: true, updatedAt: new Date('2026-11-19T06:00:00.000Z'), buyerName: 'Private Buyer' },
  ]);
});

describe('getSupplierInventoryOverview — supplier-only stock visibility', () => {
  const supplierContext = {
    userId: 'supplier-user-1',
    organizationId: 'org-supplier-1',
    organizationType: 'SUPPLIER_COMPANY',
    supplierId: 'supplier-1',
    role: 'SUPPLIER',
  };

  it('returns only the supplier catalogue and stock metrics', async () => {
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-supplier-1', type: 'SUPPLIER_COMPANY', originalType: 'Supplier',
      originalId: 'supplier-1', archivedAt: null,
    });
    supplierMemberFindUnique.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce({ id: 'supplier-person-1' });

    const result = await getSupplierInventoryOverview(supplierContext);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      supplier: { id: 'supplier-1', name: 'Supplier One', status: 'verified' },
      summary: { totalProducts: 2, activeProducts: 2, lowStockProducts: 1, inactiveProducts: 0 },
      returned: 2,
      products: [
        { id: 'product-1', name: 'Alginate', stock: 4, minStock: 10, lowStock: true },
        { id: 'product-2', name: 'Composite', stock: 30, minStock: 5, lowStock: false },
      ],
    });
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { supplierId: 'supplier-1' },
      take: 51,
      select: {
        id: true, name: true, sku: true, category: true, price: true, currency: true,
        stock: true, minStock: true, isActive: true, updatedAt: true,
      },
    }));
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toContain('private product description');
    expect(serialized).not.toContain('Private Buyer');
    expect(serialized).not.toContain('clinic');
    expect(serialized).not.toContain('payout');
  });

  it('rejects mismatched and archived organization links before reading products', async () => {
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-supplier-1', type: 'SUPPLIER_COMPANY', originalType: 'Supplier',
      originalId: 'another-supplier', archivedAt: null,
    });
    const mismatch = await getSupplierInventoryOverview(supplierContext);
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-supplier-1', type: 'SUPPLIER_COMPANY', originalType: 'Supplier',
      originalId: 'supplier-1', archivedAt: new Date(),
    });
    const archived = await getSupplierInventoryOverview(supplierContext);
    const wrongRole = await getSupplierInventoryOverview({ ...supplierContext, role: 'OWNER' });

    expect(mismatch.ok).toBe(false);
    expect(archived.ok).toBe(false);
    expect(wrongRole.ok).toBe(false);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it('requires a current canonical or legacy supplier membership', async () => {
    organizationFindUnique.mockResolvedValueOnce({
      id: 'org-supplier-1', type: 'SUPPLIER_COMPANY', originalType: 'Supplier',
      originalId: 'supplier-1', archivedAt: null,
    });
    supplierMemberFindUnique.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);

    const result = await getSupplierInventoryOverview(supplierContext);

    expect(result.ok).toBe(false);
    expect(productFindMany).not.toHaveBeenCalled();
    expect(supplierStatsQuery).not.toHaveBeenCalled();
  });

  it('supports a verified legacy SupplierMember context when no organization is active', async () => {
    supplierMemberFindUnique.mockResolvedValueOnce({ role: 'owner' });
    const result = await getSupplierInventoryOverview({
      userId: 'supplier-user-1', organizationId: null, organizationType: null,
      supplierId: 'supplier-1', role: 'SUPPLIER',
    });
    expect(result.ok).toBe(true);
  });
});

describe('getDiagnosticCenterWorkQueue — scoped read-only worklist', () => {
  const diagnosticContext = {
    userId: 'diagnostic-owner-1', organizationId: 'org-center-1',
    organizationType: 'DIAGNOSTIC_CENTER', organizationOriginalId: 'center-1',
    role: 'DIAGNOSTIC_OWNER',
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
      role: 'operator', center: { id: 'center-1', name: 'Center One', active: true },
    });
    const branchOperator = await getDiagnosticCenterWorkQueue(diagnosticContext);
    expect(missing.ok).toBe(false);
    expect(branchOperator.ok).toBe(false);
    const wrongScopedRole = await getDiagnosticCenterWorkQueue({
      ...diagnosticContext, role: 'DIAGNOSTIC_MANAGER',
    });
    expect(wrongScopedRole.ok).toBe(false);
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

    const result = await getDentalLabWorkQueue({ ...context, role: 'DENTAL_TECHNICIAN' });

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

  it('rejects branch-scoped managers until a branch filter is available', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce({
      role: 'manager',
      lab: { id: 'lab-1', name: 'DentLab', active: true },
    });
    const result = await getDentalLabWorkQueue({ ...context, role: 'DENTAL_LAB_MANAGER' });
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


const medicalLabContext = {
  userId: 'medical-owner-1',
  organizationId: 'org-med-lab-1',
  organizationType: 'LABORATORY',
  organizationOriginalId: 'medical-lab-1',
  role: 'MEDICAL_LAB_OWNER',
};

const readyMedicalLabOrganization = {
  id: 'org-med-lab-1',
  type: 'LABORATORY',
  originalType: 'Laboratory',
  originalId: 'medical-lab-1',
  archivedAt: null,
  settings: { laboratoryType: 'MEDICAL_LAB', selfServiceType: 'medical_lab' },
};

describe('getMedicalLabReferralQueue — PHI-minimized medical laboratory worklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationFindUnique.mockResolvedValue(readyMedicalLabOrganization);
    laboratoryMemberFindFirst.mockResolvedValue({
      role: 'owner',
      lab: { id: 'medical-lab-1', name: 'Medical Lab One', active: true },
    });
    referralCount.mockResolvedValue(1);
    referralFindMany.mockResolvedValue([{
      id: 'referral-med-1',
      category: 'BLOOD',
      priority: 'URGENT',
      status: 'SENT',
      scheduledDate: new Date('2026-11-21T09:00:00.000Z'),
      createdAt: new Date('2026-11-20T06:00:00.000Z'),
      updatedAt: new Date('2026-11-20T06:30:00.000Z'),
      patientId: 'private-patient-id',
      patientName: 'Private Patient',
      patientIin: '990101123456',
      patientPhone: '+7 777 123 45 67',
      complaints: 'Sensitive complaint',
      preliminaryDx: 'Sensitive diagnosis',
      commentForLab: 'Private instruction',
      result: { reportText: 'Private test result' },
      files: [{ fileUrl: 'https://private.example/file' }],
    }]);
    referralGroupBy.mockResolvedValue([{ status: 'SENT', _count: { _all: 1 } }]);
  });

  it('returns only workflow metadata and does not select patient/clinical fields', async () => {
    const result = await getMedicalLabReferralQueue(medicalLabContext);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      laboratory: { id: 'medical-lab-1', name: 'Medical Lab One' },
      total: 1, returned: 1, hasMore: false, byStatus: { SENT: 1 },
      referrals: [{ id: 'referral-med-1', category: 'BLOOD', priority: 'URGENT', status: 'SENT' }],
    });
    expect(laboratoryMemberFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { labId: 'medical-lab-1', userId: 'medical-owner-1' },
    }));
    expect(referralFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { labId: 'medical-lab-1' },
      take: 51,
      select: {
        id: true, category: true, priority: true, status: true,
        scheduledDate: true, createdAt: true, updatedAt: true,
      },
    }));
    const serialized = JSON.stringify(result.data);
    for (const value of [
      'private-patient-id', 'Private Patient', '990101123456',
      '+7 777 123 45 67', 'Sensitive complaint', 'Sensitive diagnosis',
      'Private instruction', 'Private test result', 'private.example',
    ]) expect(serialized).not.toContain(value);
  });

  it('rejects branch/assigned roles before reading the whole laboratory queue', async () => {
    for (const role of [
      'MEDICAL_LAB_MANAGER', 'MEDICAL_LAB_RECEPTION', 'MEDICAL_LAB_TECHNICIAN',
      'MEDICAL_LAB_VALIDATOR', 'MEDICAL_LAB_DOCTOR', 'MEDICAL_LAB_FINANCE',
    ]) {
      const result = await getMedicalLabReferralQueue({ ...medicalLabContext, role });
      expect(result.ok).toBe(false);
    }
    expect(organizationFindUnique).not.toHaveBeenCalled();
    expect(referralFindMany).not.toHaveBeenCalled();
  });

  it('rejects dental-lab, archived and mismatched organization links', async () => {
    organizationFindUnique.mockResolvedValueOnce({
      ...readyMedicalLabOrganization,
      settings: { laboratoryType: 'DENTAL_LAB', selfServiceType: 'dental_lab' },
    });
    const dentalLab = await getMedicalLabReferralQueue(medicalLabContext);
    organizationFindUnique.mockResolvedValueOnce({ ...readyMedicalLabOrganization, archivedAt: new Date() });
    const archived = await getMedicalLabReferralQueue(medicalLabContext);
    organizationFindUnique.mockResolvedValueOnce({ ...readyMedicalLabOrganization, originalId: 'another-lab' });
    const mismatched = await getMedicalLabReferralQueue(medicalLabContext);
    expect(dentalLab.ok).toBe(false);
    expect(archived.ok).toBe(false);
    expect(mismatched.ok).toBe(false);
    expect(laboratoryMemberFindFirst).not.toHaveBeenCalled();
    expect(referralFindMany).not.toHaveBeenCalled();
  });

  it('rejects absent, inactive or non-organization membership', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce(null);
    const absent = await getMedicalLabReferralQueue(medicalLabContext);
    laboratoryMemberFindFirst.mockResolvedValueOnce({
      role: 'owner', lab: { id: 'medical-lab-1', name: 'Medical Lab One', active: false },
    });
    const inactive = await getMedicalLabReferralQueue(medicalLabContext);
    laboratoryMemberFindFirst.mockResolvedValueOnce({
      role: 'technician',
      lab: { id: 'medical-lab-1', name: 'Medical Lab One', active: true },
    });
    const branchMember = await getMedicalLabReferralQueue(medicalLabContext);
    expect(absent.ok).toBe(false);
    expect(inactive.ok).toBe(false);
    expect(branchMember.ok).toBe(false);
    expect(referralFindMany).not.toHaveBeenCalled();
  });

  it('limits the result to 50 rows and preserves total count', async () => {
    referralCount.mockResolvedValueOnce(51);
    referralFindMany.mockResolvedValueOnce(Array.from({ length: 51 }, (_, index) => ({
      id: 'referral-' + index, category: 'BLOOD', priority: 'NORMAL', status: 'SENT',
      scheduledDate: null, createdAt: new Date('2026-11-20T06:00:00.000Z'), updatedAt: null,
    })));
    const result = await getMedicalLabReferralQueue(medicalLabContext);
    expect(result.ok).toBe(true);
    expect(result.data.returned).toBe(50);
    expect(result.data.total).toBe(51);
    expect(result.data.hasMore).toBe(true);
  });
});
