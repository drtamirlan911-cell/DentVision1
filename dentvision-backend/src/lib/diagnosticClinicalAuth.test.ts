import { describe, expect, it, vi } from 'vitest';
import { assertDiagnosticSignerIsDoctor } from './diagnosticClinicalAuth.js';

describe('assertDiagnosticSignerIsDoctor', () => {
  function db() {
    return {
      referral: { findUnique: vi.fn() },
      clinicMember: { findFirst: vi.fn() },
    };
  }

  it('allows the doctor assigned to the referral', async () => {
    const mocked = db();
    mocked.referral.findUnique.mockResolvedValue({ clinicId: 'clinic-1', doctorId: 'doctor-1' });

    await expect(assertDiagnosticSignerIsDoctor(mocked, 'ref-1', 'doctor-1')).resolves.toBeUndefined();
    expect(mocked.clinicMember.findFirst).not.toHaveBeenCalled();
  });

  it('allows another doctor from the same clinic', async () => {
    const mocked = db();
    mocked.referral.findUnique.mockResolvedValue({ clinicId: 'clinic-1', doctorId: 'doctor-1' });
    mocked.clinicMember.findFirst.mockResolvedValue({ userId: 'doctor-2', role: 'DOCTOR' });

    await expect(assertDiagnosticSignerIsDoctor(mocked, 'ref-1', 'doctor-2')).resolves.toBeUndefined();
    expect(mocked.clinicMember.findFirst).toHaveBeenCalledWith({
      where: { clinicId: 'clinic-1', userId: 'doctor-2', role: 'DOCTOR' },
      select: { userId: true, role: true },
    });
  });

  it.each(['OWNER', 'ADMIN', 'MANAGER', 'ASSISTANT'])('rejects clinic role %s', async (role) => {
    const mocked = db();
    mocked.referral.findUnique.mockResolvedValue({ clinicId: 'clinic-1', doctorId: 'doctor-1' });
    mocked.clinicMember.findFirst.mockResolvedValue(role === 'MANAGER' || role === 'ASSISTANT' ? null : null);

    await expect(assertDiagnosticSignerIsDoctor(mocked, 'ref-1', `${role.toLowerCase()}-1`)).rejects.toThrow('Только врач может подписать результат диагностики');
  });

  it('rejects diagnostic-center or laboratory users', async () => {
    const mocked = db();
    mocked.referral.findUnique.mockResolvedValue({ clinicId: 'clinic-1', doctorId: 'doctor-1' });
    mocked.clinicMember.findFirst.mockResolvedValue(null);

    await expect(assertDiagnosticSignerIsDoctor(mocked, 'ref-1', 'center-admin-1')).rejects.toThrow('Только врач может подписать результат диагностики');
    await expect(assertDiagnosticSignerIsDoctor(mocked, 'ref-1', 'lab-admin-1')).rejects.toThrow('Только врач может подписать результат диагностики');
  });

  it('fails closed when the referral does not exist', async () => {
    const mocked = db();
    mocked.referral.findUnique.mockResolvedValue(null);

    await expect(assertDiagnosticSignerIsDoctor(mocked, 'missing', 'user-1')).rejects.toThrow('Referral not found');
  });
});
