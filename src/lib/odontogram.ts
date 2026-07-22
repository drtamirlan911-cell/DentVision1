/** Shared odontogram model: statuses, surfaces, AI/plan helpers. */

export const SURFACE_KEYS = ['M', 'O', 'D', 'B', 'L'] as const
export type SurfaceKey = (typeof SURFACE_KEYS)[number]

/** Whole-tooth statuses (apply to the tooth as a unit). */
export const WHOLE_TOOTH_STATUSES = [
  'healthy',
  'crown',
  'missing',
  'root',
  'implant',
  'veneer',
  'endo_ok',
  'endo_fail',
] as const

/** Surface-level statuses (paint on MODBL). */
export const SURFACE_STATUSES = ['caries', 'filled', 'healthy'] as const

export type ToothStatusKey =
  | (typeof WHOLE_TOOTH_STATUSES)[number]
  | (typeof SURFACE_STATUSES)[number]
  | 'caries'
  | 'filled'
  | string

export type ToothSurfaces = Partial<Record<SurfaceKey, ToothStatusKey | string>>

export interface ToothData {
  status?: ToothStatusKey
  surfaces?: ToothSurfaces
  diagnosis?: string | null
  notes?: string | null
}

export type PatientTeeth = Record<string | number, string | ToothData>

export const STATUS_META: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Здоров', color: '#27AE60' },
  caries: { label: 'Кариес', color: '#F39C12' },
  filled: { label: 'Пломба', color: '#2980B9' },
  crown: { label: 'Коронка', color: '#8E44AD' },
  missing: { label: 'Отсутствует', color: '#E74C3C' },
  root: { label: 'Корень', color: '#E67E22' },
  implant: { label: 'Имплант', color: '#00BCD4' },
  veneer: { label: 'Винир', color: '#E91E8C' },
  endo_ok: { label: 'Эндо ✓', color: '#2ECC71' },
  endo_fail: { label: 'Эндо ✗', color: '#C0392B' },
}

/** Resolve color whether value is a status key or a legacy hex. */
export function statusColor(value?: string | null): string {
  if (!value) return 'transparent'
  if (STATUS_META[value]) return STATUS_META[value].color
  if (value.startsWith('#') || value.startsWith('rgb')) return value
  // reverse-map legacy hex → known status
  for (const meta of Object.values(STATUS_META)) {
    if (meta.color.toLowerCase() === value.toLowerCase()) return meta.color
  }
  return value
}

export function statusLabel(value?: string | null): string {
  if (!value) return '—'
  if (STATUS_META[value]) return STATUS_META[value].label
  for (const [key, meta] of Object.entries(STATUS_META)) {
    if (meta.color.toLowerCase() === String(value).toLowerCase()) return meta.label
  }
  return String(value)
}

/** Normalize surface value (hex or key) → status key when possible. */
export function normalizeSurfaceStatus(value?: string | null): ToothStatusKey | undefined {
  if (!value) return undefined
  if (STATUS_META[value]) return value
  const lower = value.toLowerCase()
  for (const [key, meta] of Object.entries(STATUS_META)) {
    if (meta.color.toLowerCase() === lower) return key
  }
  return value
}

export function normalizeTooth(raw: string | ToothData | null | undefined): ToothData {
  if (!raw) return { status: 'healthy', surfaces: {} }
  if (typeof raw === 'string') return { status: raw, surfaces: {} }
  const surfaces: ToothSurfaces = {}
  if (raw.surfaces && typeof raw.surfaces === 'object') {
    for (const [k, v] of Object.entries(raw.surfaces)) {
      const key = k as SurfaceKey
      if (!SURFACE_KEYS.includes(key)) continue
      const n = normalizeSurfaceStatus(v)
      if (n && n !== 'healthy') surfaces[key] = n
    }
  }
  return {
    status: raw.status || 'healthy',
    surfaces,
    diagnosis: raw.diagnosis ?? null,
    notes: raw.notes ?? null,
  }
}

export interface PlanRecommendation {
  tooth: string
  procedure: string
  urgency: 'high' | 'medium' | 'low'
  estimatedPrice: number
  reason: string
}

const SURFACE_RU: Record<SurfaceKey, string> = {
  M: 'М',
  O: 'О',
  D: 'Д',
  B: 'В',
  L: 'Я',
}

