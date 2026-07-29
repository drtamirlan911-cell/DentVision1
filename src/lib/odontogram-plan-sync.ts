/**
 * Sync odontogram findings into a CRM treatment-plan draft (no AI required).
 */
import * as api from '@/utils/api'
import {
  buildPlanFromOdontogram,
  summarizeOdontogram,
  type PatientTeeth,
  type PlanRecommendation,
} from '@/lib/odontogram'
import type { TreatmentPlanStage } from '@/lib/treatment-plan'

export function recommendationsToStages(recs: PlanRecommendation[]): TreatmentPlanStage[] {
  const buckets: { title: string; urgency: PlanRecommendation['urgency'] }[] = [
    { title: 'Срочно', urgency: 'high' },
    { title: 'Терапия', urgency: 'medium' },
    { title: 'Планово', urgency: 'low' },
  ]
  const stages: TreatmentPlanStage[] = []
  let order = 1
  for (const b of buckets) {
    const group = recs.filter((r) => r.urgency === b.urgency)
    if (!group.length) continue
    stages.push({
      id: crypto.randomUUID(),
      title: b.title,
      status: 'pending',
      sortOrder: order++,
      cost: group.reduce((s, r) => s + r.estimatedPrice, 0),
      items: group.map((r) => ({
        id: crypto.randomUUID(),
        serviceId: `odonto-${r.tooth}`,
        serviceName: r.procedure,
        price: r.estimatedPrice,
        teeth: [Number(r.tooth)].filter((n) => Number.isFinite(n)),
        qty: 1,
      })),
      notes: group.map((r) => `Зуб ${r.tooth}: ${r.reason}`).join('; '),
    })
  }
  return stages
}

export async function syncOdontogramToTreatmentPlan(opts: {
  clinicId: string
  patientId: string
  patientName?: string
  teeth: PatientTeeth
}): Promise<{ planId: string; count: number; created: boolean } | null> {
  const { clinicId, patientId, patientName, teeth } = opts
  if (!clinicId || !patientId) return null

  const recs = buildPlanFromOdontogram(teeth)
  if (!recs.length) return null

  const existing = await api.getTreatmentPlans(clinicId, { patientId })
  const list = Array.isArray(existing) ? existing : []
  const open = list.find((p: any) =>
    /одонтограмм/i.test(String(p.title || '')) &&
    !['completed', 'cancelled', 'COMPLETED', 'CANCELLED'].includes(String(p.status || '')),
  ) || list.find((p: any) =>
    ['draft', 'proposed', 'DRAFT', 'PROPOSED'].includes(String(p.status || '')),
  )

  const stages = recommendationsToStages(recs)
  const totalBudget = recs.reduce((s, r) => s + r.estimatedPrice, 0)
  const teethNums = [...new Set(recs.map((r) => Number(r.tooth)).filter((n) => Number.isFinite(n)))]
  const diagnosis = summarizeOdontogram(teeth, patientName).slice(0, 800)

  const saved = await api.upsertTreatmentPlan({
    id: open?.id,
    clinicId,
    patientId,
    title: open?.title || `План по одонтограмме${patientName ? ` · ${patientName}` : ''}`,
    diagnosis,
    status: open?.status || 'proposed',
    totalBudget,
    teeth: teethNums,
    stages,
    notes: 'auto:odontogram',
  })

  const planId = saved?.id || saved?.data?.id || open?.id
  return { planId, count: recs.length, created: !open?.id }
}
