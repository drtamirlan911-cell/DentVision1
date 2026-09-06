import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `getReferral`'s `result` select used to return only `id`/`aiGenerated`/
 * `createdAt`. The referring doctor could see "заключение готово" and never
 * the finding itself through any GET route — on web or mobile,
 * `ReferralDetail.tsx`/`Patients.tsx` already read `result.reportText`, it
 * just always arrived `undefined`. This pins the fix: the shared
 * `referralInclude` used by both the list and the detail route must select
 * the fields those pages actually render.
 */
const { referralFindUnique } = vi.hoisted(() => ({
  referralFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    referral: { findUnique: referralFindUnique },
  },
}));

import { getReferral } from './diagnostics.service.js';

beforeEach(() => {
  referralFindUnique.mockReset();
  referralFindUnique.mockResolvedValue({ id: 'r1' });
});

describe('getReferral result select', () => {
  it('requests reportText, conclusion, pdfUrl and signedAt alongside the id/aiGenerated/createdAt it already had', async () => {
    await getReferral('r1');
    expect(referralFindUnique).toHaveBeenCalledOnce();
    const call = referralFindUnique.mock.calls[0][0];
    const resultSelect = call.include.result.select;
    expect(resultSelect).toMatchObject({
      id: true,
      aiGenerated: true,
      createdAt: true,
      reportText: true,
      conclusion: true,
      pdfUrl: true,
      signedAt: true,
    });
  });
});
