import { describe, expect, it, vi } from 'vitest';

const { patientFindFirst, appointmentFindFirst } = vi.hoisted(() => ({
  patientFindFirst: vi.fn(),
  appointmentFindFirst: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    patient: { findFirst: patientFindFirst },
    appointment: { findFirst: appointmentFindFirst },
  },
}));

import { resolveAppointmentForClinic, resolvePatientForClinic } from './patientAccess.js';

describe('AI clinic-scoped access resolvers', () => {
  it('adds clinicId to patient resolution', async () => {
    patientFindFirst.mockResolvedValue({ id: 'p1', clinicId: 'c1' });

    await resolvePatientForClinic('p1', 'c1');

    expect(patientFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', clinicId: 'c1' },
    });
  });

  it('returns null instead of querying when identifiers are missing', async () => {
    expect(await resolvePatientForClinic('', 'c1')).toBeNull();
    expect(await resolveAppointmentForClinic('a1', '')).toBeNull();
    expect(patientFindFirst).not.toHaveBeenCalled();
    expect(appointmentFindFirst).not.toHaveBeenCalled();
  });

  it('adds clinicId to appointment resolution', async () => {
    appointmentFindFirst.mockResolvedValue({ id: 'a1', clinicId: 'c1' });

    await resolveAppointmentForClinic('a1', 'c1');

    expect(appointmentFindFirst).toHaveBeenCalledWith({
      where: { id: 'a1', clinicId: 'c1' },
    });
  });

  it('passes an explicit select projection through to Prisma', async () => {
    patientFindFirst.mockResolvedValue({ id: 'p1' });

    await resolvePatientForClinic('p1', 'c1', { id: true, firstName: true });

    expect(patientFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', clinicId: 'c1' },
      select: { id: true, firstName: true },
    });
  });
});
