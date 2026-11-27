import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  academyFindFirst, academyFindUnique, lecturerFindFirst, lecturerFindUnique, lecturerCreate, lecturerUpdate,
  organizationFindUnique, invitationFindUnique, invitationCreate, invitationUpdateMany,
  transaction, syncPersonFromLecturer, getOrCreateWallet,
} = vi.hoisted(() => ({
  academyFindFirst: vi.fn(),
  academyFindUnique: vi.fn(),
  lecturerFindFirst: vi.fn(),
  lecturerFindUnique: vi.fn(),
  lecturerCreate: vi.fn(),
  lecturerUpdate: vi.fn(),
  organizationFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationCreate: vi.fn(),
  invitationUpdateMany: vi.fn(),
  transaction: vi.fn(),
  syncPersonFromLecturer: vi.fn(),
  getOrCreateWallet: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    academy: { findFirst: academyFindFirst, findUnique: academyFindUnique },
    lecturer: { findFirst: lecturerFindFirst, findUnique: lecturerFindUnique },
    organization: { findUnique: organizationFindUnique },
    organizationInvitation: { findUnique: invitationFindUnique, create: invitationCreate, updateMany: invitationUpdateMany },
    $transaction: transaction,
  },
}));
vi.mock('../../lib/syncMembership.js', () => ({ syncPersonFromLecturer }));
vi.mock('../finance/finance.service.js', () => ({ getOrCreateWallet }));

import { acceptInvitation, canManageMembers, createInvitation } from './invitations.service.js';

const ACADEMY_ORG = {
  id: 'academy-org-1',
  type: 'ACADEMY',
  originalId: 'academy-1',
  name: 'Dental Academy',
  archivedAt: null,
  settings: null,
};

beforeEach(() => {
  academyFindFirst.mockReset();
  academyFindUnique.mockReset().mockResolvedValue({ id: 'academy-1' });
  lecturerFindFirst.mockReset();
  lecturerFindUnique.mockReset();
  lecturerCreate.mockReset();
  lecturerUpdate.mockReset();
  organizationFindUnique.mockReset();
  invitationFindUnique.mockReset();
  invitationCreate.mockReset();
  invitationUpdateMany.mockReset();
  transaction.mockReset();
  syncPersonFromLecturer.mockReset();
  getOrCreateWallet.mockReset().mockResolvedValue(undefined);
  lecturerFindFirst.mockResolvedValue(null);
  lecturerFindUnique.mockResolvedValue(null);
  lecturerCreate.mockResolvedValue({ id: 'lecturer-1', userId: 'teacher-1', academyId: 'academy-1' });
  lecturerUpdate.mockResolvedValue({ id: 'lecturer-1', userId: 'teacher-1', academyId: 'academy-1' });
  invitationUpdateMany.mockResolvedValue({ count: 1 });
  syncPersonFromLecturer.mockResolvedValue(undefined);
  transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'teacher-1', firstName: 'New', lastName: 'Lecturer', email: 'teacher@example.kz' }) },
    academy: { findUnique: vi.fn().mockResolvedValue({ id: 'academy-1' }) },
    lecturer: { findUnique: lecturerFindUnique, create: lecturerCreate, update: lecturerUpdate },
    organizationInvitation: { updateMany: invitationUpdateMany },
  }));
});

describe('Academy team invitations', () => {
  it('lets only the owner of the exact Academy invite staff', async () => {
    academyFindFirst.mockResolvedValueOnce({ id: 'academy-1' });
    expect(await canManageMembers('academy-owner', ACADEMY_ORG)).toBe(true);
    expect(academyFindFirst).toHaveBeenCalledWith({
      where: { id: 'academy-1', ownerId: 'academy-owner' },
      select: { id: true },
    });

    academyFindFirst.mockResolvedValueOnce(null);
    expect(await canManageMembers('different-user', ACADEMY_ORG)).toBe(false);
  });

  it('creates only lecturer invitations for an Academy', async () => {
    organizationFindUnique.mockResolvedValue(ACADEMY_ORG);
    invitationCreate.mockImplementation(async ({ data }: any) => data);

    const invitation = await createInvitation({
      organizationId: 'academy-org-1',
      role: 'owner',
      email: 'teacher@example.kz',
      createdBy: 'academy-owner',
    });

    expect(invitation.role).toBe('lecturer');
    expect(invitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'academy-org-1', role: 'lecturer', email: 'teacher@example.kz' }),
    }));
  });

  it('accepts the invitation by attaching an existing independent lecturer profile to the Academy', async () => {
    invitationFindUnique.mockResolvedValue({
      code: 'ACAD1234',
      role: 'lecturer',
      email: 'teacher@example.kz',
      expiresAt: new Date('2026-12-20T00:00:00Z'),
      usedAt: null,
      revokedAt: null,
      organization: ACADEMY_ORG,
    });
    lecturerFindFirst.mockResolvedValue(null);
    lecturerFindUnique.mockResolvedValue({ id: 'existing-lecturer', userId: 'teacher-1', academyId: null });
    lecturerUpdate.mockResolvedValue({ id: 'existing-lecturer', userId: 'teacher-1', academyId: 'academy-1' });

    const result = await acceptInvitation('ACAD1234', { id: 'teacher-1', email: 'teacher@example.kz' });

    expect(lecturerUpdate).toHaveBeenCalledWith({
      where: { id: 'existing-lecturer' },
      data: { academyId: 'academy-1' },
    });
    expect(syncPersonFromLecturer).toHaveBeenCalledWith('existing-lecturer', 'teacher-1', 'academy-1', expect.any(Object));
    expect(invitationUpdateMany).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      organizationId: 'academy-org-1',
      organizationType: 'ACADEMY',
      entityId: 'existing-lecturer',
      role: 'lecturer',
    });
  });

  it('refuses to transfer an existing lecturer profile from another Academy', async () => {
    invitationFindUnique.mockResolvedValue({
      code: 'ACAD1234',
      role: 'lecturer',
      email: null,
      expiresAt: new Date('2026-12-20T00:00:00Z'),
      usedAt: null,
      revokedAt: null,
      organization: ACADEMY_ORG,
    });
    lecturerFindFirst.mockResolvedValue(null);
    lecturerFindUnique.mockResolvedValue({ id: 'other-academy-lecturer', userId: 'teacher-1', academyId: 'academy-elsewhere' });

    await expect(acceptInvitation('ACAD1234', { id: 'teacher-1' })).rejects.toMatchObject({ status: 409 });
    expect(lecturerUpdate).not.toHaveBeenCalled();
    expect(lecturerCreate).not.toHaveBeenCalled();
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it('creates a new unverified Lecturer profile when the invitee has none', async () => {
    invitationFindUnique.mockResolvedValue({
      code: 'ACAD1234',
      role: 'lecturer',
      email: null,
      expiresAt: new Date('2026-12-20T00:00:00Z'),
      usedAt: null,
      revokedAt: null,
      organization: ACADEMY_ORG,
    });
    lecturerFindFirst.mockResolvedValue(null);
    lecturerFindUnique.mockResolvedValue(null);

    const result = await acceptInvitation('ACAD1234', { id: 'teacher-1', email: 'teacher@example.kz' });

    expect(lecturerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'teacher-1', academyId: 'academy-1', level: 'new' }),
    }));
    expect(syncPersonFromLecturer).toHaveBeenCalledWith('lecturer-1', 'teacher-1', 'academy-1', expect.any(Object));
    expect(result.entityId).toBe('lecturer-1');
    expect(getOrCreateWallet).toHaveBeenCalledWith('LECTURER', 'lecturer-1');
  });
});
