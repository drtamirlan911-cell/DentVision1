/**
 * The clinical finding a line item came from.
 *
 * Optional because a plan typed by hand in the CRM has none — only the
 * odontogram sync knows the tooth's status. The patient presentation quotes a
 * consequence only where this is present, so a hand-typed plan simply gets no
 * consequences act rather than an invented one.
 *
 * Mirrors `TreatmentPlanFinding` in the backend's `treatmentPlanShape.ts`.
 */
export interface TreatmentPlanFinding {
  status: string
  urgency: 'high' | 'medium' | 'low'
}

/**
 * Another service from the clinic's price list that could stand in for this
 * line. The doctor marks these; Essential / Optimal / Premium are assembled
 * from them deterministically at approval, never authored.
 */
export interface TreatmentPlanAlternative {
  serviceId: string
  serviceName: string
  price: number
  tier: 'essential' | 'premium'
}

export interface TreatmentPlanLineItem {
  id: string
  serviceId: string
  serviceName: string
  price: number
  teeth: number[]
  qty: number
  finding?: TreatmentPlanFinding
  alternatives?: TreatmentPlanAlternative[]
  /** The doctor's own choice for this line — what "Optimal" is made of. */
  recommended?: boolean
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

/**
 * Keep a finding only if it is one the backend would also accept — the two
 * normalisers have to agree, or a value survives one side and is dropped by the
 * other. Mirrors `normalizeFinding` in the backend's `treatmentPlanShape.ts`.
 */
function normalizeFinding(raw: unknown): TreatmentPlanFinding | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as TreatmentPlanFinding
  const status = String(value.status || '').trim()
  if (!status) return undefined
  if (!['high', 'medium', 'low'].includes(String(value.urgency))) return undefined
  return { status, urgency: value.urgency }
}

/** Mirrors `normalizeAlternatives` in the backend's `treatmentPlanShape.ts`. */
function normalizeAlternatives(raw: unknown): TreatmentPlanAlternative[] {
  if (!Array.isArray(raw)) return []
  const out: TreatmentPlanAlternative[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const alt = entry as TreatmentPlanAlternative
    const tier = String(alt.tier)
    const serviceName = String(alt.serviceName || '').trim()
    const price = Number(alt.price)
    if (tier !== 'essential' && tier !== 'premium') continue
    if (!serviceName || !Number.isFinite(price) || price <= 0) continue
    const serviceId = String(alt.serviceId || '').trim()
    const key = `${tier}:${serviceId || serviceName}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ serviceId, serviceName, price: Math.round(price), tier })
  }
  return out
}

export function normalizeStages(raw: unknown[]): TreatmentPlanStage[] {
  if (!Array.isArray(raw)) return []
  return raw.map((stage, index) => {
    const s = stage as Record<string, unknown>
    const items = Array.isArray(s.items)
      ? s.items.map((row) => {
          const it = row as Record<string, unknown>
          const finding = normalizeFinding(it.finding)
          const alternatives = normalizeAlternatives(it.alternatives)
          return {
            id: String(it.id || crypto.randomUUID()),
            serviceId: String(it.serviceId || ''),
            serviceName: String(it.serviceName || it.name || 'Услуга'),
            price: Number(it.price) || 0,
            teeth: Array.isArray(it.teeth) ? (it.teeth as number[]) : [],
            qty: Number(it.qty) || 1,
            // Carried explicitly. This function rebuilds items from a fixed
            // field list, so anything not named here is destroyed on the next
            // save — which would have thrown away the doctor's alternatives and,
            // worse, the clinical `finding` the odontogram sync recorded, the
            // first time anyone opened the plan in the CRM. The patient's
            // consequences act would then have gone quiet with nothing broken.
            ...(finding ? { finding } : {}),
            ...(alternatives.length ? { alternatives } : {}),
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
