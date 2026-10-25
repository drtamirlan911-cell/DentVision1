import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorAgent } from './doctor.agent.js';

const mocks = vi.hoisted(() => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    diagnosticCenter: { findMany: vi.fn() },
    treatmentPlan: { create: vi.fn() },
    patientImage: { findMany: vi.fn() },
  },
  publish: vi.fn(),
  uid: vi.fn(() => 'generated-id'),
  decryptField: vi.fn((value: unknown) => value),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mocks.prisma }));
vi.mock('../../../lib/events.js', () => ({ publish: mocks.publish }));
vi.mock('../../../lib/helpers.js', () => ({ uid: mocks.uid }));
vi.mock('../../../lib/phi.js', () => ({ decryptField: mocks.decryptField }));

const clinicContext = { userId: 'doctor-a', clinicId: 'clinic-a' } as any;

describe('DoctorAgent tenant boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.patient.findFirst.mockResolvedValue(null);
    mocks.prisma.patient.findMany.mockResolvedValue([]);
    mocks.prisma.appointment.findFirst.mockResolvedValue(null);
    mocks.prisma.appointment.findMany.mockResolvedValue([]);
    mocks.prisma.appointment.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.appointment.create.mockResolvedValue({ id: 'appointment-created' });
    mocks.prisma.diagnosticCenter.findMany.mockResolvedValue([]);
  });

  it('fails closed when a clinic-scoped intent has no active clinic', async () => {
    const result = await new DoctorAgent().handle(
      { userId: 'doctor-a' } as any,
      'CREATE_ESTIMATE',
      { patientId: 'patient-foreign' },
    );

    expect(result.message).toContain('Активная клиника не определена');
    expect(mocks.prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('scopes patient briefing by both patient and active clinic', async () => {
    const result = await new DoctorAgent().handle(clinicContext, 'PATIENT_BRIEFING', {
      patientId: 'patient-foreign',
    });

    expect(result.message).toContain('Пациент не найден');
    expect(mocks.prisma.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'patient-foreign', clinicId: 'clinic-a' },
    }));
  });

  it.each(['CREATE_ESTIMATE', 'REFER_DIAGNOSTICS', 'SCHEDULE_NEXT_VISIT'] as const)(
    'scopes %s to the active clinic',
    async (intent) => {
      const result = await new DoctorAgent().handle(clinicContext, intent, {
        patientId: 'patient-foreign',
      });

      expect(result.message).toContain('Пациент не найден');
      expect(mocks.prisma.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'patient-foreign', clinicId: 'clinic-a' },
      }));
    },
  );

  it('scopes appointment and patient lookups in patient briefing', async () => {
    const result = await new DoctorAgent().handle(clinicContext, 'PATIENT_BRIEFING', {
      appointmentId: 'appointment-foreign',
      patientId: 'patient-foreign',
    });

    expect(result.message).toContain('Пациент не найден');
    expect(mocks.prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'appointment-foreign', clinicId: 'clinic-a' },
    }));
    expect(mocks.prisma.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'patient-foreign', clinicId: 'clinic-a' },
    }));
  });

  it('does not expose a patient attached to an appointment from a different clinic', async () => {
    mocks.prisma.appointment.findFirst.mockResolvedValue({
      id: 'appointment-a',
      clinicId: 'clinic-a',
      patient: { id: 'patient-b', clinicId: 'clinic-b' },
    });

    const result = await new DoctorAgent().handle(clinicContext, 'PATIENT_BRIEFING', {
      appointmentId: 'appointment-a',
    });

    expect(result.message).toContain('Пациент не найден');
    expect(mocks.prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('does not create an appointment for a patient outside the active clinic', async () => {
    const result = await new DoctorAgent().handle(clinicContext, 'CREATE_APPOINTMENT', {
      patientId: 'patient-foreign',
      date: '2026-10-26T10:00:00.000Z',
      service: 'consultation',
    });

    expect(result.message).toContain('Пациент не найден в активной клинике');
    expect(mocks.prisma.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'patient-foreign', clinicId: 'clinic-a' },
    }));
    expect(mocks.prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('allows appointment creation for a patient in the active clinic', async () => {
    mocks.prisma.patient.findFirst.mockResolvedValue({ id: 'patient-a' });

    const result = await new DoctorAgent().handle(clinicContext, 'CREATE_APPOINTMENT', {
      patientId: 'patient-a',
      date: '2026-10-26T10:00:00.000Z',
      service: 'consultation',
    });

    expect(result.intent).toBe('CREATE_APPOINTMENT');
    expect(mocks.prisma.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clinicId: 'clinic-a', patientId: 'patient-a' }),
    }));
    expect(mocks.publish).toHaveBeenCalledWith('appointment.created', expect.objectContaining({
      clinicId: 'clinic-a', patientId: 'patient-a',
    }));
  });

  it('cannot complete an appointment outside the active clinic or for a different patient', async () => {
    mocks.prisma.patient.findFirst.mockResolvedValue({
      id: 'patient-a', firstName: 'Иван', lastName: 'Иванов',
    });
    mocks.prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

    const result = await new DoctorAgent().handle(clinicContext, 'AFTER_APPOINTMENT', {
      patientId: 'patient-a',
      appointmentId: 'appointment-foreign',
    });

    expect(result.message).toBe('Приём не найден');
    expect(mocks.prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'appointment-foreign', clinicId: 'clinic-a', patientId: 'patient-a' },
      data: { status: 'completed' },
    });
  });

  it('completes only a matching appointment in the active clinic', async () => {
    mocks.prisma.patient.findFirst.mockResolvedValue({
      id: 'patient-a', firstName: 'Иван', lastName: 'Иванов',
    });
    mocks.prisma.appointment.updateMany.mockResolvedValue({ count: 1 });

    const result = await new DoctorAgent().handle(clinicContext, 'AFTER_APPOINTMENT', {
      patientId: 'patient-a',
      appointmentId: 'appointment-a',
    });

    expect(result.intent).toBe('AFTER_APPOINTMENT');
    expect(mocks.prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'appointment-a', clinicId: 'clinic-a', patientId: 'patient-a' },
      data: { status: 'completed' },
    });
  });
});
