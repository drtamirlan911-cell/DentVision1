/** Shared period helpers for CRM Finance (Касса / отчёты / ФОТ / расходы). */

export type FinancePeriodPreset = 'today' | 'week' | 'month' | 'custom'

export interface FinancePeriod {
  preset: FinancePeriodPreset
  from: string // YYYY-MM-DD
  to: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function buildPeriod(preset: FinancePeriodPreset, custom?: { from?: string; to?: string }): FinancePeriod {
  const now = startOfLocalDay()
  if (preset === 'today') {
    const ymd = toLocalYmd(now)
    return { preset, from: ymd, to: ymd }
  }
  if (preset === 'week') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { preset, from: toLocalYmd(from), to: toLocalYmd(now) }
  }
  if (preset === 'custom' && custom?.from && custom?.to) {
    return { preset, from: custom.from, to: custom.to }
  }
  // month
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { preset: 'month', from: toLocalYmd(from), to: toLocalYmd(now) }
}

export const PERIOD_CHIPS: Array<{ id: FinancePeriodPreset; label: string }> = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'custom', label: 'Период' },
]

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const EXPENSE_CATEGORIES = [
  { value: 'Аренда', label: 'Аренда' },
  { value: 'Коммунальные', label: 'Коммунальные услуги' },
  { value: 'Материалы', label: 'Закупка материалов' },
  { value: 'Лаборатория', label: 'Лаборатория' },
  { value: 'Маркетинг', label: 'Маркетинг' },
  { value: 'Зарплата', label: 'Зарплата / авансы' },
  { value: 'Налоги', label: 'Налоги' },
  { value: 'Прочее', label: 'Прочее' },
]

export const PAY_TYPE_OPTIONS = [
  { value: 'commission', label: '% от услуг' },
  { value: 'salary', label: 'Оклад' },
  { value: 'mixed', label: 'Оклад + %' },
]

export function payTypeLabel(t?: string) {
  return PAY_TYPE_OPTIONS.find((o) => o.value === t)?.label || '% от услуг'
}
