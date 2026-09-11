import { describe, expect, it, vi, beforeEach } from 'vitest';

const { clinicFindUnique, clinicMemberCount, clinicMemberFindFirst, appointmentFindMany, appointmentFindFirst, bookingFindMany, bookingFindFirst, bookingCreate, patientFindUnique, releaseFindFirst } = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(), clinicMemberCount: vi.fn(), clinicMemberFindFirst: vi.fn(), appointmentFindMany: vi.fn(), appointmentFindFirst: vi.fn(), bookingFindMany: vi.fn(), bookingFindFirst: vi.fn(), bookingCreate: vi.fn(), patientFindUnique: vi.fn(), releaseFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: {
  clinic: { findUnique: clinicFindUnique },
  clinicMember: { count: clinicMemberCount, findFirst: clinicMemberFindFirst },
  appointment: { findMany: appointmentFindMany, findFirst: appointmentFindFirst },
  booking: { findMany: bookingFindMany, findFirst: bookingFindFirst, create: bookingCreate },
  patient: { findUnique: patientFindUnique },
  treatmentPlanRelease: { findFirst: releaseFindFirst },
} }));

import { getAvailableSlots, requestAppointment, PortalActionError } from './patientPortal.service.js';

const OPEN_CLINIC = { settings: { workStart: '09:00', workEnd: '11:00', bookingSlotMinutes: 30, workDays: [1, 2, 3, 4, 5, 6, 7] } };
const PATIENT = { clinicId: 'clinic-1', firstName: 'А', lastName: 'Б', phone: '+7', email: null };
const baseInput = { patientId: 'patient-1', clinicId: 'clinic-1', date: '2026-08-17', time: '09:30' };

beforeEach(() => vi.clearAllMocks());

describe('getAvailableSlots', () => {
  it('returns no slots on a closed day', async () => {
    clinicFindUnique.mockResolvedValueOnce({ settings: { workDays: [1, 2, 3, 4, 5] } });
    await expect(getAvailableSlots('clinic-1', '2026-08-16')).resolves.toEqual({ date: '2026-08-16', workingDay: false, slots: [] });
  });
  it('removes appointment and pending booking holds', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); clinicMemberCount.mockResolvedValueOnce(1);
    appointmentFindMany.mockResolvedValueOnce([{ time: '09:30', doctorId: 'doc-1' }]); bookingFindMany.mockResolvedValueOnce([{ time: '10:00', doctorId: 'doc-1' }]);
    const result = await getAvailableSlots('clinic-1', '2026-08-17');
    expect(result.slots).toEqual(['09:00']);
  });
  it('throws NOT_FOUND for an unknown clinic', async () => { clinicFindUnique.mockResolvedValueOnce(null); await expect(getAvailableSlots('nope', '2026-08-17')).rejects.toMatchObject({ code: 'NOT_FOUND' }); });
});

describe('requestAppointment', () => {
  it('rejects a time taken between read and write', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce({ id: 'taken' }); bookingFindFirst.mockResolvedValueOnce(null);
    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' }); expect(bookingCreate).not.toHaveBeenCalled();
  });
  it('rejects a time outside schedule', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    await expect(requestAppointment({ ...baseInput, time: '23:45' })).rejects.toMatchObject({ code: 'BAD_STATUS' }); expect(appointmentFindFirst).not.toHaveBeenCalled();
  });
  it('rejects when online booking is disabled', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce({ settings: { ...OPEN_CLINIC.settings, onlineBookingEnabled: false } });
    await expect(requestAppointment(baseInput)).rejects.toMatchObject({ code: 'BAD_STATUS' });
  });
  it('uses only the linked patient record for booking identity', async () => {
    patientFindUnique.mockResolvedValueOnce({ ...PATIENT, firstName: 'Реальное', lastName: 'Имя', phone: '+77001234567' }); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce(null); bookingFindFirst.mockResolvedValueOnce(null); bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });
    await requestAppointment(baseInput);
    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientName: 'Реальное Имя', phone: '+77001234567', source: 'ai-assistant', status: 'pending' }) }));
  });
  it('rejects a doctor outside the clinic', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce(null); bookingFindFirst.mockResolvedValueOnce(null); clinicMemberFindFirst.mockResolvedValueOnce(null);
    await expect(requestAppointment({ ...baseInput, doctorId: 'ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' }); expect(bookingCreate).not.toHaveBeenCalled();
  });
  it('stamps the patient-owned published release', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce(null); bookingFindFirst.mockResolvedValueOnce(null); releaseFindFirst.mockResolvedValueOnce({ id: 'rel-1' }); bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });
    await requestAppointment({ ...baseInput, releaseId: 'rel-1' });
    expect(releaseFindFirst.mock.calls[0][0].where.patientId).toBe('patient-1'); expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ releaseId: 'rel-1' }) }));
  });
  it('drops an unowned releaseId', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce(null); bookingFindFirst.mockResolvedValueOnce(null); releaseFindFirst.mockResolvedValueOnce(null); bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });
    await requestAppointment({ ...baseInput, releaseId: 'other' }); expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ releaseId: null }) }));
  });
  it('leaves releaseId null when absent', async () => {
    patientFindUnique.mockResolvedValueOnce(PATIENT); clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC); appointmentFindFirst.mockResolvedValueOnce(null); bookingFindFirst.mockResolvedValueOnce(null); bookingCreate.mockResolvedValueOnce({ id: 'b1', time: '09:30', status: 'pending' });
    await requestAppointment(baseInput); expect(releaseFindFirst).not.toHaveBeenCalled(); expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ releaseId: null }) }));
  });
});

describe('PortalActionError', () => { it('carries the route/tool code', () => { const err = new PortalActionError('nope', 'BAD_STATUS'); expect(err).toBeInstanceOf(Error); expect(err.code).toBe('BAD_STATUS'); }); });