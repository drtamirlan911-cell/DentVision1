import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  clinicFindUnique,
  clinicMemberCount,
  clinicMemberFindFirst,
  appointmentFindMany,
  appointmentFindFirst,
  bookingFindMany,
  bookingFindFirst,
  bookingCreate,
  patientFindUnique,
} = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  clinicMemberCount: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
  appointmentFindMany: vi.fn(),
  appointmentFindFirst: vi.fn(),
  bookingFindMany: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  patientFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: clinicFindUnique },
    clinicMember: { count: clinicMemberCount, findFirst: clinicMemberFindFirst },
    appointment: { findMany: appointmentFindMany, findFirst: appointmentFindFirst },
    booking: { findMany: bookingFindMany, findFirst: bookingFindFirst, create: bookingCreate },
    patient: { findUnique: patientFindUnique },
  },
}));

import { getAvailableSlots, requestAppointment, PortalActionError } from './patientPortal.service.js';

/**
 * The booking path is the one place the assistant can put something on a
 * clinic's calendar, so the tests here are about the two failure modes that
 * matter: showing a time that is not actually free, and writing a request for
 * a time that became taken between the read and the write.
 */

const OPEN_CLINIC = { settings: { workStart: '09:00', workEnd: '11:00', bookingSlotMinutes: 30, workDays: [1, 2, 3, 4, 5, 6, 7] } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAvailableSlots', () => {
  it('returns no slots on a day the clinic is closed', async () => {
    clinicFindUnique.mockResolvedValueOnce({ settings: { workDays: [1, 2, 3, 4, 5] } });
    // 2026-08-16 is a Sunday.
    const result = await getAvailableSlots('clinic-1', '2026-08-16');
    expect(result).toEqual({ date: '2026-08-16', workingDay: false, slots: [] });
  });

  it('removes a time already held by an appointment', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberCount.mockResolvedValueOnce(1);
    appointmentFindMany.mockResolvedValueOnce([{ time: '09:30', doctorId: 'doc-1' }]);
    bookingFindMany.mockResolvedValueOnce([]);

    const result = await getAvailableSlots('clinic-1', '2026-08-17');
    expect(result.workingDay).toBe(true);
    expect(result.slots).toEqual(['09:00', '10:00', '10:30']);
    expect(result.slots).not.toContain('09:30');
  });

  it('removes a time already held by a pending public-widget booking', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    // One doctor total, and that doctor is the one the pending booking holds —
    // an unassigned booking (`doctorId: null`) does not occupy a doctor's slot,
    // which is why this case pins a doctorId rather than leaving it null.
    clinicMemberCount.mockResolvedValueOnce(1);
    appointmentFindMany.mockResolvedValueOnce([]);
    bookingFindMany.mockResolvedValueOnce([{ time: '10:00', doctorId: 'doc-1' }]);

    const result = await getAvailableSlots('clinic-1', '2026-08-17');
    expect(result.slots).not.toContain('10:00');
  });

  it('throws NOT_FOUND for an unknown clinic', async () => {
    clinicFindUnique.mockResolvedValueOnce(null);
    await expect(getAvailableSlots('nope', '2026-08-17')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('requestAppointment', () => {
  const baseInput = { patientId: 'patient-1', clinicId: 'clinic-1', date: '2026-08-17', time: '09:30' };

  it('rejects a time no longer free, even if it was free moments ago', async () => {
    patientFindUnique.mockResolvedValueOnce({ firstName: 'А', lastName: 'Б', phone: '+7', email: null });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    // Somebody else took it between the read and this write.
    appointmentFindFirst.mockResolvedValueOnce({ id: 'taken' });
    bookingFindFirst.mockResolvedValueOnce(null);

    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects a time outside the clinic schedule', async () => {
    patientFindUnique.mockResolvedValueOnce({ firstName: 'А', lastName: 'Б', phone: '+7', email: null });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);

    await expect(requestAppointment({ ...baseInput, time: '23:45' })).rejects.toMatchObject({ code: 'BAD_STATUS' });
    expect(appointmentFindFirst).not.toHaveBeenCalled();
  });

  it('rejects when the clinic has online booking turned off', async () => {
    patientFindUnique.mockResolvedValueOnce({ firstName: 'А', lastName: 'Б', phone: '+7', email: null });
    clinicFindUnique.mockResolvedValueOnce({ settings: { ...OPEN_CLINIC.settings, onlineBookingEnabled: false } });

    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
  });

  it('never trusts a name or phone from the caller — always the linked patient record', async () => {
    patientFindUnique.mockResolvedValueOnce({ firstName: 'Реальное', lastName: 'Имя', phone: '+77001234567', email: null });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });

    await requestAppointment(baseInput);

    expect(bookingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientName: 'Реальное Имя',
          phone: '+77001234567',
          source: 'ai-assistant',
          status: 'pending',
        }),
      }),
    );
  });

  it('throws NOT_FOUND for a doctor id that does not belong to the clinic', async () => {
    patientFindUnique.mockResolvedValueOnce({ firstName: 'А', lastName: 'Б', phone: '+7', email: null });
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    appointmentFindFirst.mockResolvedValueOnce(null);
    bookingFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindFirst.mockResolvedValueOnce(null);

    await expect(requestAppointment({ ...baseInput, doctorId: 'ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(bookingCreate).not.toHaveBeenCalled();
  });
});

describe('PortalActionError', () => {
  it('carries the code the routes and tools switch on', () => {
    const err = new PortalActionError('nope', 'BAD_STATUS');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('BAD_STATUS');
  });
});
