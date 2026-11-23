import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  clinicFindUnique,
  clinicMemberCount,
  clinicMemberFindFirst,
  clinicMemberFindMany,
  organizationFindFirst,
  personFindMany,
  appointmentFindMany,
  appointmentFindFirst,
  bookingFindMany,
  bookingFindFirst,
  bookingCreate,
  patientFindUnique,
  branchFindFirst,
  userFindUnique,
  releaseFindFirst,
  resolveClinicBranchAccess,
} = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  clinicMemberCount: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  appointmentFindFirst: vi.fn(),
  bookingFindMany: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  patientFindUnique: vi.fn(),
  branchFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  releaseFindFirst: vi.fn(),
  resolveClinicBranchAccess: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: {
  clinic: { findUnique: clinicFindUnique },
  clinicMember: { count: clinicMemberCount, findFirst: clinicMemberFindFirst, findMany: clinicMemberFindMany },
  organization: { findFirst: organizationFindFirst },
  person: { findMany: personFindMany },
  appointment: { findMany: appointmentFindMany, findFirst: appointmentFindFirst },
  booking: { findMany: bookingFindMany, findFirst: bookingFindFirst, create: bookingCreate },
  patient: { findUnique: patientFindUnique },
  branch: { findFirst: branchFindFirst },
  user: { findUnique: userFindUnique },
  treatmentPlanRelease: { findFirst: releaseFindFirst },
} }));

vi.mock('../../lib/clinicBranchAccess.js', () => ({ resolveClinicBranchAccess }));

import { getAvailableSlots, requestAppointment, PortalActionError } from './patientPortal.service.js';

const OPEN_CLINIC = {
  settings: {
    workStart: '09:00',
    workEnd: '11:00',
    bookingSlotMinutes: 30,
    workDays: [1, 2, 3, 4, 5, 6, 7],
  },
};
const PATIENT = {
  clinicId: 'clinic-1',
  branchId: 'branch-1',
  firstName: 'А',
  lastName: 'Б',
  phone: '+7',
  email: null,
};
const baseInput = {
  patientId: 'patient-1',
  clinicId: 'clinic-1',
  date: '2026-08-17',
  time: '09:30',
};

beforeEach(() => {
  vi.clearAllMocks();
  branchFindFirst.mockResolvedValue({ id: 'branch-1' });
  organizationFindFirst.mockResolvedValue(null);
  clinicMemberFindMany.mockResolvedValue([{ userId: 'doctor-1', role: 'DOCTOR' }]);
  personFindMany.mockResolvedValue([]);
  resolveClinicBranchAccess.mockResolvedValue({
    roleScope: 'ASSIGNED',
    branchId: 'branch-1',
    allowedBranchIds: ['branch-1'],
  });
  userFindUnique.mockResolvedValue({ firstName: 'Врач', lastName: 'Первый' });
});

