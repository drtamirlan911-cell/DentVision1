import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clinicFindMany, approvalFindFirst, approvalCreate, clinicMemberFindFirst, buildClinicLoadPlan } = vi.hoisted(() => ({
  clinicFindMany: vi.fn(),
  approvalFindFirst: vi.fn(),
  approvalCreate: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
  buildClinicLoadPlan: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    clinic: { findMany: clinicFindMany },
    aiApproval: { findFirst: approvalFindFirst, create: approvalCreate },
    clinicMember: { findFirst: clinicMemberFindFirst },
  },
}));

vi.mock('../modules/ai/core/clinicLoadPlan.js', () => ({ buildClinicLoadPlan }));

import { sweepOverdueRecalls } from './recallAgent.js';

beforeEach(() => {
  vi.clearAllMocks();
  clinicFindMany.mockResolvedValue([{ id: 'clinic-1' }]);
  approvalFindFirst.mockResolvedValue(null);
  clinicMemberFindFirst.mockResolvedValue({ userId: 'owner-1' });
});

describe('sweepOverdueRecalls', () => {
  it('proposes a getRecallList approval when a clinic has overdue patients and an eligible requester', async () => {
    buildClinicLoadPlan.mockResolvedValueOnce({
      message: '',
      suggestions: [],
      payload: { recall: [{ id: 'p1' }, { id: 'p2' }] },
    });

    const result = await sweepOverdueRecalls();

    expect(result).toEqual({ proposed: 1 });
    expect(approvalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: 'clinic-1',
        requestedByUserId: 'owner-1',
        surface: 'staff',
        tool: 'getRecallList',
        riskLevel: 'standard',
        status: 'pending',
        requiredPermission: 'patients.read',
        params: { inactiveDays: 90, limit: 2 },
      }),
    });
  });

  it('never proposes a mutating action itself — only the read-only getRecallList tool', async () => {
    buildClinicLoadPlan.mockResolvedValueOnce({ message: '', suggestions: [], payload: { recall: [{ id: 'p1' }] } });

    await sweepOverdueRecalls();

    const call = approvalCreate.mock.calls[0][0];
    expect(call.data.tool).toBe('getRecallList');
  });

  it('skips a clinic with no overdue patients', async () => {
    buildClinicLoadPlan.mockResolvedValueOnce({ message: '', suggestions: [], payload: { recall: [] } });

    const result = await sweepOverdueRecalls();

    expect(result).toEqual({ proposed: 0 });
    expect(approvalCreate).not.toHaveBeenCalled();
  });

  it('skips a clinic that already has a pending recall approval', async () => {
    approvalFindFirst.mockResolvedValueOnce({ id: 'existing' });
    buildClinicLoadPlan.mockResolvedValueOnce({ message: '', suggestions: [], payload: { recall: [{ id: 'p1' }] } });

    const result = await sweepOverdueRecalls();

    expect(result).toEqual({ proposed: 0 });
    expect(approvalCreate).not.toHaveBeenCalled();
  });

  it('skips a clinic with no eligible staffer to name as requester', async () => {
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    buildClinicLoadPlan.mockResolvedValueOnce({ message: '', suggestions: [], payload: { recall: [{ id: 'p1' }] } });

    const result = await sweepOverdueRecalls();

    expect(result).toEqual({ proposed: 0 });
    expect(approvalCreate).not.toHaveBeenCalled();
  });

  it('does not throw when the approvals table does not exist yet on a fresh boot (P2021)', async () => {
    approvalFindFirst.mockRejectedValueOnce({ code: 'P2021' });
    buildClinicLoadPlan.mockResolvedValueOnce({ message: '', suggestions: [], payload: { recall: [{ id: 'p1' }] } });

    const result = await sweepOverdueRecalls();

    expect(result).toEqual({ proposed: 0 });
  });
});
