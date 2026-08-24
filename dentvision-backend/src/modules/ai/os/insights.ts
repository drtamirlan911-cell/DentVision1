/**
 * Deterministic AI insights (Stage 11 / phase_9) — contextual hints inline in
 * the patient workspace, not a chatbot. Every insight here is a plain read +
 * compute over real rows, the same trick already used by
 * `tryDeterministicStats`/`composeCeoBrief`/`lib/triage.ts`: no LLM call, no
 * hallucination risk, the same input always produces the same output.
 *
 * Each insight's `actions` dispatch through the kernel (`runAiAction`) rather
 * than acting directly, so whatever rights/scope/audit/approval a tool
 * already requires apply here for free — this module only decides *what to
 * surface*, never executes anything itself.
 */

import prisma from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';

export type AiInsightSeverity = 'info' | 'attention' | 'urgent';

export interface AiInsight {
  id: string;
  severity: AiInsightSeverity;
  title: string;
  evidence: Array<{ sourceType: string; sourceId: string; label: string }>;
  actions: Array<{ label: string; tool: string; params: Record<string, unknown>; requiresApproval: boolean }>;
}

const LAB_ORDER_TERMINAL_STATUSES = ['completed', 'delivered', 'cancelled'];

/**
 * Insights for one patient. `clinicId` scopes every query — the caller
 * (route handler) is responsible for having already verified the patient
 * belongs to it before calling this.
 */
export async function computePatientInsights(patientId: string, clinicId: string): Promise<AiInsight[]> {
  const now = new Date();
  const insights: AiInsight[] = [];

  const [unsignedResults, unpublishedReleases, overdueLabOrders, overdueInvoices] = await Promise.all([
    // A result exists and the referral moved to COMPLETED, but no clinician
    // has signed it yet — `Referral.reviewedAt`/`reviewerId` are dead columns
    // nothing in the codebase ever writes; `DiagnosticResult.signedAt` is the
    // real, actively-used "a clinician has looked at this" marker.
    prisma.referral.findMany({
      where: { patientId, clinicId, status: 'COMPLETED' },
      select: { id: true, studyType: true, result: { select: { signedAt: true } } },
    }),
    prisma.treatmentPlanRelease.findMany({
      where: { patientId, clinicId, status: 'approved', publishedAt: null },
      select: { id: true, version: true, totalAmount: true },
    }),
    prisma.labOrder.findMany({
      where: { patientId, clinicId, deadline: { lt: now }, status: { notIn: LAB_ORDER_TERMINAL_STATUSES as never } },
      select: { id: true, type: true, deadline: true },
    }),
    // 'overdue' is a real, manually-set InvoiceStatus value every existing
    // debt filter in this codebase already checks — there is no due-date
    // column to infer it from, so this surfaces what's already marked, not
    // an invented day-count threshold.
    prisma.invoice.findMany({
      where: { patientId, clinicId, status: 'overdue', deletedAt: null },
      select: { id: true, amount: true },
    }),
  ]);

  for (const r of unsignedResults) {
    if (!r.result || r.result.signedAt) continue;
    insights.push({
      id: `diag-result:${r.id}`,
      severity: 'attention',
      title: `Результат «${r.studyType}» готов, но не подписан врачом`,
      evidence: [{ sourceType: 'referral', sourceId: r.id, label: r.studyType }],
      actions: [],
    });
  }

  for (const rel of unpublishedReleases) {
    insights.push({
      id: `plan-release:${rel.id}`,
      severity: 'attention',
      title: `План лечения (в. ${rel.version}) утверждён, но не опубликован пациенту`,
      evidence: [{ sourceType: 'treatment_plan_release', sourceId: rel.id, label: `v${rel.version}` }],
      actions: [
        { label: 'Открыть план лечения', tool: 'navigate', params: { section: 'Планы лечения' }, requiresApproval: false },
      ],
    });
  }

  for (const order of overdueLabOrders) {
    insights.push({
      id: `lab-order:${order.id}`,
      severity: 'urgent',
      title: `Заказ лаборатории «${order.type || 'без типа'}» просрочен`,
      evidence: [{ sourceType: 'lab_order', sourceId: order.id, label: order.type || order.id }],
      actions: [
        { label: 'Открыть лабораторию', tool: 'navigate', params: { section: 'Лаборатория' }, requiresApproval: false },
      ],
    });
  }

  for (const inv of overdueInvoices) {
    insights.push({
      id: `invoice:${inv.id}`,
      severity: 'urgent',
      title: `Счёт на ${inv.amount.toLocaleString('ru-RU')} просрочен`,
      evidence: [{ sourceType: 'invoice', sourceId: inv.id, label: inv.id }],
      actions: [
        { label: 'Открыть кассу', tool: 'navigate', params: { section: 'Касса' }, requiresApproval: false },
      ],
    });
  }

  return insights;
}

/**
 * "Hide" state — the existing, almost-unused `AIMemory` model
 * (`key,userId,clinicId,scope` unique) is exactly the per-caller keyed
 * store this needs; no new table.
 */
const DISMISS_SCOPE = 'ai_insight_dismissed';

export async function listDismissedInsightIds(userId: string, clinicId: string): Promise<Set<string>> {
  const rows = await prisma.aIMemory.findMany({
    where: { userId, clinicId, scope: DISMISS_SCOPE },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

export async function dismissInsight(insightId: string, userId: string, clinicId: string): Promise<void> {
  await prisma.aIMemory.upsert({
    where: { key_userId_clinicId_scope: { key: insightId, userId, clinicId, scope: DISMISS_SCOPE } },
    update: { value: { dismissedAt: new Date().toISOString() } as never, updatedAt: new Date() },
    create: {
      id: uid(),
      key: insightId,
      value: { dismissedAt: new Date().toISOString() } as never,
      userId,
      clinicId,
      scope: DISMISS_SCOPE,
    },
  });
}