describe('getAvailableSlots', () => {
  it('returns no slots on a closed day', async () => {
    clinicFindUnique.mockResolvedValueOnce({ settings: { workDays: [1, 2, 3, 4, 5] } });
    await expect(getAvailableSlots('clinic-1', '2026-08-16')).resolves.toEqual({
      date: '2026-08-16',
      workingDay: false,
      slots: [],
    });
  });

  it('removes occupied appointment/booking holds while retaining capacity for other doctors', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberCount.mockResolvedValueOnce(1);
    appointmentFindMany.mockResolvedValueOnce([{ time: '09:30', doctorId: 'doc-1' }]);
    bookingFindMany.mockResolvedValueOnce([{ time: '10:00', doctorId: 'doc-1' }]);
    const result = await getAvailableSlots('clinic-1', '2026-08-17');
    expect(result.slots).toEqual(['09:00', '10:30']);
  });

  it('filters available slots and occupancy holds to the patient branch', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindMany.mockResolvedValueOnce([]);
    bookingFindMany.mockResolvedValueOnce([]);

    await getAvailableSlots('clinic-1', '2026-08-17', null, 'branch-1');

    expect(appointmentFindMany.mock.calls[0][0].where).toMatchObject({ branchId: 'branch-1' });
    expect(bookingFindMany.mock.calls[0][0].where).toMatchObject({ branchId: 'branch-1' });
    expect(clinicMemberFindMany.mock.calls[0][0].where).toMatchObject({
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      role: { in: ['DOCTOR', 'OWNER'] },
    });
  });

  it('validates a requested doctor against active membership in the patient branch', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValueOnce([{ userId: 'doctor-1', role: 'DOCTOR' }]);
    appointmentFindMany.mockResolvedValueOnce([]);
    bookingFindMany.mockResolvedValueOnce([]);

    await getAvailableSlots('clinic-1', '2026-08-17', 'doctor-1', 'branch-1');

    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      role: 'DOCTOR',
      requestedBranchId: 'branch-1',
    });
  });

  it('returns no slots when the selected branch has no bookable clinicians', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValueOnce([]);
    appointmentFindMany.mockResolvedValueOnce([]);
    bookingFindMany.mockResolvedValueOnce([]);

    await expect(getAvailableSlots('clinic-1', '2026-08-17', null, 'branch-1')).resolves.toEqual({
      date: '2026-08-17',
      workingDay: true,
      slots: [],
    });
  });

  it('throws NOT_FOUND for an unknown clinic', async () => {
    clinicFindUnique.mockResolvedValueOnce(null);
    await expect(getAvailableSlots('nope', '2026-08-17')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('requestAppointment', () => {
  it('rejects a time taken between read and write', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce({ id: 'taken' });
    bookingFindFirst.mockResolvedValueOnce(null);

    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects a time outside schedule', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);

    await expect(requestAppointment({ ...baseInput, time: '23:45' })).rejects.toMatchObject({ code: 'BAD_STATUS' });
    expect(appointmentFindFirst).not.toHaveBeenCalled();
  });

  it('rejects when online booking is disabled', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce({
      settings: { ...OPEN_CLINIC.settings, onlineBookingEnabled: false },
    });

    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
  });

  it('rejects patient cards without an assigned active branch', async () => {
    patientFindUnique.mockResolvedValueOnce({ ...PATIENT, branchId: null });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);

    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
    expect(appointmentFindFirst).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('uses only the linked patient record and stores its immutable branch on the booking', async () => {
    patientFindUnique.mockResolvedValueOnce({
      ...PATIENT,
      firstName: 'Реальное',
      lastName: 'Имя',
      phone: '+77001234567',
    });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment(baseInput);

    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        patientName: 'Реальное Имя',
        phone: '+77001234567',
        branchId: 'branch-1',
        source: 'ai-assistant',
        status: 'pending',
      }),
    }));
  });

  it('filters slot conflicts to the patient branch', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment(baseInput);

    expect(appointmentFindFirst.mock.calls[0][0].where).toMatchObject({ branchId: 'branch-1' });
    expect(bookingFindFirst.mock.calls[0][0].where).toMatchObject({ branchId: 'branch-1' });
  });

  it('rejects a doctor who is not assigned to the patient branch', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    resolveClinicBranchAccess.mockResolvedValueOnce(null);

    await expect(requestAppointment({ ...baseInput, doctorId: 'ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('accepts an active doctor in the patient branch and stores their verified branch', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment({ ...baseInput, doctorId: 'doctor-1' });

    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      role: 'DOCTOR',
      requestedBranchId: 'branch-1',
    });
    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ doctorId: 'doctor-1', branchId: 'branch-1' }),
    }));
  });

  it('stamps the patient-owned published release', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    releaseFindFirst.mockResolvedValueOnce({ id: 'rel-1' });
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment({ ...baseInput, releaseId: 'rel-1' });

    expect(releaseFindFirst.mock.calls[0][0].where.patientId).toBe('patient-1');
    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ releaseId: 'rel-1' }),
    }));
  });

  it('drops an unowned releaseId', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    releaseFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment({ ...baseInput, releaseId: 'other' });

    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ releaseId: null }),
    }));
  });

  it('leaves releaseId null when absent', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT);
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment(baseInput);

    expect(releaseFindFirst).not.toHaveBeenCalled();
    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ releaseId: null }),
    }));
  });
});

describe('PortalActionError', () => {
  it('carries the route/tool code', () => {
    const err = new PortalActionError('nope', 'BAD_STATUS');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('BAD_STATUS');
  });
});
