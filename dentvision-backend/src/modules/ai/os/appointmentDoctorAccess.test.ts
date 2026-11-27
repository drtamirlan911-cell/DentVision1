import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicBranchAccess, resolveClinicAccess } = vi.hoisted(() => ({
  resolveClinicBranchAccess: vi.fn(),
  resolveClinicAccess: vi.fn(),
}));

vi.mock('../../../lib/clinicBranchAccess.js', () => ({ resolveClinicBranchAccess }));
vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess }));

import { resolveAppointmentDoctor } from './appointmentDoctorAccess.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveAppointmentDoctor', () => {
  it('rejects missing clinic or doctor identifiers', async () => {
    await expect(resolveAppointmentDoctor('', 'clinic-1', 'branch-1')).resolves.toBe(false);
    await expect(resolveAppointmentDoctor('doctor-1', '')).resolves.toBe(false);
    expect(resolveClinicBranchAccess).not.toHaveBeenCalled();
    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });

  it('does not let clinic-level access bypass a different branch assignment', async () => {
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });
    resolveClinicBranchAccess.mockResolvedValue(null);

    await expect(resolveAppointmentDoctor('doctor-1', 'clinic-1', 'branch-2')).resolves.toBe(false);
    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      role: 'DIRECTOR',
      requestedBranchId: 'branch-2',
    });
    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });

  it('accepts a doctor whose active membership includes the target branch', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ASSIGNED',
      branchId: 'branch-2',
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    await expect(resolveAppointmentDoctor('doctor-1', 'clinic-1', 'branch-2')).resolves.toBe(true);
    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      role: 'DOCTOR',
      requestedBranchId: 'branch-2',
    });
    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });

  it('allows an owner only when the target branch is active and authorized', async () => {
    resolveClinicBranchAccess
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        roleScope: 'ORGANIZATION',
        branchId: 'branch-2',
        allowedBranchIds: ['branch-1', 'branch-2'],
      });

    await expect(resolveAppointmentDoctor('owner-1', 'clinic-1', 'branch-2')).resolves.toBe(true);
    expect(resolveClinicBranchAccess).toHaveBeenNthCalledWith(2, {
      userId: 'owner-1',
      clinicId: 'clinic-1',
      role: 'OWNER',
      requestedBranchId: 'branch-2',
    });
  });

  it('uses the legacy clinic-only check only when the appointment has no branch', async () => {
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    await expect(resolveAppointmentDoctor('doctor-1', 'clinic-1', null)).resolves.toBe(true);
    expect(resolveClinicBranchAccess).not.toHaveBeenCalled();
    expect(resolveClinicAccess).toHaveBeenCalledWith('doctor-1', 'clinic-1');
  });
});
