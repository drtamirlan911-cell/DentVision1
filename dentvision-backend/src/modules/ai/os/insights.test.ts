import { beforeEach, describe, expect, it, vi } from 'vitest';

const { referralFindMany, releaseFindMany, labOrderFindMany, invoiceFindMany, aiMemoryFindMany, aiMemoryUpsert } = vi.hoisted(() => ({
  referralFindMany: vi.fn(),
  releaseFindMany: vi.fn(),
  labOrderFindMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  aiMemoryFindMany: vi.fn(),
  aiMemoryUpsert: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    referral: { findMany: referralFindMany },
    treatmentPlanRelease: { findMany: releaseFindMany },
    labOrder: { findMany: labOrderFindMany },
    invoice: { findMany: invoiceFindMany },
    aIMemory: { findMany: aiMemoryFindMany, upsert: aiMemoryUpsert },
  },
}));

import { computePatientInsights, dismissInsight, listDismissedInsightIds } from './insights.js';

beforeEach(() => {
  vi.clearAllMocks();
  referralFindMany.mockResolvedValue([]);
  releaseFindMany.mockResolvedValue([]);
  labOrderFindMany.mockResolvedValue([]);
  invoiceFindMany.mockResolvedValue([]);
});

describe('computePatientInsights', () => {
  it('flags a completed referral whose result is not yet signed', async () => {
    referralFindMany.mockResolvedValueOnce([
      { id: 'ref-1', studyType: 'КТ', result: { signedAt: null } },
    ]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([
      {
        id: 'diag-result:ref-1',
        severity: 'attention',
        title: 'Результат «КТ» готов, но не подписан врачом',
        evidence: [{ sourceType: 'referral', sourceId: 'ref-1', label: 'КТ' }],
        actions: [],
      },
    ]);
    expect(referralFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'p-1', clinicId: 'clinic-1', status: 'COMPLETED' } }),
    );
  });

  it('does not flag a referral whose result is already signed', async () => {
    referralFindMany.mockResolvedValueOnce([
      { id: 'ref-1', studyType: 'КТ', result: { signedAt: new Date() } },
    ]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([]);
  });

  it('does not flag a completed referral with no result row at all', async () => {
    referralFindMany.mockResolvedValueOnce([{ id: 'ref-1', studyType: 'КТ', result: null }]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([]);
  });

  it('flags an approved treatment plan release that has not been published', async () => {
    releaseFindMany.mockResolvedValueOnce([{ id: 'rel-1', version: 2, totalAmount: 50000 }]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([
      {
        id: 'plan-release:rel-1',
        severity: 'attention',
        title: 'План лечения (в. 2) утверждён, но не опубликован пациенту',
        evidence: [{ sourceType: 'treatment_plan_release', sourceId: 'rel-1', label: 'v2' }],
        actions: [{ label: 'Открыть план лечения', tool: 'navigate', params: { section: 'Планы лечения' }, requiresApproval: false }],
      },
    ]);
    expect(releaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'p-1', clinicId: 'clinic-1', status: 'approved', publishedAt: null } }),
    );
  });

  it('flags an overdue lab order and excludes terminal statuses from the query', async () => {
    labOrderFindMany.mockResolvedValueOnce([{ id: 'lab-1', type: 'Коронка', deadline: new Date('2020-01-01') }]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([
      {
        id: 'lab-order:lab-1',
        severity: 'urgent',
        title: 'Заказ лаборатории «Коронка» просрочен',
        evidence: [{ sourceType: 'lab_order', sourceId: 'lab-1', label: 'Коронка' }],
        actions: [{ label: 'Открыть лабораторию', tool: 'navigate', params: { section: 'Лаборатория' }, requiresApproval: false }],
      },
    ]);
    expect(labOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 'p-1',
          clinicId: 'clinic-1',
          status: { notIn: ['completed', 'delivered', 'cancelled'] },
        }),
      }),
    );
  });

  it('flags an invoice already marked overdue', async () => {
    invoiceFindMany.mockResolvedValueOnce([{ id: 'inv-1', amount: 15000 }]);

    const insights = await computePatientInsights('p-1', 'clinic-1');

    expect(insights).toEqual([
      {
        id: 'invoice:inv-1',
        severity: 'urgent',
        title: `Счёт на ${(15000).toLocaleString('ru-RU')} просрочен`,
        evidence: [{ sourceType: 'invoice', sourceId: 'inv-1', label: 'inv-1' }],
        actions: [{ label: 'Открыть кассу', tool: 'navigate', params: { section: 'Касса' }, requiresApproval: false }],
      },
    ]);
    expect(invoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'p-1', clinicId: 'clinic-1', status: 'overdue', deletedAt: null } }),
    );
  });

  it('returns an empty list when nothing is amiss', async () => {
    expect(await computePatientInsights('p-1', 'clinic-1')).toEqual([]);
  });
});

describe('dismiss state (AIMemory)', () => {
  it('lists dismissed insight ids by key from the ai_insight_dismissed scope', async () => {
    aiMemoryFindMany.mockResolvedValueOnce([{ key: 'invoice:inv-1' }, { key: 'lab-order:lab-1' }]);

    const ids = await listDismissedInsightIds('user-1', 'clinic-1');

    expect(ids).toEqual(new Set(['invoice:inv-1', 'lab-order:lab-1']));
    expect(aiMemoryFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', clinicId: 'clinic-1', scope: 'ai_insight_dismissed' },
      select: { key: true },
    });
  });

  it('upserts a dismissal keyed by the insight id, user and clinic', async () => {
    await dismissInsight('invoice:inv-1', 'user-1', 'clinic-1');

    expect(aiMemoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key_userId_clinicId_scope: { key: 'invoice:inv-1', userId: 'user-1', clinicId: 'clinic-1', scope: 'ai_insight_dismissed' } },
      }),
    );
  });
});
