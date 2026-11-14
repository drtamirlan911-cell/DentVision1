import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(), schoolEnrollmentFindMany: vi.fn(), appointmentCount: vi.fn(),
  invoiceCount: vi.fn(), clinicMemberCount: vi.fn(), patientCount: vi.fn(),
  clinicFindUnique: vi.fn(), resolveClinicAccess: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    schoolEnrollment: { findMany: mocks.schoolEnrollmentFindMany },
    appointment: { count: mocks.appointmentCount },
    invoice: { count: mocks.invoiceCount },
    clinicMember: { count: mocks.clinicMemberCount },
    patient: { count: mocks.patientCount },
    clinic: { findUnique: mocks.clinicFindUnique },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess: mocks.resolveClinicAccess }));
import { buildDigitalTwin } from './digitalTwin.js';

beforeEach(() => {
  mocks.userFindUnique.mockReset().mockResolvedValue({
    id: 'user-1', firstName: 'Aida', lastName: 'User', email: 'aida@example.test',
    role: 'DOCTOR', spec: 'Терапевт', phone: null, avatar: null, profileMeta: null,
  });
  mocks.schoolEnrollmentFindMany.mockReset().mockResolvedValue([]);
  mocks.appointmentCount.mockReset().mockResolvedValue(0);
  mocks.invoiceCount.mockReset().mockResolvedValue(0);
  mocks.clinicMemberCount.mockReset().mockResolvedValue(0);
  mocks.patientCount.mockReset().mockResolvedValue(0);
  mocks.clinicFindUnique.mockReset().mockResolvedValue(null);
  mocks.resolveClinicAccess.mockReset().mockResolvedValue(null);
});

describe('digital twin active clinic scope', () => {
  it('never infers a clinic from an arbitrary membership when no active clinic is supplied', async () => {
    const twin = await buildDigitalTwin('user-1', null, { isGuest: false });
    expect(twin?.clinic).toBeNull();
    expect(mocks.resolveClinicAccess).not.toHaveBeenCalled();
    expect(mocks.clinicFindUnique).not.toHaveBeenCalled();
  });

  it('uses only the explicitly supplied active clinic', async () => {
    mocks.resolveClinicAccess.mockResolvedValueOnce({ role: 'DOCTOR' });
    mocks.clinicFindUnique.mockResolvedValueOnce({
      id: 'clinic-active', name: 'Active Clinic', city: 'Taraz', plan: 'PRO',
    });
    const twin = await buildDigitalTwin('user-1', 'clinic-active', { isGuest: false });
    expect(twin?.clinic).toEqual(expect.objectContaining({ id: 'clinic-active', name: 'Active Clinic' }));
    expect(mocks.resolveClinicAccess).toHaveBeenCalledWith('user-1', 'clinic-active');
    expect(mocks.clinicFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'clinic-active' } }));
  });
});
