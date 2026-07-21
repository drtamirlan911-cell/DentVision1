/** Map backend proactive alert types onto UI tone tokens. */
export type AlertTone = 'info' | 'warning' | 'success' | 'error'

const TONE_BY_TYPE: Record<string, AlertTone> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
  unpaid: 'error',
  urgent: 'error',
  debt: 'error',
  upcoming: 'warning',
  reminder: 'warning',
  stock: 'warning',
  low_stock: 'warning',
}

export function normalizeAlertTone(type: unknown): AlertTone {
  const key = String(type || 'info').toLowerCase()
  return TONE_BY_TYPE[key] || 'info'
}