/** Rule-based preliminary plan from a filled odontogram (instant, no LLM). */
export function buildPlanFromOdontogram(teeth: PatientTeeth): PlanRecommendation[] {
  const out: PlanRecommendation[] = []

  for (const [num, raw] of Object.entries(teeth || {})) {
    const t = normalizeTooth(raw)
    const status = t.status || 'healthy'
    const surfaces = t.surfaces || {}

    if (status === 'missing') {
      out.push({
        tooth: num,
        procedure: 'Имплантация или ортопедическое восстановление',
        urgency: 'low',
        estimatedPrice: 250000,
        reason: 'Зуб отсутствует',
      })
      continue
    }
    if (status === 'endo_fail') {
      out.push({
        tooth: num,
        procedure: 'Перелечивание каналов / удаление + восстановление',
        urgency: 'high',
        estimatedPrice: 85000,
        reason: 'Неуспешная эндодонтия',
      })
    }
    if (status === 'root') {
      out.push({
        tooth: num,
        procedure: 'Эндодонтия / ортопедия или удаление',
        urgency: 'high',
        estimatedPrice: 45000,
        reason: 'Сохранён корень',
      })
    }
    if (status === 'caries') {
      out.push({
        tooth: num,
        procedure: 'Лечение кариеса + реставрация',
        urgency: 'medium',
        estimatedPrice: 18000,
        reason: 'Кариес (зуб)',
      })
    }

    const cariesSurfaces = SURFACE_KEYS.filter((s) => normalizeSurfaceStatus(surfaces[s]) === 'caries')
    if (cariesSurfaces.length) {
      out.push({
        tooth: num,
        procedure: `Лечение кариеса (${cariesSurfaces.map((s) => SURFACE_RU[s]).join('/')})`,
        urgency: cariesSurfaces.includes('O') && cariesSurfaces.length >= 2 ? 'high' : 'medium',
        estimatedPrice: 12000 + cariesSurfaces.length * 4000,
        reason: `Кариес поверхностей: ${cariesSurfaces.join(', ')}`,
      })
    }

    if (status === 'implant') {
      // informational — usually already restored; skip unless surfaces have issues
    }
  }

  // de-dupe same tooth+procedure
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.tooth}:${r.procedure}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).sort((a, b) => {
    const u = { high: 0, medium: 1, low: 2 }
    return u[a.urgency] - u[b.urgency] || Number(a.tooth) - Number(b.tooth)
  })
}

/** Compact human/AI-readable odontogram summary. */
export function summarizeOdontogram(teeth: PatientTeeth, patientName?: string): string {
  const lines: string[] = []
  if (patientName) lines.push(`Одонтограмма: ${patientName}`)

  const entries = Object.entries(teeth || {})
    .map(([n, raw]) => [n, normalizeTooth(raw)] as const)
    .filter(([, t]) => {
      const hasSurface = Object.keys(t.surfaces || {}).length > 0
      return (t.status && t.status !== 'healthy') || hasSurface
    })
    .sort((a, b) => Number(a[0]) - Number(b[0]))

  if (!entries.length) {
    lines.push('Все зубы без отметок (здоровы / не заполнены).')
    return lines.join('\n')
  }

  for (const [num, t] of entries) {
    const parts: string[] = [`${num}: ${statusLabel(t.status)}`]
    const surf = Object.entries(t.surfaces || {})
      .map(([s, v]) => `${s}=${statusLabel(v)}`)
      .join(', ')
    if (surf) parts.push(`поверхности [${surf}]`)
    lines.push(parts.join(' · '))
  }
  return lines.join('\n')
}

export function aiPlanPrompt(patientId: string, patientName: string, teeth: PatientTeeth): string {
  const summary = summarizeOdontogram(teeth, patientName)
  return (
    `Составь предварительный план лечения по одонтограмме пациента «${patientName}» (id ${patientId}).\n` +
    `Сначала вызови getPatientCard, сверь зубную карту. Затем предложи этапы (FDI, процедуры, ориентир бюджета) ` +
    `и создай черновик через createTreatmentPlan (confirmed=false) для моего подтверждения.\n\n` +
    `Сводка одонтограммы:\n${summary}`
  )
}
