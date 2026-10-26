import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  clinicInvitation: {
    create: vi.fn(async (args: any) => ({ id: 'invitation-1', ...args.data })),
  },
}));
vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));

import { createClinicInvitation } from './clinicInvitations.service.js';

const input = {
  clinicId: 'clinic-1',
  email: 'doctor@example.kz',
  role: 'DOCTOR' as UserRole,
  expiresAt: new Date('2026-11-02T10:00:00.000Z'),
};

describe('createClinicInvitation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists the invite code and its exact clinic, email, role and expiry', async () => {
    const code = await createClinicInvitation(input);
    expect(code).toMatch(/^[0-9A-F]{10}$/);
    expect(prismaMock.clinicInvitation.create).toHaveBeenCalledWith({
      data: { ...input, code },
    });
  });

  it('retries unique-code collisions and persists the next candidate', async () => {
    prismaMock.clinicInvitation.create.mockRejectedValueOnce({ code: 'P2002' });
    const code = await createClinicInvitation(input);
    expect(code).toMatch(/^[0-9A-F]{10}$/);
    expect(prismaMock.clinicInvitation.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.clinicInvitation.create.mock.calls[1][0].data).toMatchObject({
      clinicId: input.clinicId, email: input.email, role: input.role, expiresAt: input.expiresAt, code,
    });
  });

  it('does not retry unrelated database failures', async () => {
    const failure = new Error('database unavailable');
    prismaMock.clinicInvitation.create.mockRejectedValueOnce(failure);
    await expect(createClinicInvitation(input)).rejects.toBe(failure);
    expect(prismaMock.clinicInvitation.create).toHaveBeenCalledTimes(1);
  });
});
