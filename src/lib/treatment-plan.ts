export interface TreatmentPlanLineItem {
  id: string
  serviceId: string
  serviceName: string
  price: number
  teeth: number[]
  qty: number
}

export interface TreatmentPlanStage {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'done' | 'completed' | 'active'
  sortOrder: number
  cost?: number | null
  items: TreatmentPlanLineItem[]
  notes?: string
}

export interface TreatmentPlanDraft {
  id?: string
  patientId: string
  title: string
  diagnosis: string
  status: string
  stages: TreatmentPlanStage[]
}

export function lineItemTotal(item: TreatmentPlanLineItem): number {
  const units = item.teeth.length > 0 ? item.teeth.length : (item.qty || 1)
  return Math.round((Number(item.price) || 0) * units)
}

export function stageTotal(stage: TreatmentPlanStage): number {
  if (Array.isArray(stage.items) && stage.items.length > 0) {
    return stage.items.reduce((sum, item) => sum + lineItemTotal(item), 0)
  }
  return Number(stage.cost) || 0
}

export function planTotal(stages: TreatmentPlanStage[]): number {
  return stages.reduce((sum, stage) => sum + stageTotal(stage), 0)
}

export function formatTeethList(teeth: number[]): string {
  if (!teeth?.length) return '—'
  return [...teeth].sort((a, b) => a - b).join(', ')
}

export function createEmptyStage(sortOrder: number): TreatmentPlanStage {
  return {
    id: crypto.randomUUID(),
    title: `Этап ${sortOrder}`,
    status: 'pending',
    sortOrder,
    items: [],
    cost: 0,
  }
}

export function createLineItem(
  service: { id: string; name: string; price: number },
  teeth: number[] = [],
): TreatmentPlanLineItem {
  return {
    id: crypto.randomUUID(),
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    teeth: [...teeth],
    qty: 1,
  }
}

export function normalizeStages(raw: unknown[]): TreatmentPlanStage[] {
  if (!Array.isArray(raw)) return []
  return raw.map((stage, index) => {
    const s = stage as Record<string, unknown>
    const items = Array.isArray(s.items)
      ? s.items.map((row) => {
          const it = row as Record<string, unknown>
          return {
            id: String(it.id || crypto.randomUUID()),
            serviceId: String(it.serviceId || ''),
            serviceName: String(it.serviceName || it.name || 'Услуга'),
            price: Number(it.price) || 0,
            teeth: Array.isArray(it.teeth) ? (it.teeth as number[]) : [],
            qty: Number(it.qty) || 1,
          }
        })
      : []

    const normalized: TreatmentPlanStage = {
      id: String(s.id || crypto.randomUUID()),
      title: String(s.title || `Этап ${index + 1}`),
      status: (s.status as TreatmentPlanStage['status']) || 'pending',
      sortOrder: Number(s.sortOrder) || index + 1,
      cost: s.cost != null ? Number(s.cost) : null,
      items,
      notes: s.notes ? String(s.notes) : '',
    }
    normalized.cost = stageTotal(normalized)
    return normalized
  })
}

export function enrichStagesWithCosts(stages: TreatmentPlanStage[]): TreatmentPlanStage[] {
  return stages.map((stage) => ({
    ...stage,
    cost: stageTotal(stage),
  }))
}

export function collectPlanTeeth(stages: TreatmentPlanStage[]): number[] {
  const set = new Set<number>()
  for (const stage of stages) {
    for (const item of stage.items || []) {
      for (const tooth of item.teeth || []) set.add(tooth)
    }
  }
  return [...set].sort((a, b) => a - b)
}
