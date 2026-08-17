import { describe, expect, it, vi, beforeEach } from 'vitest';

const { clinicFindUnique, clinicMemberFindMany, appointmentFindMany, bookingFindMany } = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  bookingFindMany: vi.fn(),
}));

vi.mock('../../../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: clinicFindUnique },
    clinicMember: { findMany: clinicMemberFindMany },
    appointment: { findMany: appointmentFindMany },
    booking: { findMany: bookingFindMany },
  },
}));

import { getAvailableSlots } from './get_slots.tool.js';

/**
 * This function used to return *booked* appointments labelled as available
 * slots — the question inverted. The one thing every test here checks is that
 * a time somebody already holds never appears in the result.
 */

const OPEN_CLINIC = { settings: { workStart: '09:00', workEnd: '11:00', bookingSlotMinutes: 30, workDays: [1, 2, 3, 4, 5, 6, 7] } };
const ONE_DOCTOR = [{ userId: 'doc-1', user: { firstName: 'Аружан', lastName: 'Ким' } }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAvailableSlots', () => {
  it('never returns a time a booked appointment already holds', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValue(ONE_DOCTOR);
    appointmentFindMany.mockResolvedValue([{ time: '09:30', doctorId: 'doc-1' }]);
    bookingFindMany.mockResolvedValue([]);

    const result = await getAvailableSlots({ clinic_id: 'c1', service_name: 'чистка', date: '2026-08-17' });

    const bookedTimes = result.slots.map((s) => s.datetime.slice(11, 16));
    expect(bookedTimes).not.toContain('09:30');
  });

  it('never returns a time a pending public-widget booking already holds', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValue(ONE_DOCTOR);
    appointmentFindMany.mockResolvedValue([]);
    bookingFindMany.mockResolvedValue([{ time: '10:00', doctorId: 'doc-1' }]);

    const result = await getAvailableSlots({ clinic_id: 'c1', service_name: 'чистка', date: '2026-08-17' });

    const bookedTimes = result.slots.map((s) => s.datetime.slice(11, 16));
    expect(bookedTimes).not.toContain('10:00');
  });

  it('returns a real doctor id on every slot, never a placeholder', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValue(ONE_DOCTOR);
    appointmentFindMany.mockResolvedValue([]);
    bookingFindMany.mockResolvedValue([]);

    const result = await getAvailableSlots({ clinic_id: 'c1', service_name: 'чистка', date: '2026-08-17' });

    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(slot.doctorId).toBe('doc-1');
      expect(slot.doctorId).not.toBe('unassigned');
    }
  });

  it('reports no slots, honestly, when every doctor is fully booked', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValue(ONE_DOCTOR);
    // Every slot in the 09:00-11:00 window, 30-minute steps: 09:00, 09:30, 10:00, 10:30.
    appointmentFindMany.mockResolvedValue([
      { time: '09:00', doctorId: 'doc-1' },
      { time: '09:30', doctorId: 'doc-1' },
      { time: '10:00', doctorId: 'doc-1' },
      { time: '10:30', doctorId: 'doc-1' },
    ]);
    bookingFindMany.mockResolvedValue([]);

    const result = await getAvailableSlots({ clinic_id: 'c1', service_name: 'чистка', date: '2026-08-17' });

    expect(result.slots).toEqual([]);
    expect(result.message).toMatch(/не найдено/);
  });

  it('says so when the clinic has no doctors rather than showing invented slots', async () => {
    clinicFindUnique.mockResolvedValueOnce(OPEN_CLINIC);
    clinicMemberFindMany.mockResolvedValue([]);

    const result = await getAvailableSlots({ clinic_id: 'c1', service_name: 'чистка', date: '2026-08-17' });

    expect(result.slots).toEqual([]);
    expect(appointmentFindMany).not.toHaveBeenCalled();
  });

  it('handles an unknown clinic without throwing', async () => {
    clinicFindUnique.mockResolvedValueOnce(null);
    const result = await getAvailableSlots({ clinic_id: 'nope', service_name: 'чистка' });
    expect(result.slots).toEqual([]);
  });
});
