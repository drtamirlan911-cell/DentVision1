import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  clinicMemberFindMany,
  appointmentFindMany,
  appointmentFindFirst,
  appointmentCreate,
  patientFindFirst,
  patientCreate,
  sessionUpdate,
} = vi.hoisted(() => ({
  clinicMemberFindMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  appointmentFindFirst: vi.fn(),
  appointmentCreate: vi.fn(),
  patientFindFirst: vi.fn(),
  patientCreate: vi.fn(),
  sessionUpdate: vi.fn(),
}));

vi.mock('../../../../lib/prisma.js', () => ({
  default: {
    clinicMember: { findMany: clinicMemberFindMany },
    appointment: { findMany: appointmentFindMany, findFirst: appointmentFindFirst, create: appointmentCreate },
    patient: { findFirst: patientFindFirst, create: patientCreate },
    aiAdminSession: { update: sessionUpdate },
  },
}));

import { bookAppointment } from './book_appointment.tool.js';

/**
 * This is the entire safety boundary for the WhatsApp/Instagram booking
 * channel: there is no human review step before the appointment lands on the
 * calendar as `confirmed`. Two bugs lived here — no conflict check, and a
 * literal `'unassigned'` string standing in for a doctor id that the schema
 * requires to be a real user. Both are what these tests pin down.
 */

const SESSION = { id: 'session-1', channel: 'whatsapp' } as any;
const BASE_ARGS = {
  clinic_id: 'c1',
  patient_name: 'Асель Ким',
  patient_phone: '+77001234567',
  slot_datetime: '2026-08-17T09:30:00.000Z',
  service_name: 'чистка',
};

beforeEach(() => {
  vi.clearAllMocks();
  patientFindFirst.mockResolvedValue({ id: 'patient-1' });
  sessionUpdate.mockResolvedValue({});
});

describe('bookAppointment', () => {
  it('refuses when the requested slot is already taken, rather than double-booking', async () => {
    clinicMemberFindMany.mockResolvedValue([{ userId: 'doc-1' }]);
    appointmentFindMany.mockResolvedValueOnce([]); // resolveDoctorId's busy-check
    appointmentFindFirst.mockResolvedValueOnce({ id: 'already-there' }); // write-time re-check

    const result = await bookAppointment({ ...BASE_ARGS, doctor_id: 'doc-1' }, SESSION);

    expect(result.success).toBe(false);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('never writes the literal string "unassigned" as a doctor id', async () => {
    clinicMemberFindMany.mockResolvedValue([{ userId: 'doc-1' }]);
    appointmentFindMany.mockResolvedValueOnce([]);
    appointmentFindFirst.mockResolvedValueOnce(null);
    appointmentCreate.mockResolvedValueOnce({});

    // No doctor_id supplied — the case that used to fall back to 'unassigned'.
    const result = await bookAppointment(BASE_ARGS, SESSION);

    expect(result.success).toBe(true);
    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ doctorId: 'doc-1' }) }),
    );
  });

  it('reports failure instead of creating an appointment with no real doctor available', async () => {
    // Nobody free at all: no member matches, or everyone is busy.
    clinicMemberFindMany.mockResolvedValue([]);

    const result = await bookAppointment(BASE_ARGS, SESSION);

    expect(result.success).toBe(false);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('does not use a requested doctor who is busy at that time — picks someone else free instead', async () => {
    clinicMemberFindMany
      // resolveDoctorId's own member lookup, scoped to the requested doctor
      .mockResolvedValueOnce([{ userId: 'doc-1' }]);
    appointmentFindMany.mockResolvedValueOnce([{ doctorId: 'doc-1' }]); // doc-1 is busy
    // No free member among the (single, busy) candidate set.
    appointmentFindFirst.mockResolvedValueOnce(null);

    const result = await bookAppointment({ ...BASE_ARGS, doctor_id: 'doc-1' }, SESSION);

    expect(result.success).toBe(false);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });

  it('creates a real patient record on first contact and reuses it on repeat bookings', async () => {
    clinicMemberFindMany.mockResolvedValue([{ userId: 'doc-1' }]);
    appointmentFindMany.mockResolvedValueOnce([]);
    appointmentFindFirst.mockResolvedValueOnce(null);
    appointmentCreate.mockResolvedValueOnce({});
    patientFindFirst.mockResolvedValueOnce(null);
    patientCreate.mockResolvedValueOnce({ id: 'new-patient' });

    const result = await bookAppointment(BASE_ARGS, SESSION);

    expect(result.success).toBe(true);
    expect(patientCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: BASE_ARGS.patient_phone }) }),
    );
    expect(appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ patientId: 'new-patient' }) }),
    );
  });

  it('fails closed on an unparseable datetime rather than creating a garbage appointment', async () => {
    const result = await bookAppointment({ ...BASE_ARGS, slot_datetime: 'not-a-date' }, SESSION);
    expect(result.success).toBe(false);
    expect(appointmentCreate).not.toHaveBeenCalled();
  });
});
