import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * createAppointment/rescheduleAppointment take `doctorId` from the model's
 * tool-call arguments and wrote it straight into the appointment — nothing
 * confirmed it belonged to the clinic the appointment is scoped to. A
 * hallucinated or mis-copied id (any real user id anywhere in the system)
 * would silently attach the appointment to someone with no relationship to
 * this clinic. These tests assert the new `isClinicMember` guard actually
 * blocks that, and that it doesn't get in the way of the ordinary case
 * (doctorId omitted, or unchanged on reschedule).
 */

const { patientFindFirst, appointmentFindFirst, appointmentFindMany, appointmentCreate, appointmentUpdate, isClinicMember } =
  vi.hoisted(() => ({
    patientFindFirst: vi.fn(),
    appointmentFindFirst: vi.fn(),
    appointmentFindMany: vi.fn(),
    appointmentCreate: vi.fn(),
    appointmentUpdate: vi.fn(),
    isClinicMember: vi.fn(),
  }));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    patient: { findFirst: patientFindFirst },
    appointment: {
      findFirst: appointmentFindFirst,
      findMany: appointmentFindMany,
      create: appointmentCreate,
      update: appointmentUpdate,
    },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({ isClinicMember }));

import { TOOLS } from './tools.js';

const ctx = { userId: 'caller-1', clinicId: 'clinic-1', role: 'DOCTOR' };

beforeEach(() => {
  vi.clearAllMocks();
  appointmentFindMany.mockResolvedValue([]);
});

describe('createAppointment — doctorId must belong to the clinic', () => {
  it('rejects a doctorId that is not a member of this clinic', async () => {
    patientFindFirst.mockResolvedValue({ id: 'pat-1', firstName: 'А', lastName: 'Б' });
    isClinicMember.mockResolvedValue(false);

    const result = await TOOLS.createAppointment.execute(
      { patientId: 'pat-1', date: '2026-09-01', time: '10:00', doctorId: 'outsider-doctor', confirmed: true },
      ctx,
    );

    expect(result.ok).toBe(false);
    expect(isClinicMember).toHaveBeenCalledWith('outsider-doctor', 'clinic-1');
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('allows a doctorId that is a member of this clinic', async () => {
    patientFindFirst.mockResolvedValue({ id: 'pat-1', firstName: 'А', lastName: 'Б' });
    isClinicMember.mockResolvedValue(true);
    appointmentCreate.mockResolvedValue({ id: 'appt-1' });

    const result = await TOOLS.createAppointment.execute(
      { patientId: 'pat-1', date: '2026-09-01', time: '10:00', doctorId: 'staff-doctor', confirmed: true },
      ctx,
    );

    expect(result.ok).toBe(true);
    expect(appointmentCreate).toHaveBeenCalledTimes(1);
  });

  it('skips the membership check when doctorId defaults to the caller (already verified by the orchestrator)', async () => {
    patientFindFirst.mockResolvedValue({ id: 'pat-1', firstName: 'А', lastName: 'Б' });
    appointmentCreate.mockResolvedValue({ id: 'appt-1' });

    const result = await TOOLS.createAppointment.execute(
      { patientId: 'pat-1', date: '2026-09-01', time: '10:00', confirmed: true },
      ctx,
    );

    expect(result.ok).toBe(true);
    expect(isClinicMember).not.toHaveBeenCalled();
  });
});

describe('rescheduleAppointment — doctorId must belong to the clinic', () => {
  const existing = {
    id: 'appt-1',
    clinicId: 'clinic-1',
    doctorId: 'original-doctor',
    patientId: 'pat-1',
    duration: 30,
    meta: {},
    patient: { firstName: 'А', lastName: 'Б' },
  };

  it('rejects reassigning to a doctorId outside the clinic', async () => {
    appointmentFindFirst.mockResolvedValue(existing);
    isClinicMember.mockResolvedValue(false);

    const result = await TOOLS.rescheduleAppointment.execute(
      { appointmentId: 'appt-1', date: '2026-09-02', time: '11:00', doctorId: 'outsider-doctor', confirmed: true },
      ctx,
    );

    expect(result.ok).toBe(false);
    expect(appointmentUpdate).not.toHaveBeenCalled();
  });

  it('does not re-check when doctorId is left as the existing one', async () => {
    appointmentFindFirst.mockResolvedValue(existing);
    appointmentUpdate.mockResolvedValue({ id: 'appt-1', patient: {} });

    const result = await TOOLS.rescheduleAppointment.execute(
      { appointmentId: 'appt-1', date: '2026-09-02', time: '11:00', confirmed: true },
      ctx,
    );

    expect(result.ok).toBe(true);
    expect(isClinicMember).not.toHaveBeenCalled();
  });
});
